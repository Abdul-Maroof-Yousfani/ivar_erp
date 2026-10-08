import 'dotenv/config';
import { PrismaClient as ManagementClient } from '@prisma/management-client';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

function decrypt(encryptedText: string, masterKeyString: string): string {
  if (!masterKeyString || masterKeyString.length < 32) {
    throw new Error('MASTER_ENCRYPTION_KEY must be at least 32 characters');
  }
  const masterKey = Buffer.from(masterKeyString.slice(0, 32), 'utf-8');
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}

async function getPrismaClient(): Promise<{ prisma: PrismaClient; dbName: string }> {
  const explicitTenantUrl = process.env.DATABASE_URL_TENANT;
  if (explicitTenantUrl && !explicitTenantUrl.includes('ivar_managements')) {
    console.log('🔗 Connecting via explicit DATABASE_URL_TENANT...');
    const pool = new Pool({ connectionString: explicitTenantUrl });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);
    return { prisma, dbName: 'tenant (custom)' };
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
  const prisma = new PrismaClient({ adapter: new PrismaPg(tPool) } as any);
  return { prisma, dbName: company!.dbName };
}

async function main() {
  const isExecute = process.argv.includes('--execute');
  const fixInventory = process.argv.includes('--fix-inventory');
  const allTRs = process.argv.includes('--all');

  const TARGET_13_TRS = [
    // BKC (Bukhari Commercial)
    'TR-000116', 'TR-000063', 'TR-000030',
    // 9 Duplicated TRs (DHA Lahore)
    'TR-000008', 'TR-000088', 'TR-000186', 'TR-000204', 'TR-000210', 'TR-000211', 'TR-000212', 'TR-000217', 'TR-000226',
    // Sharfabad / DHA Lahore
    'TR-000249'
  ];

  console.log(`\n================================================================`);
  console.log(`🧹 STOCK LEDGER DUPLICATE CLEANUP SCRIPT`);
  console.log(`Mode: ${isExecute ? '⚡ LIVE EXECUTION (DELETING DUPLICATES)' : '🔍 DRY RUN (NO CHANGES APPLIED)'}`);
  console.log(`Scope: ${allTRs ? '🌐 ALL AFFECTED TRs' : '🎯 TARGET 13 TRs (BKC, 9 TRs, TR-000249)'}`);
  console.log(`Fix InventoryItem balances: ${fixInventory ? 'YES' : 'NO (stock_ledgers only)'}`);
  console.log(`================================================================\n`);

  const { prisma, dbName } = await getPrismaClient();

  try {
    // 1. Get Transfer Requests
    let trFilter: any = {};
    if (!allTRs) {
      trFilter = { requestNo: { in: TARGET_13_TRS } };
    }

    const trList = await prisma.transferRequest.findMany({
      where: trFilter,
      select: { id: true, requestNo: true, status: true, toLocationId: true, fromWarehouseId: true }
    });

    const trIdToRequestNo = new Map(trList.map(t => [t.id, t.requestNo]));
    const targetIds = trList.map(t => t.id);

    // 2. Query duplicates using ROW_NUMBER() window function
    // For each unique (reference_id, item_id, movement_type, warehouse_id, COALESCE(location_id, ''))
    // Keep row_num = 1, duplicate rows have row_num > 1.
    const duplicateRows = await prisma.$queryRaw<Array<{
      id: string;
      item_id: string;
      warehouse_id: string;
      location_id: string | null;
      movement_type: string;
      reference_type: string;
      reference_id: string;
      qty: string;
      created_at: Date;
      row_num: number;
    }>>`
      WITH ranked_ledgers AS (
        SELECT 
          id, item_id, warehouse_id, location_id, movement_type, reference_type, reference_id, qty, created_at,
          ROW_NUMBER() OVER (
            PARTITION BY reference_id, item_id, movement_type, warehouse_id, COALESCE(location_id, '')
            ORDER BY created_at ASC, id ASC
          ) as row_num
        FROM stock_ledgers
        WHERE reference_type = 'TRANSFER_REQUEST'
          AND reference_id = ANY(${targetIds}::text[])
      )
      SELECT *
      FROM ranked_ledgers
      WHERE row_num > 1
      ORDER BY reference_id, item_id, created_at ASC;
    `;

    console.log(`📊 Found ${duplicateRows.length} duplicate stock ledger rows across ${trList.length} transfer requests.`);

    // Group summary by TR
    const trSummary = new Map<string, { count: number; excessInboundQty: number; excessOutboundQty: number }>();
    for (const r of duplicateRows) {
      const trNo = trIdToRequestNo.get(r.reference_id) || r.reference_id;
      if (!trSummary.has(trNo)) {
        trSummary.set(trNo, { count: 0, excessInboundQty: 0, excessOutboundQty: 0 });
      }
      const s = trSummary.get(trNo)!;
      s.count++;
      if (r.movement_type === 'INBOUND') {
        s.excessInboundQty += Number(r.qty);
      } else if (r.movement_type === 'OUTBOUND') {
        s.excessOutboundQty += Math.abs(Number(r.qty));
      }
    }

    console.log(`\n📋 Breakdown per Transfer Request:`);
    console.log(`---------------------------------------------------------------------------------------`);
    console.log(`Request No   | Duplicate Rows | Excess Outlet Qty (IN) | Excess WH Deducted (OUT)`);
    console.log(`---------------------------------------------------------------------------------------`);
    let totalInboundExcess = 0;
    for (const [trNo, s] of trSummary.entries()) {
      console.log(`${trNo.padEnd(12)} | ${String(s.count).padEnd(14)} | ${String(s.excessInboundQty).padEnd(22)} | ${String(s.excessOutboundQty)}`);
      totalInboundExcess += s.excessInboundQty;
    }
    console.log(`---------------------------------------------------------------------------------------`);
    console.log(`TOTAL        | ${String(duplicateRows.length).padEnd(14)} | ${String(totalInboundExcess).padEnd(22)} units\n`);

    const duplicateIds = duplicateRows.map(r => r.id);

    // 3. Generate pure SQL script for live database deployment
    const backupTableName = `stock_ledgers_backup_tr_duplicates`;
    const sqlCommands = [
      `-- ====================================================================`,
      `-- DUPLICATE STOCK LEDGER CLEANUP SCRIPT FOR DATABASE: ${dbName}`,
      `-- Generated: ${new Date().toISOString()}`,
      `-- Total duplicate rows: ${duplicateRows.length}`,
      `-- Total excess transferred units: ${totalInboundExcess}`,
      `-- ====================================================================`,
      `BEGIN;`,
      ``,
      `-- 1. Create backup table containing exactly the rows to be deleted`,
      `CREATE TABLE IF NOT EXISTS ${backupTableName} AS`,
      `SELECT * FROM stock_ledgers WHERE id IN (`,
      duplicateIds.map(id => `  '${id}'`).join(',\n'),
      `);`,
      ``,
      `-- 2. Grant permissions to tenant and admin users`,
      `GRANT ALL ON ${backupTableName} TO ivar_admin, user_ivar_mo2z612h;`,
      ``,
      `-- 3. Delete the duplicate stock ledger records`,
      `DELETE FROM stock_ledgers WHERE id IN (`,
      duplicateIds.map(id => `  '${id}'`).join(',\n'),
      `);`,
      ``
    ];

    if (fixInventory) {
      sqlCommands.push(`-- 4. Adjust inventory_items balances to reflect the removal of duplicate transfers`);
      // For each duplicate row:
      // If INBOUND (outlet): decrement inventory_items quantity by qty
      // If OUTBOUND (warehouse): increment inventory_items quantity by abs(qty)
      const invAdjustments = new Map<string, { itemId: string; warehouseId: string; locationId: string | null; deltaQty: number }>();
      for (const r of duplicateRows) {
        const loc = r.location_id || null;
        const key = `${r.item_id}__${r.warehouse_id}__${loc || 'NULL'}`;
        if (!invAdjustments.has(key)) {
          invAdjustments.set(key, { itemId: r.item_id, warehouseId: r.warehouse_id, locationId: loc, deltaQty: 0 });
        }
        const adj = invAdjustments.get(key)!;
        if (r.movement_type === 'INBOUND') {
          // Remove duplicate inbound -> decrease outlet stock
          adj.deltaQty -= Number(r.qty);
        } else if (r.movement_type === 'OUTBOUND') {
          // Remove duplicate outbound -> restore warehouse stock
          adj.deltaQty += Math.abs(Number(r.qty));
        }
      }

      for (const adj of invAdjustments.values()) {
        if (adj.deltaQty === 0) continue;
        if (adj.locationId) {
          sqlCommands.push(
            `UPDATE inventory_items SET quantity = quantity + (${adj.deltaQty}) WHERE item_id = '${adj.itemId}' AND location_id = '${adj.locationId}';`
          );
        } else {
          sqlCommands.push(
            `UPDATE inventory_items SET quantity = quantity + (${adj.deltaQty}) WHERE item_id = '${adj.itemId}' AND warehouse_id = '${adj.warehouseId}' AND location_id IS NULL;`
          );
        }
      }
    }

    sqlCommands.push(`COMMIT;`);

    const sqlFilePath = path.join(__dirname, 'cleanup-tr-duplicates.sql');
    fs.writeFileSync(sqlFilePath, sqlCommands.join('\n'), 'utf-8');
    console.log(`💾 Pure SQL script written to: ${sqlFilePath}`);

    // 4. Execution if --execute flag is passed
    if (isExecute) {
      console.log(`\n⏳ Executing cleanup inside an atomic transaction on ${dbName}...`);
      await prisma.$transaction(async (tx) => {
        // Step 1: Create backup table
        console.log(`   📦 Backing up ${duplicateIds.length} rows to ${backupTableName}...`);
        await tx.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS ${backupTableName} (LIKE stock_ledgers INCLUDING ALL);
        `);
        await tx.$executeRawUnsafe(`
          INSERT INTO ${backupTableName}
          SELECT * FROM stock_ledgers WHERE id = ANY($1::text[])
          ON CONFLICT (id) DO NOTHING;
        `, duplicateIds);

        // Step 2: Delete duplicate stock ledgers
        console.log(`   🗑️ Deleting ${duplicateIds.length} duplicate stock ledger rows...`);
        const delResult = await tx.stockLedger.deleteMany({
          where: { id: { in: duplicateIds } }
        });
        console.log(`   ✅ Successfully deleted ${delResult.count} duplicate stock ledger rows.`);

        // Step 3: Optional inventoryItem adjustment
        if (fixInventory) {
          console.log(`   ⚖️ Aggregating inventory_items adjustments...`);
          // Group adjustments by (itemId, locationId) for INBOUND and (itemId, warehouseId) for OUTBOUND
          const outletAdjustments = new Map<string, { itemId: string; locationId: string; totalDecrement: number }>();
          const whAdjustments = new Map<string, { itemId: string; warehouseId: string; totalIncrement: number }>();

          for (const r of duplicateRows) {
            const qtyNum = Number(r.qty);
            if (r.movement_type === 'INBOUND' && r.location_id) {
              const key = `${r.item_id}__${r.location_id}`;
              if (!outletAdjustments.has(key)) {
                outletAdjustments.set(key, { itemId: r.item_id, locationId: r.location_id, totalDecrement: 0 });
              }
              outletAdjustments.get(key)!.totalDecrement += qtyNum;
            } else if (r.movement_type === 'OUTBOUND') {
              const key = `${r.item_id}__${r.warehouse_id}`;
              if (!whAdjustments.has(key)) {
                whAdjustments.set(key, { itemId: r.item_id, warehouseId: r.warehouse_id, totalIncrement: 0 });
              }
              whAdjustments.get(key)!.totalIncrement += Math.abs(qtyNum);
            }
          }

          console.log(`   ⚖️ Applying adjustments to ${outletAdjustments.size} outlet inventory items...`);
          for (const adj of outletAdjustments.values()) {
            await tx.inventoryItem.updateMany({
              where: { itemId: adj.itemId, locationId: adj.locationId },
              data: { quantity: { decrement: adj.totalDecrement } }
            });
          }

          console.log(`   ⚖️ Applying adjustments to ${whAdjustments.size} warehouse inventory items...`);
          for (const adj of whAdjustments.values()) {
            await tx.inventoryItem.updateMany({
              where: { itemId: adj.itemId, warehouseId: adj.warehouseId, locationId: null },
              data: { quantity: { increment: adj.totalIncrement } }
            });
          }

          console.log(`   ✅ Inventory items adjusted successfully.`);
        }
      }, { timeout: 60000 });

      console.log(`\n🎉 CLEANUP COMPLETED SUCCESSFULLY ON ${dbName}!`);
    } else {
      console.log(`\nℹ️ This was a DRY RUN. No rows were deleted.`);
      console.log(`👉 To execute on LOCAL database:`);
      console.log(`   bun scripts/cleanup-stock-ledger-duplicates.ts --execute`);
      console.log(`👉 To execute on LOCAL database with inventory adjustment:`);
      console.log(`   bun scripts/cleanup-stock-ledger-duplicates.ts --execute --fix-inventory`);
      console.log(`👉 To execute on LIVE database:`);
      console.log(`   Execute the generated 'scripts/cleanup-tr-duplicates.sql' on the live database,`);
      console.log(`   OR run with: DATABASE_URL_TENANT="<live_db_url>" bun scripts/cleanup-stock-ledger-duplicates.ts --execute\n`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
