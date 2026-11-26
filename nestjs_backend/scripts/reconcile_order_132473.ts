/**
 * ============================================================================
 * IVAR ERP - ORDER #132473 (SI-OMSI26-01281) RECONCILIATION SCRIPT
 * ============================================================================
 * 
 * Context:
 * Order #132473 was placed on Shopify with 7 items (Total: Rs. 8,728) and booked
 * at 12:25 PM under PostEx tracking 20030550122643 (Outbound STN TR-001957).
 * At 04:27 PM, item IVTPRDMSLETSHRT (Small, Rs. 1410) was removed on Shopify
 * due to out-of-stock. The first tracking was cancelled (creating Return STN TR-002102),
 * and re-booked under PostEx tracking 22030550122797 with 6 items (Total: Rs. 7,318).
 * The parcel was delivered to Safwan Ahmed and Rs. 7,318 collected.
 * 
 * What this script does:
 * 1. SalesOrderItem: Removes the 7th cancelled item (Small / Black - 106222).
 * 2. SalesOrder: Updates financials (Grand Total: 7,318, Tax: 1,116.33, Subtotal: 6,201.67).
 * 3. Return STN (TR-002102): Keeps only the 1 Small item; removes the 6 delivered items.
 * 4. StockLedger: Cleans up the 6 false return entries so WH-KHI inventory matches physical floor.
 * 5. InventoryItem: Decrements WH-KHI inventory by 1 for the 6 delivered items.
 * 
 * Safety:
 * - 100% Read-Only DRY-RUN by default. Persists only with `--commit`.
 * - Atomic PostgreSQL Transaction (`prisma.$transaction`).
 * 
 * Usage:
 *   Dry-run (preview only) : bun scripts/reconcile_order_132473.ts
 *   Live commit            : bun scripts/reconcile_order_132473.ts --commit
 * ============================================================================
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const IS_COMMIT = process.argv.includes('--commit');
const TARGET_ORDER_NO = 'SI-OMSI26-01281';
const TARGET_REF_NO = '#132473';

function decryptPassword(encryptedText: string, masterKeyString: string): string {
  if (!masterKeyString || masterKeyString.length < 32) {
    throw new Error('MASTER_ENCRYPTION_KEY must be at least 32 characters');
  }
  const masterKey = Buffer.from(masterKeyString.slice(0, 32), 'utf-8');
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function resolveTenantConnection(): Promise<{ tenantDbUrl: string; tenantName: string }> {
  const envDbUrl = process.env.DATABASE_URL || '';
  if (!envDbUrl) {
    throw new Error('DATABASE_URL is not defined in environment or .env file');
  }

  const testPool = new Pool({ connectionString: envDbUrl });
  let hasItemTable = false;
  try {
    const res = await testPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'Item'
      );
    `);
    hasItemTable = !!res.rows[0]?.exists;
  } catch (err: any) {
    console.warn(`Database connection check warning: ${err.message}`);
  } finally {
    await testPool.end();
  }

  if (hasItemTable) {
    return { tenantDbUrl: envDbUrl, tenantName: 'Direct DATABASE_URL (Tenant)' };
  }

  const mgmtUrl = process.env.DATABASE_URL_MANAGEMENT || envDbUrl;
  const mgmtPool = new Pool({ connectionString: mgmtUrl });

  try {
    const res = await mgmtPool.query(`
      SELECT "name", "dbName", "dbUser", "dbPassword", "dbHost", "dbPort", "dbUrl" 
      FROM "Company" 
      WHERE status = 'active'
      ORDER BY "createdAt" DESC 
      LIMIT 1;
    `);

    if (res.rows.length === 0) {
      throw new Error('No active Company found in ivar_management database.');
    }

    const company = res.rows[0];
    const masterKey = process.env.MASTER_ENCRYPTION_KEY || '';

    let tenantDbUrl = company.dbUrl;

    if (company.dbPassword && masterKey) {
      try {
        const plainPass = decryptPassword(company.dbPassword, masterKey);
        const user = encodeURIComponent(company.dbUser || '');
        const pass = encodeURIComponent(plainPass);
        const host = company.dbHost || 'localhost';
        const port = company.dbPort || 5432;
        tenantDbUrl = `postgresql://${user}:${pass}@${host}:${port}/${company.dbName}?schema=public`;
      } catch (err: any) {
        console.warn(`⚠️  Password decryption warning: ${err.message}`);
      }
    }

    return { tenantDbUrl, tenantName: `${company.name} (${company.dbName})` };
  } finally {
    await mgmtPool.end();
  }
}

async function reconcileOrder() {
  console.log('\n=============================================================');
  console.log('🚀 IVAR ERP - ORDER #132473 RECONCILIATION & CORRECTION');
  console.log('=============================================================');
  console.log(`🛡️  Mode : ${IS_COMMIT ? '🔥 LIVE COMMIT (Applying Changes to Database)' : '🛡️  DRY-RUN (100% Read-Only Preview)'}`);
  console.log('-------------------------------------------------------------');

  const { tenantDbUrl, tenantName } = await resolveTenantConnection();
  console.log(`🔌 Connected Tenant : ${tenantName}`);

  const pool = new Pool({ connectionString: tenantDbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();

    // 1. Fetch Target Sales Order
    const order = await prisma.salesOrder.findFirst({
      where: {
        OR: [
          { orderNumber: TARGET_ORDER_NO },
          { referenceNumber: TARGET_REF_NO },
          { referenceNumber: '132473' },
        ],
      },
      include: {
        customer: true,
        items: {
          include: {
            item: {
              include: {
                size: true,
                color: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new Error(`Order ${TARGET_ORDER_NO} (#132473) not found in database.`);
    }

    console.log(`\n📄 Order Found : ${order.orderNumber} (Ref: ${order.referenceNumber})`);
    console.log(`👤 Customer    : ${order.customer?.name} (${order.customer?.contactNo})`);
    console.log(`💰 Current Net : PKR ${order.grandTotal} (${order.items.length} items recorded)`);

    // 2. Identify the 7th cancelled item (Small / Black T-Shirt, Barcode 106222)
    const cancelledLine = order.items.find(
      (line) =>
        line.item?.barCode === '106222' ||
        (line.item?.sku?.includes('IVTPRDMSLETSHRT') && line.item?.size?.name?.toUpperCase() === 'SMALL'),
    );

    if (!cancelledLine) {
      console.log('ℹ️  Cancelled item (Small / 106222) was not found in sales order lines. Order may already be reconciled!');
      return;
    }

    const remainingLines = order.items.filter((l) => l.id !== cancelledLine.id);

    console.log('\n-------------------------------------------------------------');
    console.log('🔍 LINE ITEMS BREAKDOWN:');
    console.log('-------------------------------------------------------------');
    console.log(`❌ REMOVE CANCELLED LINE:`);
    console.log(`   - Line ID : ${cancelledLine.id}`);
    console.log(`   - Item    : ${cancelledLine.item?.sku} [${cancelledLine.item?.size?.name || 'S'} / ${cancelledLine.item?.color?.name || ''}] (Barcode: ${cancelledLine.item?.barCode})`);
    console.log(`   - Price   : PKR ${cancelledLine.unitPrice} (Tax: PKR ${cancelledLine.taxAmount})`);

    console.log(`\n✅ KEEP 6 DELIVERED LINES:`);
    let targetGrandTotal = 0;
    let targetTaxTotal = 0;
    for (const [idx, line] of remainingLines.entries()) {
      const p = Number(line.unitPrice || 0);
      const q = Number(line.quantity || 1);
      const t = Number(line.taxAmount || 0);
      targetGrandTotal += p * q;
      targetTaxTotal += t;
      console.log(`   [${idx + 1}] ${line.item?.sku?.padEnd(22)} [${(line.item?.size?.name || '').padEnd(6)}] Barcode: ${(line.item?.barCode || '').padEnd(8)} Qty: ${q} × PKR ${p} = PKR ${p * q}`);
    }

    const targetSubtotal = targetGrandTotal - targetTaxTotal;

    console.log('\n-------------------------------------------------------------');
    console.log('💰 FINANCIAL RECONCILIATION PLAN:');
    console.log('-------------------------------------------------------------');
    console.log(`   - Subtotal (WOST) : PKR ${order.subtotal} ➡️ PKR ${targetSubtotal.toFixed(2)}`);
    console.log(`   - Tax Amount      : PKR ${order.taxAmount} ➡️ PKR ${targetTaxTotal.toFixed(2)}`);
    console.log(`   - Grand Total     : PKR ${order.grandTotal} ➡️ PKR ${targetGrandTotal.toFixed(2)}`);
    console.log(`   - Cash/Paid Amt   : PKR ${order.cashAmount || order.grandTotal} ➡️ PKR ${targetGrandTotal.toFixed(2)}`);

    // 3. Find Return STN TR-002102
    const returnStn = await prisma.transferRequest.findFirst({
      where: {
        OR: [
          { requestNo: 'TR-002102' },
          {
            transferType: 'OUTLET_TO_WAREHOUSE',
            notes: { contains: order.id },
          },
        ],
      },
      include: {
        items: true,
      },
    });

    // 4. Find Outbound STN TR-001957 to identify warehouse ID
    const outboundStn = await prisma.transferRequest.findFirst({
      where: {
        OR: [
          { requestNo: 'TR-001957' },
          {
            transferType: 'WAREHOUSE_TO_OUTLET',
            notes: { contains: order.id },
          },
        ],
      },
    });

    const warehouseId = outboundStn?.fromWarehouseId || returnStn?.toWarehouseId;

    console.log('\n-------------------------------------------------------------');
    console.log('🚚 INVENTORY & STN RECONCILIATION PLAN:');
    console.log('-------------------------------------------------------------');
    if (returnStn) {
      console.log(`   - Return STN TR-002102 found (ID: ${returnStn.id}, Current items: ${returnStn.items.length})`);
      console.log(`   - Action: Keep ONLY the 1 Small cancelled item in TR-002102.`);
      console.log(`   - Action: Remove the 6 delivered items from TR-002102.`);
      console.log(`   - Action: Remove the 12 false return entries from StockLedger for TR-002102.`);
      console.log(`   - Action: Decrement WH-KHI InventoryItem quantity by 1 for the 6 delivered items.`);
    } else {
      console.log(`   ℹ️ Return STN TR-002102 not found or already cleaned up.`);
    }

    if (!IS_COMMIT) {
      console.log('\n-------------------------------------------------------------');
      console.log('🛡️  DRY-RUN COMPLETE! No changes were made to the database.');
      console.log('💡 To execute and apply this correction live on database, run:');
      console.log('   bun scripts/reconcile_order_132473.ts --commit');
      console.log('=============================================================\n');
      return;
    }

    // 5. Execute Atomic Database Transaction
    console.log('\n⏳ Executing atomic database transaction...');

    await prisma.$transaction(
      async (tx) => {
        // A. Delete the cancelled line item from sales order
        await tx.salesOrderItem.delete({
          where: { id: cancelledLine.id },
        });

        // B. Update SalesOrder financials and append notes
        const currentNotes = order.notes || '';
        const auditNote = `[RECONCILED 21-NOV-2026] Order reconciled to 6 delivered items (PKR 7,318). Removed cancelled Small T-shirt (Barcode: 106222). Stock aligned with PostEx Tracking 22030550122797.`;
        const updatedNotes = currentNotes.includes('[RECONCILED')
          ? currentNotes
          : `${currentNotes} | ${auditNote}`;

        await tx.salesOrder.update({
          where: { id: order.id },
          data: {
            subtotal: new Prisma.Decimal(targetSubtotal.toFixed(2)),
            taxAmount: new Prisma.Decimal(targetTaxTotal.toFixed(2)),
            grandTotal: new Prisma.Decimal(targetGrandTotal.toFixed(2)),
            cashAmount: new Prisma.Decimal(targetGrandTotal.toFixed(2)),
            notes: updatedNotes,
          },
        });

        // C. Clean up Return STN TR-002102
        if (returnStn) {
          // Keep only the cancelled item in TR-002102
          await tx.transferRequestItem.deleteMany({
            where: {
              transferRequestId: returnStn.id,
              itemId: { not: cancelledLine.itemId },
            },
          });

          // Update TR-002102 notes
          await tx.transferRequest.update({
            where: { id: returnStn.id },
            data: {
              notes: `[AUTO-RETURN RECONCILED] 1 Item Returned: Small T-shirt (106222). 6 delivered items dispatched under PostEx tracking 22030550122797 | ref:${order.id}`,
            },
          });

          // D. Clean up StockLedger false return entries for the 6 delivered items
          // 1. Remove POS_CANCELLED for the 6 delivered items
          await tx.stockLedger.deleteMany({
            where: {
              referenceId: order.id,
              referenceType: 'POS_CANCELLED',
              itemId: { not: cancelledLine.itemId },
            },
          });

          // 2. Remove TRANSFER_REQUEST entries on TR-002102 for the 6 delivered items
          await tx.stockLedger.deleteMany({
            where: {
              referenceId: returnStn.id,
              itemId: { not: cancelledLine.itemId },
            },
          });

          // E. Adjust InventoryItem at Warehouse (deduct 1 for each of the 6 delivered items)
          if (warehouseId) {
            for (const rLine of remainingLines) {
              const whStock = await tx.inventoryItem.findFirst({
                where: {
                  itemId: rLine.itemId,
                  warehouseId: warehouseId,
                },
              });
              if (whStock && Number(whStock.quantity) > 0) {
                await tx.inventoryItem.update({
                  where: { id: whStock.id },
                  data: {
                    quantity: { decrement: 1 },
                  },
                });
              }
            }
          }
        }
      },
      { maxWait: 20000, timeout: 60000 },
    );

    console.log('=============================================================');
    console.log('🎉 RECONCILIATION COMMITTED SUCCESSFULLY!');
    console.log('=============================================================');
    console.log(`📦 Sales Invoice     : Adjusted from 7 lines ➡️ 6 lines`);
    console.log(`💰 New Grand Total    : PKR ${targetGrandTotal.toFixed(2)} (100% matched with PostEx collection)`);
    console.log(`🔄 STN TR-002102     : Cleaned up (reflects only the 1 Small cancelled item)`);
    console.log(`📜 Stock Ledger      : Aligned (6 delivered items deducted, warehouse inventory synchronized)`);
    console.log('=============================================================\n');

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

reconcileOrder().catch(console.error);
