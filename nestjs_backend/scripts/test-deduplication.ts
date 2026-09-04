import 'dotenv/config';
import { PrismaClient as ManagementClient } from '@prisma/management-client';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as crypto from 'crypto';

function decrypt(encryptedText: string, masterKeyString: string): string {
  const masterKey = Buffer.from(masterKeyString.slice(0, 32), 'utf-8');
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}

async function getPrismaClient(): Promise<PrismaClient> {
  const explicitTenantUrl = process.env.DATABASE_URL_TENANT;
  if (explicitTenantUrl && !explicitTenantUrl.includes('ivar_managements')) {
    const pool = new Pool({ connectionString: explicitTenantUrl });
    return new PrismaClient({ adapter: new PrismaPg(pool) } as any);
  }
  const managementUrl = process.env.DATABASE_URL_MANAGEMENT || process.env.DATABASE_URL;
  const masterKey = process.env.MASTER_ENCRYPTION_KEY;
  const mPool = new Pool({ connectionString: managementUrl });
  const mClient = new ManagementClient({ adapter: new PrismaPg(mPool) } as any);
  await mClient.$connect();
  const company = await mClient.company.findFirst({ where: { status: 'active' } });
  const decPassword = decrypt(company!.dbPassword!, masterKey!);
  const encUser = encodeURIComponent(company!.dbUser || '');
  const encPassword = encodeURIComponent(decPassword);
  const connectionString = `postgresql://${encUser}:${encPassword}@${company!.dbHost || 'localhost'}:${company!.dbPort || 5432}/${company!.dbName}?schema=public`;
  await mClient.$disconnect();
  await mPool.end();
  const tPool = new Pool({ connectionString });
  return new PrismaClient({ adapter: new PrismaPg(tPool) } as any);
}

async function testDeduplicationPlan() {
  const targetTRs = [
    // BKC (Bukhari Commercial)
    'TR-000116', 'TR-000063', 'TR-000030',
    // 9 Duplicated TRs (DHA Lahore & others)
    'TR-000008', 'TR-000088', 'TR-000186', 'TR-000204', 'TR-000210', 'TR-000211', 'TR-000212', 'TR-000217', 'TR-000226',
    // DHA Lahore / Sharfabad
    'TR-000249'
  ];

  const prisma = await getPrismaClient();

  try {
    let grandTotalLedgers = 0;
    let grandTotalKeep = 0;
    let grandTotalDelete = 0;
    let grandTotalDeletedQty = 0;

    console.log(`\n================ SIMULATING DEDUPLICATION ================`);

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
        console.log(`❌ ${trNo} not found`);
        continue;
      }

      const ledgers = await prisma.stockLedger.findMany({
        where: {
          OR: [{ referenceId: tr.id }, { referenceId: tr.requestNo }]
        },
        orderBy: { createdAt: 'asc' }
      });

      // Group by unique movement signature: itemId + movementType + warehouseId + (locationId || 'NULL')
      const groups = new Map<string, typeof ledgers>();
      for (const l of ledgers) {
        const key = `${l.itemId}__${l.movementType}__${l.warehouseId}__${l.locationId || 'NULL'}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(l);
      }

      const keepIds: string[] = [];
      const deleteIds: string[] = [];
      let trDeletedQty = 0;

      for (const [key, rows] of groups.entries()) {
        // Keep the earliest one (index 0)
        keepIds.push(rows[0].id);

        // Delete any subsequent duplicate copies (index 1..n)
        for (let i = 1; i < rows.length; i++) {
          deleteIds.push(rows[i].id);
          // Count excess quantity (for INBOUND to outlet or abs qty)
          if (rows[i].movementType === 'INBOUND') {
            trDeletedQty += Number(rows[i].qty);
          }
        }
      }

      const expectedOriginalItems = tr.items.length;
      const expectedOriginalLedgerPairs = expectedOriginalItems * 2; // 1 OUTBOUND + 1 INBOUND

      console.log(`\n📋 ${tr.requestNo} [${tr.toLocation?.name}]:`);
      console.log(`   TR Item Lines: ${expectedOriginalItems} | Total DN Qty: ${tr.items.reduce((s, i) => s + Number(i.quantity), 0)}`);
      console.log(`   Total Ledgers in DB: ${ledgers.length} rows`);
      console.log(`   Expected to KEEP: ${keepIds.length} rows (pairs: ${keepIds.length / 2})`);
      console.log(`   Duplicate rows to DELETE: ${deleteIds.length} rows`);
      console.log(`   Excess Outlet Qty Removed: ${trDeletedQty} units`);

      grandTotalLedgers += ledgers.length;
      grandTotalKeep += keepIds.length;
      grandTotalDelete += deleteIds.length;
      grandTotalDeletedQty += trDeletedQty;
    }

    console.log(`\n================ GRAND TOTAL SUMMARY ================`);
    console.log(`Total Ledgers across 13 TRs: ${grandTotalLedgers}`);
    console.log(`Total Rows to KEEP:           ${grandTotalKeep}`);
    console.log(`Total Rows to DELETE:         ${grandTotalDelete}`);
    console.log(`Total Excess Outlet Qty:      ${grandTotalDeletedQty} units`);
    console.log(`=====================================================\n`);
  } finally {
    await prisma.$disconnect();
  }
}

testDeduplicationPlan();
