import 'dotenv/config';
import { PrismaClient as ManagementClient } from '@prisma/management-client';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as crypto from 'crypto';

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
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(algorithm, masterKey, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function getPrismaClient(): Promise<PrismaClient> {
  const explicitTenantUrl = process.env.DATABASE_URL_TENANT;
  if (explicitTenantUrl && !explicitTenantUrl.includes('ivar_managements')) {
    const pool = new Pool({ connectionString: explicitTenantUrl });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter } as any);
  }

  const managementUrl = process.env.DATABASE_URL_MANAGEMENT || process.env.DATABASE_URL;
  const masterKey = process.env.MASTER_ENCRYPTION_KEY;

  if (managementUrl && masterKey) {
    const mPool = new Pool({ connectionString: managementUrl });
    const mAdapter = new PrismaPg(mPool);
    const mClient = new ManagementClient({ adapter: mAdapter } as any);

    try {
      await mClient.$connect();
      const company = await mClient.company.findFirst({
        where: { status: 'active' },
      });

      if (company) {
        let connectionString = company.dbUrl;
        if (company.dbPassword) {
          try {
            const decPassword = decrypt(company.dbPassword, masterKey);
            const encUser = encodeURIComponent(company.dbUser || '');
            const encPassword = encodeURIComponent(decPassword);
            connectionString = `postgresql://${encUser}:${encPassword}@${company.dbHost || 'localhost'}:${company.dbPort || 5432}/${company.dbName}?schema=public`;
          } catch (e) {
            console.warn('⚠️ Password decryption failed, using company.dbUrl fallback');
          }
        }

        if (connectionString) {
          console.log(`✅ Connected to tenant: ${company.name} (${company.dbName})`);
          await mClient.$disconnect();
          await mPool.end();

          const tPool = new Pool({ connectionString });
          const tAdapter = new PrismaPg(tPool);
          return new PrismaClient({ adapter: tAdapter } as any);
        }
      }
    } catch (err: any) {
      console.warn(`⚠️ Management DB lookup error: ${err.message}`);
    } finally {
      await mClient.$disconnect().catch(() => {});
      await mPool.end().catch(() => {});
    }
  }

  const defaultUrl = process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/ivar_erp?schema=public';
  const fallbackPool = new Pool({ connectionString: defaultUrl });
  const fallbackAdapter = new PrismaPg(fallbackPool);
  return new PrismaClient({ adapter: fallbackAdapter } as any);
}

async function audit() {
  const targetTRs = [
    // BKC
    'TR-000116', 'TR-000063', 'TR-000030',
    // 9 Duplicated TRs
    'TR-000008', 'TR-000088', 'TR-000186', 'TR-000204', 'TR-000210', 'TR-000211', 'TR-000212', 'TR-000217', 'TR-000226',
    // DHA Lahore
    'TR-000249'
  ];

  const prisma = await getPrismaClient();

  try {
    for (const trNo of targetTRs) {
      const tr = await prisma.transferRequest.findFirst({
        where: { requestNo: trNo },
        include: {
          items: true,
          fromWarehouse: { select: { name: true } },
          toLocation: { select: { name: true } }
        }
      });

      if (!tr) {
        console.log(`❌ Transfer Request ${trNo} not found in database.`);
        continue;
      }

      const totalTrQty = tr.items.reduce((sum, item) => sum + Number(item.quantity), 0);
      const totalFulfilledQty = tr.items.reduce((sum, item) => sum + Number(item.fulfilledQty || 0), 0);

      // Check stock ledgers referencing this TR (either by ID or requestNo)
      const ledgers = await prisma.stockLedger.findMany({
        where: {
          OR: [
            { referenceId: tr.id },
            { referenceId: tr.requestNo }
          ]
        },
        orderBy: { createdAt: 'asc' }
      });

      const totalLedgerQtyAbs = ledgers.reduce((sum, l) => sum + Math.abs(Number(l.qty)), 0);

      // Group by itemId, warehouseId, abs(qty) to detect exact duplicates
      const itemGroupMap = new Map<string, typeof ledgers>();
      for (const l of ledgers) {
        const key = `${l.itemId}_${l.warehouseId}_${Math.abs(Number(l.qty))}`;
        if (!itemGroupMap.has(key)) itemGroupMap.set(key, []);
        itemGroupMap.get(key)!.push(l);
      }

      let duplicateLedgerCount = 0;
      let duplicateQty = 0;
      for (const group of itemGroupMap.values()) {
        if (group.length > 1) {
          // Extra copies
          for (let i = 1; i < group.length; i++) {
            duplicateLedgerCount++;
            duplicateQty += Math.abs(Number(group[i].qty));
          }
        }
      }

      console.log(`\n📌 [${tr.requestNo}] (${tr.fromWarehouse?.name || 'WH'} -> ${tr.toLocation?.name || 'Loc'})`);
      console.log(`   ID: ${tr.id} | Status: ${tr.status}`);
      console.log(`   Items in TR: ${tr.items.length} lines | Total Req Qty: ${totalTrQty} | FulfilledQty: ${totalFulfilledQty}`);
      console.log(`   StockLedgers found: ${ledgers.length} rows | Total Ledger Abs Qty: ${totalLedgerQtyAbs}`);
      console.log(`   Duplicate Ledger Entries: ${duplicateLedgerCount} extra rows | Duplicate Qty: ${duplicateQty}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

audit();
