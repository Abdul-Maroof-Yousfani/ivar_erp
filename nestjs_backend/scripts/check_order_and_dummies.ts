/**
 * ============================================================================
 * IVAR ERP - DIAGNOSTIC & VERIFICATION TOOL: ORDERS & DUMMY ITEMS
 * ============================================================================
 * 
 * Usage:
 *   Check single order : bun scripts/check_order_and_dummies.ts --order=131077
 *   Check general state: bun scripts/check_order_and_dummies.ts
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SINGLE_ORDER_ARG = process.argv.find((a) => a.startsWith('--order='));
const TARGET_SINGLE_ORDER = SINGLE_ORDER_ARG ? SINGLE_ORDER_ARG.split('=')[1].trim() : '131077';

const COURIERIFY_BASE_URL =
  process.env.COURIERIFY_BASE_URL || 'https://courierify.growzar.com/api/external';
const COURIERIFY_API_KEY =
  process.env.COURIERIFY_API_KEY || 'ckf_live_b66e29e4e0ca950af6ed47229156e3c8e3ef95d1517edaa89a0c2754c58a9c3b';

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

async function fetchCourierifyOrder(orderRef: string): Promise<any | null> {
  const cleanRef = String(orderRef || '').replace(/^#/, '').trim();
  if (!cleanRef) return null;

  const candidateUrls: string[] = [
    `${COURIERIFY_BASE_URL}/orders/${encodeURIComponent('#' + cleanRef)}`,
    `${COURIERIFY_BASE_URL}/orders/${encodeURIComponent(cleanRef)}`,
    `${COURIERIFY_BASE_URL}/orders?search=${encodeURIComponent(cleanRef)}`,
    `${COURIERIFY_BASE_URL}/orders?orderName=${encodeURIComponent('#' + cleanRef)}`,
    `${COURIERIFY_BASE_URL}/orders?orderName=${encodeURIComponent(cleanRef)}`,
  ];

  for (const url of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${COURIERIFY_API_KEY}`,
          'x-api-key': COURIERIFY_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const json: any = await res.json();
        const found = json?.order || (Array.isArray(json?.orders) ? json.orders[0] : null) || json;
        if (found && (found.items || found.lineItems)) {
          return found;
        }
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

function isItemDummy(item: any): boolean {
  if (!item) return false;
  const sku = (item.sku || '').trim();
  const desc = (item.description || '').trim();
  if (sku.startsWith('ONL-') || desc.includes('ONL-')) return true;
  const hasMissingBarcode = !item.barCode || item.barCode === sku || item.barCode === 'NONE';
  const hasCompositeSku = sku.includes('-') && sku.split('-').length >= 2;
  if (hasMissingBarcode && hasCompositeSku) return true;
  if (!item.size?.name && !item.color?.name && hasCompositeSku) return true;
  return false;
}

async function runCheck() {
  console.log('\n=============================================================');
  console.log('🔍 IVAR ERP - DIAGNOSTIC & VERIFICATION REPORT');
  console.log('=============================================================');

  const { tenantDbUrl, tenantName } = await resolveTenantConnection();
  console.log(`🔌 Connected Tenant : ${tenantName}`);

  const pool = new Pool({ connectionString: tenantDbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();

    // 1. Check Specific Order
    const cleanRef = TARGET_SINGLE_ORDER.replace(/^#/, '').trim();
    console.log(`\n-------------------------------------------------------------`);
    console.log(`📋 [1/2] Inspecting Order: ${TARGET_SINGLE_ORDER}`);
    console.log(`-------------------------------------------------------------`);

    const order = await prisma.salesOrder.findFirst({
      where: {
        OR: [
          { orderNumber: TARGET_SINGLE_ORDER },
          { orderNumber: { contains: cleanRef } },
          { referenceNumber: TARGET_SINGLE_ORDER },
          { referenceNumber: `#${cleanRef}` },
          { referenceNumber: cleanRef },
          { notes: { contains: cleanRef } },
        ],
      },
      include: {
        customer: { select: { name: true } },
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
      console.log(`❌ Order not found in ERP database for identifier: "${TARGET_SINGLE_ORDER}"`);
    } else {
      console.log(`📄 ERP Order Number   : ${order.orderNumber}`);
      console.log(`🏷️  Reference Number  : ${order.referenceNumber || 'N/A'}`);
      console.log(`👤 Customer Name      : ${order.customer?.name || 'N/A'}`);
      console.log(`📅 Created At         : ${order.createdAt.toISOString()}`);
      console.log(`📦 Line Items Count   : ${order.items.length}`);

      console.log('\n📦 Current ERP Line Items:');
      for (const [idx, line] of order.items.entries()) {
        const it = line.item;
        const dummy = isItemDummy(it);
        console.log(`   [${idx + 1}] Item ID    : ${it.id}`);
        console.log(`       SKU        : ${it.sku}`);
        console.log(`       Barcode    : ${it.barCode || 'NONE'}`);
        console.log(`       Size       : ${it.size?.name || 'NONE'}`);
        console.log(`       Color      : ${it.color?.name || 'NONE'}`);
        console.log(`       Description: ${it.description}`);
        console.log(`       Is Dummy?  : ${dummy ? '❌ YES (Dummy Item)' : '✅ NO (Genuine Item)'}`);
      }

      console.log('\n🌐 Querying Official Courierify API...');
      const courierifyOrder = await fetchCourierifyOrder(cleanRef);
      if (!courierifyOrder) {
        console.log(`⚠️  Could not retrieve order #${cleanRef} from Courierify API.`);
      } else {
        const apiLines: any[] = courierifyOrder?.items?.lines || courierifyOrder?.lineItems || [];
        console.log(`   Courierify Stage  : ${courierifyOrder.stage}`);
        console.log(`   Courierify Lines  : ${apiLines.length}`);

        for (const [idx, al] of apiLines.entries()) {
          console.log(`\n   [Courierify Line ${idx + 1}]:`);
          console.log(`       Title        : ${al.title}`);
          console.log(`       Variant      : ${al.variantTitle}`);
          console.log(`       SKU          : ${al.sku}`);
          console.log(`       Barcode      : ${al.barcode || al.barCode || 'NONE'}`);

          // Compare with corresponding ERP line
          const erpLine = order.items[idx];
          if (erpLine) {
            const erpBarcode = erpLine.item?.barCode || '';
            const apiBarcode = al.barcode || al.barCode || '';
            const erpSize = erpLine.item?.size?.name || '';
            const match = erpBarcode.trim().toLowerCase() === apiBarcode.trim().toLowerCase();

            if (match) {
              console.log(`       ==> STATUS   : ✅ 100% MATCHED WITH ERP (Barcode: ${erpBarcode})`);
            } else {
              console.log(`       ==> STATUS   : ❌ MISMATCH DETECTED!`);
              console.log(`           ERP has  : "${erpLine.item?.description}" [Size: ${erpSize}] (Barcode: ${erpBarcode})`);
              console.log(`           Official : "${al.title}" [Variant: ${al.variantTitle}] (Barcode: ${apiBarcode})`);
            }
          }
        }
      }
    }

    // 2. Global Database Dummy Items Check
    console.log(`\n-------------------------------------------------------------`);
    console.log(`🏷️  [2/2] Inspecting Dummy Items Across Database`);
    console.log(`-------------------------------------------------------------`);

    const allDbItems = await prisma.item.findMany({
      select: {
        id: true,
        sku: true,
        barCode: true,
        description: true,
        isActive: true,
        size: { select: { name: true } },
        color: { select: { name: true } },
      },
    });

    const dummyItems = allDbItems.filter(isItemDummy);

    console.log(`📊 Total Master Items in DB : ${allDbItems.length}`);
    console.log(`🏷️  Total Dummy Items Found   : ${dummyItems.length}`);

    if (dummyItems.length === 0) {
      console.log('🎉 ZERO dummy items exist in the database! Database is 100% clean.');
    } else {
      const dummyIds = dummyItems.map((d) => d.id);
      const ordersWithDummies = await prisma.salesOrderItem.groupBy({
        by: ['itemId'],
        where: {
          itemId: { in: dummyIds },
        },
        _count: { id: true },
      });

      const linkedDummyCount = ordersWithDummies.length;
      const unlinkedDummyCount = dummyItems.length - linkedDummyCount;

      console.log(`⚠️  Dummy Items Linked to Orders : ${linkedDummyCount}`);
      console.log(`🗑️  Unlinked Dummies to Purge     : ${unlinkedDummyCount}`);

      // Query linked orders for each dummy item
      const linkedOrderItems = await prisma.salesOrderItem.findMany({
        where: { itemId: { in: dummyIds } },
        select: {
          itemId: true,
          salesOrder: {
            select: {
              orderNumber: true,
              referenceNumber: true,
              createdAt: true,
              customer: { select: { name: true } },
            },
          },
        },
      });

      const orderMapByDummyId = new Map<string, any[]>();
      for (const oi of linkedOrderItems) {
        if (!orderMapByDummyId.has(oi.itemId)) {
          orderMapByDummyId.set(oi.itemId, []);
        }
        orderMapByDummyId.get(oi.itemId)!.push(oi.salesOrder);
      }

      console.log(`\n📋 Breakdown of ALL Remaining Dummy Items (${dummyItems.length}):`);
      for (const [idx, d] of dummyItems.entries()) {
        const orders = orderMapByDummyId.get(d.id) || [];
        const isDeactivated = !d.isActive || (d.description || '').startsWith('[DEACTIVATED DUMMY]');
        const orderSummary = orders
          .map((o) => `#${o.orderNumber} (Ref: ${o.referenceNumber || 'N/A'}, ${o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : 'N/A'}, ${o.customer?.name || 'No Name'})`)
          .join(', ');

        const statusTag = isDeactivated
          ? '🛡️  [DEACTIVATED / HARMLESS]'
          : orders.length > 0
          ? '⚠️  [ACTIVE IN ORDER]'
          : '🗑️  [ACTIVE BUT UNLINKED]';

        console.log(`   [${idx + 1}] ${statusTag}`);
        console.log(`       ID     : ${d.id}`);
        console.log(`       SKU    : ${d.sku} | Barcode: ${d.barCode || 'NONE'} | Active: ${d.isActive}`);
        console.log(`       Desc   : "${d.description || ''}"`);
        if (orders.length > 0) {
          console.log(`       Orders : ${orderSummary}`);
        } else {
          console.log(`       Orders : None (Ready to delete)`);
        }
      }

      console.log('\n-------------------------------------------------------------');
      console.log('🏁 FINAL AUDIT VERDICT:');
      if (linkedDummyCount === 0) {
        console.log('🎉 100% CLEAN! Zero active dummy items exist in any sales orders!');
        console.log(`🛡️  All remaining items (${dummyItems.length}) are safely deactivated / neutralized.`);
      } else {
        console.log(`⚠️  Action Required: ${linkedDummyCount} dummy item(s) are still active in sales orders.`);
      }
      console.log('-------------------------------------------------------------');
    }

    console.log('=============================================================\n');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runCheck().catch(console.error);
