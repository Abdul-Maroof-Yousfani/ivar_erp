import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { PrismaClient, AccountType } from '@prisma/client';
import { PrismaClient as ManagementClient } from '@prisma/management-client';
import * as crypto from 'crypto';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function decrypt(encryptedText: string, masterKeyString: string): string {
  if (!masterKeyString || masterKeyString.length < 32) {
    throw new Error('MASTER_ENCRYPTION_KEY must be at least 32 characters');
  }
  const masterKey = Buffer.from(masterKeyString.slice(0, 32), 'utf-8');
  const algorithm = 'aes-256-gcm';

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }

  const iv        = Buffer.from(parts[0], 'hex');
  const authTag   = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(algorithm, masterKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted  = decipher.update(encrypted, 'hex', 'utf8');
  decrypted     += decipher.final('utf8');

  return decrypted;
}

function calculateDelta(accountType: AccountType, debit: number, credit: number): number {
  const normalDebit = accountType === AccountType.ASSET || accountType === AccountType.EXPENSE;
  return normalDebit ? debit - credit : credit - debit;
}

function normalizeName(str: string): string {
  return str.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();
}

interface ExcelOpeningBalanceEntry {
  rawName: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  rowIdx: number;
}

// ---------------------------------------------------------------------------
// Excel File Parser
// ---------------------------------------------------------------------------
function parseExcelFile(filePath: string): ExcelOpeningBalanceEntry[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel file not found at path: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames.find(s => s.toUpperCase().includes('TRIAL')) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const entries: ExcelOpeningBalanceEntry[] = [];

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    // Debit side: Column 0 (Account Name), Column 1 (Debit Amount)
    if (row[0] && typeof row[0] === 'string') {
      const name = row[0].trim();
      const rawVal = row[1];
      if (name && typeof rawVal === 'number' && !isNaN(rawVal)) {
        const upperName = name.toUpperCase();
        if (!upperName.startsWith('TOTAL') && !upperName.includes('TRIAL BALANCE')) {
          entries.push({
            rawName: name,
            type: 'DEBIT',
            amount: Number(rawVal),
            rowIdx: r + 1,
          });
        }
      }
    }

    // Credit side: Column 3 (Account Name), Column 4 (Credit Amount)
    if (row[3] && typeof row[3] === 'string') {
      const name = row[3].trim();
      const rawVal = row[4];
      if (name && typeof rawVal === 'number' && !isNaN(rawVal)) {
        const upperName = name.toUpperCase();
        if (!upperName.startsWith('TOTAL') && !upperName.includes('TRIAL BALANCE')) {
          entries.push({
            rawName: name,
            type: 'CREDIT',
            amount: Number(rawVal),
            rowIdx: r + 1,
          });
        }
      }
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Opening Balance Application to Tenant DB
// ---------------------------------------------------------------------------
async function applyOpeningBalancesToTenant(
  prisma: PrismaClient,
  entries: ExcelOpeningBalanceEntry[],
  companyName: string,
  transactionDate: Date,
) {
  console.log(`\n============================================================`);
  console.log(`📊 Processing Opening Balances for Tenant: ${companyName}`);
  console.log(`📅 Effective Transaction Date: ${transactionDate.toISOString().split('T')[0]}`);
  console.log(`============================================================\n`);

  // STEP 1: Wipe all previous OPENING_BALANCE transactions and revert account balances
  const existingOpeningTxs = await prisma.accountTransaction.findMany({
    where: { sourceType: 'OPENING_BALANCE' },
    include: { account: { select: { id: true, type: true } } },
  });

  console.log(`🧹 Clearing ${existingOpeningTxs.length} previous opening balance transaction(s)...`);

  const accountDeltaMap = new Map<string, number>();
  for (const txRow of existingOpeningTxs) {
    if (!txRow.account) continue;
    const isNormalDebit = txRow.account.type === AccountType.ASSET || txRow.account.type === AccountType.EXPENSE;
    const oldDelta = isNormalDebit
      ? Number(txRow.debit) - Number(txRow.credit)
      : Number(txRow.credit) - Number(txRow.debit);

    accountDeltaMap.set(txRow.accountId, (accountDeltaMap.get(txRow.accountId) || 0) + oldDelta);
  }

  await prisma.$transaction(async (tx) => {
    for (const [accountId, oldDelta] of accountDeltaMap.entries()) {
      if (oldDelta !== 0) {
        await tx.chartOfAccount.update({
          where: { id: accountId },
          data: { balance: { decrement: oldDelta } },
        });
      }
    }

    await tx.accountTransaction.deleteMany({
      where: { sourceType: 'OPENING_BALANCE' },
    });
  });

  console.log(`✅ Previous opening balances cleared cleanly.\n`);

  // STEP 2: Fetch all COA accounts for lookup
  const allAccounts = await prisma.chartOfAccount.findMany({
    select: { id: true, code: true, name: true, type: true, isGroup: true, balance: true },
    orderBy: { code: 'asc' },
  });

  const accountByNormName = new Map<string, typeof allAccounts[0]>();
  const accountByCode = new Map<string, typeof allAccounts[0]>();

  for (const acc of allAccounts) {
    accountByCode.set(acc.code.toLowerCase(), acc);
    accountByNormName.set(normalizeName(acc.name), acc);
  }

  let updatedCount = 0;
  let skippedZeroCount = 0;
  let skippedGroupCount = 0;
  let unmatchedEntries: ExcelOpeningBalanceEntry[] = [];

  // STEP 3: Apply Excel entries one by one
  for (const entry of entries) {
    if (entry.amount === 0) {
      skippedZeroCount++;
      continue;
    }

    const normKey = normalizeName(entry.rawName);
    let matchedAccount = accountByNormName.get(normKey);

    if (!matchedAccount) {
      matchedAccount = accountByCode.get(entry.rawName.toLowerCase());
    }

    if (!matchedAccount) {
      matchedAccount = allAccounts.find(
        a => normalizeName(a.name) === normKey || normalizeName(a.name).includes(normKey) || normKey.includes(normalizeName(a.name))
      );
    }

    if (!matchedAccount) {
      unmatchedEntries.push(entry);
      continue;
    }

    if (matchedAccount.isGroup) {
      console.log(`   ⏭  Skipping Group Account: "${matchedAccount.name}" (${matchedAccount.code}) - Group accounts roll up leaf balances automatically.`);
      skippedGroupCount++;
      continue;
    }

    // Apply the new opening balance entry one by one
    await prisma.$transaction(async (tx) => {
      const account = await tx.chartOfAccount.findUnique({
        where: { id: matchedAccount!.id },
      });

      if (!account) return;

      const debit = entry.type === 'DEBIT' ? entry.amount : 0;
      const credit = entry.type === 'CREDIT' ? entry.amount : 0;
      const delta = calculateDelta(account.type as AccountType, debit, credit);

      const updatedAccount = await tx.chartOfAccount.update({
        where: { id: account.id },
        data: { balance: { increment: delta } },
      });

      const newBalance = Number(updatedAccount.balance);

      await tx.accountTransaction.create({
        data: {
          accountId: account.id,
          debit,
          credit,
          balanceAfter: newBalance,
          sourceType: 'OPENING_BALANCE',
          sourceId: account.id,
          sourceRef: `Opening Balance - ${account.code}`,
          description: `Opening Balance for ${account.name}`,
          transactionDate,
        },
      });
    });

    console.log(
      `   ✅ Updated [${matchedAccount.code}] ${matchedAccount.name} -> ${entry.type} Rs. ${entry.amount.toLocaleString()}`,
    );
    updatedCount++;
  }

  console.log(`\n------------------------------------------------------------`);
  console.log(`🎉 Tenant "${companyName}" Summary:`);
  console.log(`   • Updated Leaf Accounts: ${updatedCount}`);
  console.log(`   • Skipped Group Accounts: ${skippedGroupCount}`);
  console.log(`   • Skipped Zero Amounts:  ${skippedZeroCount}`);
  console.log(`   • Unmatched Entries:     ${unmatchedEntries.length}`);

  if (unmatchedEntries.length > 0) {
    console.log(`\n⚠️ Unmatched Accounts in Excel (No matching COA found):`);
    unmatchedEntries.forEach(u => {
      console.log(`   - Row ${u.rowIdx}: "${u.rawName}" (${u.type}: ${u.amount.toLocaleString()})`);
    });
  }
}

// ---------------------------------------------------------------------------
// Main Execution
// ---------------------------------------------------------------------------
async function main() {
  console.log('🚀 Starting Opening Balance Update from Excel File...\n');

  const fileArgIdx = process.argv.indexOf('--file');
  const excelFilePath =
    fileArgIdx !== -1
      ? process.argv[fileArgIdx + 1]
      : path.join(__dirname, '../OPENING BALANCE 1ST JULY-26.xlsx');

  const tenantArgIdx = process.argv.indexOf('--tenant');
  const targetTenant = tenantArgIdx !== -1 ? process.argv[tenantArgIdx + 1] : null;

  const dateArgIdx = process.argv.indexOf('--date');
  const transactionDate =
    dateArgIdx !== -1
      ? new Date(process.argv[dateArgIdx + 1])
      : new Date('2026-07-01');

  console.log(`📁 Reading Excel File: ${excelFilePath}`);
  const excelEntries = parseExcelFile(excelFilePath);
  console.log(`📋 Total Entries Parsed from Excel: ${excelEntries.length}`);

  const managementUrl = process.env.DATABASE_URL_MANAGEMENT;
  const masterKey     = process.env.MASTER_ENCRYPTION_KEY;

  if (!managementUrl || !masterKey) {
    console.error('❌ DATABASE_URL_MANAGEMENT or MASTER_ENCRYPTION_KEY missing in .env');
    process.exit(1);
  }

  const pool       = new Pool({ connectionString: managementUrl });
  const adapter    = new PrismaPg(pool);
  const mClient    = new ManagementClient({ adapter } as any);

  try {
    const companyWhere = targetTenant ? { dbName: targetTenant } : { status: 'active' };
    const companies = await mClient.company.findMany({ where: companyWhere });

    if (companies.length === 0) {
      console.error(`❌ No active company database matching: ${targetTenant || 'all'}`);
      process.exit(1);
    }

    console.log(`📡 Found ${companies.length} active company database(s). Processing...`);

    for (const company of companies) {
      let connectionString = `postgresql://${company.dbUser}:${company.dbPassword}@${company.dbHost || 'localhost'}:${company.dbPort || 5432}/${company.dbName}?schema=public`;

      if (company.dbPassword) {
        try {
          const decPassword = decrypt(company.dbPassword, masterKey);
          const encUser     = encodeURIComponent(company.dbUser || '');
          const encPassword = encodeURIComponent(decPassword);
          connectionString  = `postgresql://${encUser}:${encPassword}@${company.dbHost || 'localhost'}:${company.dbPort || 5432}/${company.dbName}?schema=public`;
        } catch {
          console.warn(`   ⚠️ Decryption failed for ${company.name}, using stored URL...`);
        }
      }

      const tenantPool    = new Pool({ connectionString });
      const tenantAdapter = new PrismaPg(tenantPool);
      const tenantPrisma  = new PrismaClient({ adapter: tenantAdapter });

      try {
        await tenantPrisma.$connect();
        await applyOpeningBalancesToTenant(tenantPrisma, excelEntries, company.name, transactionDate);
      } finally {
        await tenantPrisma.$disconnect();
        await tenantPool.end();
      }
    }

    console.log('\n✨ All done updating opening balances from Excel!');
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
  } finally {
    await mClient.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
