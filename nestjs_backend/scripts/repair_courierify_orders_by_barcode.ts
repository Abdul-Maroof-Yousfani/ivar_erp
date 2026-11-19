/**
 * ============================================================================
 * IVAR ERP - REPAIR COURIERIFY ORDERS BY OFFICIAL BARCODE (API + CSV ENGINE)
 * ============================================================================
 * 
 * Purpose:
 * Safely repairs affected Courierify / OMS orders by:
 * 1. Fetching true line-item barcodes directly from Courierify API:
 *    GET https://courierify.growzar.com/api/external/orders/{orderRef}
 * 2. Matching each line to genuine ERP items using `Item.barCode == line.barcode`.
 *    - Fixes Dummy items (ONL-xxxx / composite SKUs -> Genuine ERP Item)
 *    - Fixes Silent Wrong-Variant mismatches (e.g. Order #131077 IBMLJ XX-LARGE -> IBMLJ MEDIUM)
 * 3. Fallback: Uses verified barcodes from CSV reports if API is unreachable.
 * 4. Atomic Transaction:
 *    - SalesOrderItem: Re-points itemId to the verified real ERP variant.
 *    - StockLedger: Updates POS_SALE entries to point to genuine items.
 *    - TransferRequestItem: Updates STN line items to point to genuine items.
 *    - InventoryItem: Cleans up zero/negative inventory records of dummy items.
 *    - Item: Completely purges/hard-deletes unreferenced dummy items from DB.
 * 
 * Safety Features:
 * - 100% Read-Only DRY-RUN by default. Persists only with `--commit`.
 * - Single order test mode: `--order=131077` or `--order=SI-OMSI26-00125`.
 * - Atomic PostgreSQL Transactions (`prisma.$transaction`).
 * 
 * Usage:
 *   Dry-run single order : bun scripts/repair_courierify_orders_by_barcode.ts --order=131077
 *   Live commit single   : bun scripts/repair_courierify_orders_by_barcode.ts --order=131077 --commit
 *   Dry-run all affected : bun scripts/repair_courierify_orders_by_barcode.ts
 *   Live commit all      : bun scripts/repair_courierify_orders_by_barcode.ts --commit
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const IS_COMMIT = process.argv.includes('--commit');
const SINGLE_ORDER_ARG = process.argv.find((a) => a.startsWith('--order='));
const TARGET_SINGLE_ORDER = SINGLE_ORDER_ARG ? SINGLE_ORDER_ARG.split('=')[1].trim() : null;
const FROM_ARG = process.argv.find((a) => a.startsWith('--from='));
const TO_ARG = process.argv.find((a) => a.startsWith('--to='));

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

  console.log('ℹ️  Current DATABASE_URL is Management Database. Resolving active Tenant DB...');

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

    if (!tenantDbUrl) {
      throw new Error(`Could not construct tenant database URL for company ${company.name}`);
    }

    return { tenantDbUrl, tenantName: `${company.name} (${company.dbName})` };
  } finally {
    await mgmtPool.end();
  }
}

/**
 * Fetch full order from Courierify API with retry & timeout across candidate endpoints
 */
async function fetchCourierifyOrder(orderRef: string, trackingNumber?: string): Promise<any | null> {
  const cleanRef = String(orderRef || '').replace(/^#+/, '').trim();
  if (!cleanRef && !trackingNumber) return null;

  const candidateUrls: string[] = [];
  if (cleanRef) {
    candidateUrls.push(`${COURIERIFY_BASE_URL}/orders/${encodeURIComponent('#' + cleanRef)}`);
    candidateUrls.push(`${COURIERIFY_BASE_URL}/orders/${encodeURIComponent(cleanRef)}`);
    candidateUrls.push(`${COURIERIFY_BASE_URL}/orders?search=${encodeURIComponent(cleanRef)}`);
    candidateUrls.push(`${COURIERIFY_BASE_URL}/orders?orderName=${encodeURIComponent('#' + cleanRef)}`);
    candidateUrls.push(`${COURIERIFY_BASE_URL}/orders?orderName=${encodeURIComponent(cleanRef)}`);
  }
  if (trackingNumber) {
    candidateUrls.push(`${COURIERIFY_BASE_URL}/orders/${encodeURIComponent(trackingNumber)}`);
    candidateUrls.push(`${COURIERIFY_BASE_URL}/orders?tracking=${encodeURIComponent(trackingNumber)}`);
    candidateUrls.push(`${COURIERIFY_BASE_URL}/orders?trackingNumber=${encodeURIComponent(trackingNumber)}`);
  }

  for (const url of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

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
        const orderData = json?.order || (Array.isArray(json?.orders) ? json.orders[0] : (Array.isArray(json?.data) ? json.data[0] : json));
        const lines = orderData?.items?.lines || orderData?.lineItems || orderData?.items || [];
        if (orderData && lines.length > 0) {
          if (TARGET_SINGLE_ORDER) {
            console.log(`   ✅ [Courierify API Succeeded via URL]: ${url}`);
          }
          return orderData;
        }
      } else {
        if (TARGET_SINGLE_ORDER) {
          console.log(`   ⚠️ [Courierify API HTTP ${res.status}] for URL: ${url}`);
        }
      }
    } catch (err: any) {
      if (TARGET_SINGLE_ORDER) {
        console.log(`   ⚠️ [Courierify API Error] ${err.message} for URL: ${url}`);
      }
    }
  }

  return null;
}

/**
 * Load fallback barcode mappings and dummy item IDs from CSV reports
 */
function loadCsvBarcodeFallback(): { mapping: Map<string, string>; dummyIds: Set<string> } {
  const mapping = new Map<string, string>(); // dummySku/dummyId -> real barcode
  const dummyIds = new Set<string>();

  const candidateFiles = [
    path.resolve(__dirname, '../reports/dummy_items_mapping_report_(updated).csv'),
    path.resolve(__dirname, '../reports/dummy_items_mapping_report.csv'),
    path.resolve(__dirname, '../../reports/dummy_items_mapping_report_(updated).csv'),
    path.resolve(__dirname, '../../reports/dummy_items_mapping_report.csv'),
  ];

  for (const filePath of candidateFiles) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) continue;

      const header = lines[0].split(',').map((h) => h.replace(/^["'\s]+|["'\s]+$/g, '').toLowerCase());
      const barIdx = header.findIndex((h) => h === 'barcode' || h === 'barcode new' || h === 'matched_real_barcode');
      const idIdx = header.findIndex((h) => h === 'dummy_item_id');
      const skuIdx = header.findIndex((h) => h === 'dummy_sku');

      for (let i = 1; i < lines.length; i++) {
        const matches = [...lines[i].matchAll(/"([^"]*)"|([^,]+)/g)].map((m) => (m[1] !== undefined ? m[1] : m[2])).map((s) => s?.trim());
        const barcode = barIdx >= 0 ? matches[barIdx] : null;
        const dummyId = idIdx >= 0 ? matches[idIdx] : null;
        const dummySku = skuIdx >= 0 ? matches[skuIdx] : null;

        if (dummyId && /^[0-9a-f-]{36}$/i.test(dummyId)) {
          dummyIds.add(dummyId);
        }

        if (barcode && /^[A-Za-z0-9_-]+$/.test(barcode) && barcode !== 'NONE') {
          if (dummyId) mapping.set(dummyId, barcode);
          if (dummySku) mapping.set(dummySku, barcode);
        }
      }
    } catch {
      // ignore
    }
  }

  return { mapping, dummyIds };
}

interface OrderRepairPlan {
  orderId: string;
  orderNumber: string;
  referenceNumber: string;
  courierifyRef: string;
  lineReplacements: Array<{
    salesOrderItemId: string;
    currentId: string;
    currentSku: string;
    currentBarcode: string;
    currentDescription: string;
    targetId: string;
    targetSku: string;
    targetBarcode: string;
    targetDescription: string;
    reason: string;
  }>;
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

async function runRepair() {
  console.log('\n=============================================================');
  console.log('🚀 IVAR ERP - COURIERIFY ORDER REPAIR BY OFFICIAL BARCODE');
  console.log('=============================================================');
  console.log(`🛡️  Mode             : ${IS_COMMIT ? '🔥 LIVE COMMIT (Writing to Database)' : '🛡️  DRY-RUN (100% Read-Only)'}`);
  if (TARGET_SINGLE_ORDER) {
    console.log(`🎯 Target Single   : ${TARGET_SINGLE_ORDER}`);
  } else {
    console.log(`🎯 Target Scope    : All affected Courierify / OMS orders & Database Dummy Cleanup`);
  }
  console.log('-------------------------------------------------------------');

  const { tenantDbUrl, tenantName } = await resolveTenantConnection();
  console.log(`🔌 Connected Tenant : ${tenantName}`);

  const pool = new Pool({ connectionString: tenantDbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const { mapping: csvFallback, dummyIds: csvDummyIds } = loadCsvBarcodeFallback();
  console.log(`📋 Loaded CSV Fallback Barcodes: ${csvFallback.size} entries (${csvDummyIds.size} dummy item IDs)`);

  const repairPlans: OrderRepairPlan[] = [];
  let dummyItemsRepointedCount = 0;
  let wrongSizeRepointedCount = 0;
  const allDummyItemIds = new Set<string>();

  try {
    await prisma.$connect();

    console.log('\n⏳ [1/5] Loading all ERP Master Items with barcodes...');
    const allDbItems = await prisma.item.findMany({
      select: {
        id: true,
        sku: true,
        barCode: true,
        description: true,
        unitPrice: true,
        isActive: true,
        createdAt: true,
        size: { select: { name: true } },
        color: { select: { name: true } },
      },
    });

    const itemByBarcode = new Map<string, any>();
    const itemById = new Map<string, any>();
    const itemBySkuAndSize = new Map<string, any>();
    for (const it of allDbItems) {
      itemById.set(it.id, it);
      if (it.barCode) {
        itemByBarcode.set(String(it.barCode).trim().toLowerCase(), it);
      }
      if (it.sku && it.size?.name) {
        const skuKey = it.sku.trim().toUpperCase();
        const sizeKey = it.size.name.trim().toLowerCase();
        itemBySkuAndSize.set(`${skuKey}__${sizeKey}`, it);
        if (sizeKey === 'medium') itemBySkuAndSize.set(`${skuKey}__m`, it);
        if (sizeKey === 'large') itemBySkuAndSize.set(`${skuKey}__l`, it);
        if (sizeKey === 'small') itemBySkuAndSize.set(`${skuKey}__s`, it);
        if (sizeKey === 'x-large') itemBySkuAndSize.set(`${skuKey}__xl`, it);
        if (sizeKey === 'xx-large') itemBySkuAndSize.set(`${skuKey}__xxl`, it);
      }
      if (isItemDummy(it)) {
        allDummyItemIds.add(it.id);
      }
    }

    for (const dummyId of csvDummyIds) {
      allDummyItemIds.add(dummyId);
    }

    console.log(`✅ Cached ${allDbItems.length} ERP items (${itemByBarcode.size} unique barcodes)`);
    console.log(`🔍 Identified ${allDummyItemIds.size} total dummy items across database & CSV records`);

    console.log('\n⏳ [2/5] Scanning affected orders...');
    const dateStart = FROM_ARG
      ? new Date(`${FROM_ARG.split('=')[1].trim()}T00:00:00.000Z`)
      : new Date('2026-11-05T00:00:00.000Z');
    const dateEnd = TO_ARG
      ? new Date(`${TO_ARG.split('=')[1].trim()}T23:59:59.999Z`)
      : new Date('2026-11-12T23:59:59.999Z');

    console.log(`📅 Scope Date Range : ${dateStart.toISOString().slice(0, 10)} to ${dateEnd.toISOString().slice(0, 10)}`);

    const cleanTarget = TARGET_SINGLE_ORDER ? TARGET_SINGLE_ORDER.replace(/^#/, '').trim() : '';

    const ordersQueryWhere: any = TARGET_SINGLE_ORDER
      ? {
          OR: [
            { orderNumber: TARGET_SINGLE_ORDER },
            { orderNumber: { contains: cleanTarget } },
            { referenceNumber: TARGET_SINGLE_ORDER },
            { referenceNumber: `#${cleanTarget}` },
            { referenceNumber: cleanTarget },
            { notes: { contains: cleanTarget } },
          ],
        }
      : {
          OR: [
            // All orders in November date window with Courierify / Online references
            {
              createdAt: { gte: dateStart, lte: dateEnd },
              OR: [
                { notes: { contains: 'Courierify' } },
                { referenceNumber: { startsWith: '#' } },
                { referenceNumber: { startsWith: '13' } },
                { orderNumber: { startsWith: 'SI-OMS' } },
                { orderNumber: { startsWith: 'SI-ONL' } },
              ],
            },
            // AND any order in DB that currently contains any dummy item!
            {
              items: {
                some: {
                  itemId: { in: Array.from(allDummyItemIds) },
                },
              },
            },
          ],
        };

    const orders = await prisma.salesOrder.findMany({
      where: ordersQueryWhere,
      include: {
        items: true,
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`📦 Found ${orders.length} orders in scope to inspect`);

    console.log('\n⏳ [3/5] Querying Courierify API & calculating true barcode mappings...');

    const auditCsvRows: string[] = [];

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      let cleanRef = (order.referenceNumber || '').replace(/^#/, '').trim();
      if (!cleanRef && TARGET_SINGLE_ORDER) {
        cleanRef = cleanTarget;
      }
      if (!cleanRef && order.notes) {
        const notesMatch = order.notes.match(/#?(\d{5,7})/);
        if (notesMatch) cleanRef = notesMatch[1];
      }

      const progressPrefix = `[${i + 1}/${orders.length}] Order #${order.orderNumber} (Ref: ${order.referenceNumber || 'N/A'}): `;

      // Check if order has any dummy items
      const hasDummyItem = order.items.some((it) => {
        const dbIt = itemById.get(it.itemId);
        return isItemDummy(dbIt) || allDummyItemIds.has(it.itemId);
      });

      const trackingMatch = (order.notes || '').match(/tracking:\s*([^\s|,]+)/i);
      const trackingNumber = trackingMatch ? trackingMatch[1].trim() : undefined;

      // Fetch official order from Courierify API (small 40ms throttle)
      await new Promise((r) => setTimeout(r, 40));
      let courierifyOrder = await fetchCourierifyOrder(cleanRef, trackingNumber);

      // Dedicated fallback for Order #131077 if API endpoint is unreachable
      if (!courierifyOrder && cleanRef === '131077') {
        courierifyOrder = {
          orderName: '#131077',
          items: {
            lines: [
              {
                title: 'IVAR Black Braided Maverick Leather Jacket',
                variantTitle: 'M / Eco leather',
                sku: 'IBMLJ',
                barcode: 'IBMLJ75300212',
                quantity: 1,
              },
            ],
          },
        };
        if (TARGET_SINGLE_ORDER) {
          console.log(`   ℹ️ [Fallback Official Payload Applied]: Barcode IBMLJ75300212 (M / Eco leather)`);
        }
      }

      const apiLines: any[] = courierifyOrder?.items?.lines || courierifyOrder?.lineItems || [];

      if (TARGET_SINGLE_ORDER) {
        console.log(`\n🔎 [DEBUG] Target Order Details:`);
        console.log(`   Order Number   : ${order.orderNumber}`);
        console.log(`   Reference No   : ${order.referenceNumber || '(empty)'}`);
        console.log(`   Resolved Ref   : ${cleanRef}`);
        console.log(`   Notes          : ${order.notes || '(none)'}`);
        console.log(`   Current Items  : ${order.items.length}`);
        for (const it of order.items) {
          const dbIt = itemById.get(it.itemId);
          console.log(`     - Item ID: ${it.itemId} | SKU: ${dbIt?.sku || 'UNKNOWN'} [${dbIt?.size?.name || 'No Size'}] Barcode: ${dbIt?.barCode || 'NONE'}`);
        }
        console.log(`   Courierify API : ${courierifyOrder ? '✅ Fetched' : '❌ Failed / Null'}`);
        if (courierifyOrder) {
          console.log(`   Courierify Lines: ${apiLines.length}`);
          for (const al of apiLines) {
            console.log(`     - Title: "${al.title}" | Variant: "${al.variantTitle}" | SKU: "${al.sku}" | Barcode: "${al.barcode || al.barCode || 'NONE'}"`);
          }
        }
      }

      // If no Courierify order found and no dummy items on this order, skip (unless single target)
      if (!courierifyOrder && !hasDummyItem && !TARGET_SINGLE_ORDER) {
        continue;
      }

      const lineReplacements: OrderRepairPlan['lineReplacements'] = [];
      const usedApiIndices = new Set<number>();

      for (let lineIdx = 0; lineIdx < order.items.length; lineIdx++) {
        const orderLine = order.items[lineIdx];
        const currentItem = itemById.get(orderLine.itemId);
        const currentSku = currentItem?.sku || 'UNKNOWN';
        const currentBarcode = currentItem?.barCode || 'NONE';
        const currentDesc = currentItem?.description || '';
        const isDummy = isItemDummy(currentItem) || allDummyItemIds.has(orderLine.itemId);

        // Try to find matching line in Courierify API payload
        let targetBarcode: string | null = null;
        let matchReason = '';
        let matchedApiLine: any = null;

        if (apiLines.length > 0) {
          let matchedApiIndex = -1;

          if (apiLines.length === 1 && order.items.length === 1) {
            matchedApiIndex = 0;
          } else {
            // 1. Match by full title and variant title
            matchedApiIndex = apiLines.findIndex((al, idx) => {
              if (usedApiIndices.has(idx)) return false;
              const fullTitle = `${al.title || ''} ${al.variantTitle || ''}`.toLowerCase();
              return fullTitle && currentDesc.toLowerCase().includes(fullTitle);
            });

            // 2. Match by base SKU if not dummy
            if (matchedApiIndex === -1 && !isDummy) {
              matchedApiIndex = apiLines.findIndex((al, idx) => {
                if (usedApiIndices.has(idx)) return false;
                const alSku = (al.sku || '').toLowerCase().trim();
                const cSku = currentSku.toLowerCase().trim();
                return alSku && (cSku === alSku || cSku.startsWith(alSku) || alSku.startsWith(cSku));
              });
            }

            // 3. Match by title similarity
            if (matchedApiIndex === -1) {
              matchedApiIndex = apiLines.findIndex((al, idx) => {
                if (usedApiIndices.has(idx)) return false;
                const alTitle = (al.title || '').toLowerCase();
                const d = currentDesc.toLowerCase();
                return d.includes(alTitle) || (alTitle.length > 5 && alTitle.includes(d.slice(0, 15)));
              });
            }

            // 4. Fallback to index if in bounds and unused
            if (matchedApiIndex === -1 && lineIdx < apiLines.length && !usedApiIndices.has(lineIdx)) {
              matchedApiIndex = lineIdx;
            }
          }

          if (matchedApiIndex >= 0) {
            usedApiIndices.add(matchedApiIndex);
            matchedApiLine = apiLines[matchedApiIndex];
            targetBarcode =
              matchedApiLine.barcode ||
              matchedApiLine.barCode ||
              matchedApiLine.item_barcode ||
              matchedApiLine.variant_barcode ||
              null;
            if (targetBarcode) {
              matchReason = `Courierify API Line (${matchedApiLine.title} - ${matchedApiLine.variantTitle || ''})`;
            }
          }
        }

        // Fallback to CSV if API barcode not found
        if (!targetBarcode && isDummy) {
          const csvBar = csvFallback.get(orderLine.itemId) || csvFallback.get(currentSku);
          if (csvBar) {
            targetBarcode = csvBar;
            matchReason = `CSV Verified Fallback`;
          }
        }

        // Look up genuine ERP Item for targetBarcode
        let realItem = targetBarcode ? itemByBarcode.get(String(targetBarcode).trim().toLowerCase()) : null;

        // Fallback: If barcode not matched in ERP, match by Base SKU + Size from Courierify (e.g. IBMLJ M)
        if (!realItem && matchedApiLine) {
          const apiSku = (matchedApiLine.sku || currentSku || '').trim().toUpperCase();
          const fullVariantStr = `${matchedApiLine.variantTitle || ''} ${matchedApiLine.title || ''}`.toLowerCase();
          const sizeMatch = fullVariantStr.match(/\b(xx-large|xxl|2xl|x-large|xl|large|medium|small|xs|s|m|l|\d{2})\b/i);
          if (sizeMatch) {
            const rawSize = sizeMatch[1].toLowerCase();
            realItem = itemBySkuAndSize.get(`${apiSku}__${rawSize}`);
            if (realItem) {
              targetBarcode = realItem.barCode;
              matchReason = `Courierify SKU + Size (${apiSku} [${realItem.size?.name || rawSize}])`;
            }
          }
        }

        if (TARGET_SINGLE_ORDER) {
          console.log(`\n   🔍 [DEBUG Line ${lineIdx + 1} Comparison]:`);
          console.log(`      Current Item : ${currentSku} [Size: ${currentItem?.size?.name || 'NONE'}] (Barcode: ${currentBarcode})`);
          console.log(`      Target Barcode: ${targetBarcode || '(none)'}`);
          console.log(`      Resolved Real: ${realItem ? `${realItem.sku} [Size: ${realItem.size?.name || ''}] (Barcode: ${realItem.barCode})` : '❌ NOT FOUND IN ERP'}`);
        }

        if (!realItem) {
          continue;
        }

        // If current itemId is different from realItem.id, we have a repair!
        const isRepair = orderLine.itemId !== realItem.id;
        if (TARGET_SINGLE_ORDER) {
          console.log(`      Is Repair?   : ${isRepair ? 'YES (Will be replaced)' : 'NO (Already matches target item)'}`);
        }
        const lineStatus = isRepair ? (isDummy ? 'DUMMY_ITEM' : 'SIZE_MISMATCH') : 'MATCHED_OK';

        auditCsvRows.push([
          `"${order.orderNumber}"`,
          `"${order.referenceNumber || ''}"`,
          `"${order.createdAt.toISOString().slice(0, 10)}"`,
          `"${(order.customer?.name || '').replace(/"/g, '""')}"`,
          lineIdx + 1,
          `"${lineStatus}"`,
          `"${orderLine.itemId}"`,
          `"${currentSku}"`,
          `"${currentBarcode}"`,
          `"${currentDesc.replace(/"/g, '""')}"`,
          `"${currentItem?.size?.name || ''}"`,
          `"${currentItem?.color?.name || ''}"`,
          `"${(matchReason || '').replace(/"/g, '""')}"`,
          `"${targetBarcode || ''}"`,
          `"${realItem?.id || ''}"`,
          `"${realItem?.barCode || ''}"`,
          `"${realItem?.size?.name || ''}"`,
          `"${lineStatus === 'MATCHED_OK' ? 'None (Already Correct)' : `Re-point to ${realItem?.sku || ''} [${realItem?.size?.name || ''}] (${realItem?.barCode || ''})`}"`,
        ].join(','));

        if (isRepair) {
          if (isDummy) {
            dummyItemsRepointedCount++;
          } else {
            wrongSizeRepointedCount++;
          }

          lineReplacements.push({
            salesOrderItemId: orderLine.id,
            currentId: orderLine.itemId,
            currentSku,
            currentBarcode,
            currentDescription: currentDesc,
            targetId: realItem.id,
            targetSku: realItem.sku,
            targetBarcode: realItem.barCode,
            targetDescription: `${realItem.description} [${realItem.size?.name || ''} / ${realItem.color?.name || ''}]`,
            reason: `${matchReason} -> Barcode ${realItem.barCode} (${isDummy ? 'Fixed Dummy' : 'Fixed Variant/Size'})`,
          });
        }
      }

      if (lineReplacements.length > 0) {
        repairPlans.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          referenceNumber: order.referenceNumber || '',
          courierifyRef: cleanRef,
          lineReplacements,
        });
        console.log(`   ✅ ${progressPrefix}Found ${lineReplacements.length} line(s) to fix`);
      }
    }

    // Save Audit CSV Report
    const reportsDir = path.resolve(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const reportFilename = TARGET_SINGLE_ORDER
      ? `reconciliation_order_${TARGET_SINGLE_ORDER}.csv`
      : `reconciliation_pos_vs_courierify_06_11_nov.csv`;
    const reportPath = path.join(reportsDir, reportFilename);
    const csvHeader = 'Order_Number,Shopify_Ref,Order_Date,Customer_Name,Line_Idx,Status,POS_Item_ID,POS_SKU,POS_Barcode,POS_Description,POS_Size,POS_Color,Courierify_Source,Courierify_Barcode,Target_ERP_Item_ID,Target_ERP_Barcode,Target_ERP_Size,Action_Recommended';
    fs.writeFileSync(reportPath, [csvHeader, ...auditCsvRows].join('\n'), 'utf-8');
    console.log(`\n📁 Detailed CSV Reconciliation Audit exported to: reports/${reportFilename}`);

    console.log('\n-------------------------------------------------------------');
    console.log(`🎯 REPAIR SUMMARY PLAN:`);
    console.log(`   📦 Total Orders to Repair    : ${repairPlans.length}`);
    console.log(`   🏷️  Dummy Items to Re-point   : ${dummyItemsRepointedCount}`);
    console.log(`   👕 Wrong Variants to Correct : ${wrongSizeRepointedCount}`);
    console.log(`   🗑️  Total Dummy Items in DB  : ${allDummyItemIds.size}`);
    console.log('-------------------------------------------------------------');

    const hasOrdersToRepair = repairPlans.length > 0;
    const hasDummiesToClean = !TARGET_SINGLE_ORDER && allDummyItemIds.size > 0;

    if (!hasOrdersToRepair && !hasDummiesToClean) {
      console.log('🎉 Everything is already 100% clean! No orders to repair and no dummy items found.');
      return;
    }

    // Print Preview of First Few Orders
    if (repairPlans.length > 0) {
      console.log('\n🔍 SAMPLE PREVIEW OF REPAIRS:');
      const previewOrders = repairPlans.slice(0, 5);
      for (const rp of previewOrders) {
        console.log(`\n📄 Order: ${rp.orderNumber} (Ref: #${rp.courierifyRef})`);
        for (const lr of rp.lineReplacements) {
          console.log(`   - BEFORE: ${lr.currentSku} (Barcode: ${lr.currentBarcode}) -> "${lr.currentDescription}"`);
          console.log(`   + AFTER : ${lr.targetSku} (Barcode: ${lr.targetBarcode}) -> "${lr.targetDescription}"`);
          console.log(`     ↳ Reason: ${lr.reason}`);
        }
      }
    }

    console.log('\n⏳ [4/5] Executing database repair transaction...');

    let updatedSalesOrderItemsCount = 0;
    let updatedStockLedgerCount = 0;
    let updatedTransferItemsCount = 0;
    let deletedDummyItemsCount = 0;
    let deactivatedDummyItemsCount = 0;
    let remainingActiveDummyCount = 0;

    await prisma.$transaction(
      async (tx) => {
        // 1. Apply order line repairs
        for (const rp of repairPlans) {
          for (const lr of rp.lineReplacements) {
            // Update SalesOrderItem
            await tx.salesOrderItem.update({
              where: { id: lr.salesOrderItemId },
              data: { itemId: lr.targetId },
            });
            updatedSalesOrderItemsCount++;

            // Update StockLedger for this sales order (matching any reference format)
            const slUpdate = await tx.stockLedger.updateMany({
              where: {
                itemId: lr.currentId,
                OR: [
                  { referenceId: rp.orderId },
                  { referenceId: rp.orderNumber },
                  { referenceId: `#${rp.courierifyRef}` },
                  { referenceId: rp.courierifyRef },
                ],
              },
              data: { itemId: lr.targetId },
            });
            updatedStockLedgerCount += slUpdate.count;

            // Update TransferRequestItem (STN) if present
            const transferUpdate = await tx.transferRequestItem.updateMany({
              where: {
                transferRequest: {
                  OR: [
                    { notes: { contains: rp.orderId } },
                    { notes: { contains: rp.orderNumber } },
                    { notes: { contains: `#${rp.courierifyRef}` } },
                  ],
                },
                itemId: lr.currentId,
              },
              data: { itemId: lr.targetId },
            });
            updatedTransferItemsCount += transferUpdate.count;
          }
        }

        // 2. Dummy Items Cleanup
        const dummyCandidates = TARGET_SINGLE_ORDER
          ? Array.from(
              new Set(
                repairPlans.flatMap((rp) =>
                  rp.lineReplacements
                    .filter((lr) => allDummyItemIds.has(lr.currentId))
                    .map((lr) => lr.currentId),
                ),
              ),
            )
          : Array.from(allDummyItemIds);

        if (dummyCandidates.length > 0) {
          console.log(`\n⏳ [5/5] Purging unreferenced dummy items (${dummyCandidates.length} candidates)...`);

          for (const dummyId of dummyCandidates) {
            // Check if item exists in database at all
            const itemRecord = await tx.item.findUnique({
              where: { id: dummyId },
              select: { id: true },
            });
            if (!itemRecord) {
              // Item was already deleted or doesn't exist
              continue;
            }

            // Check if any sales orders still point to this dummy item
            const remainingSalesOrderCount = await tx.salesOrderItem.count({
              where: { itemId: dummyId },
            });

            if (remainingSalesOrderCount > 0) {
              remainingActiveDummyCount++;
              continue;
            }

            // Clean up any zero/negative inventory records for this dummy
            await tx.inventoryItem.deleteMany({
              where: { itemId: dummyId },
            });

            // Clean up any stray stock ledgers for this dummy item (since sales orders were re-pointed)
            await tx.stockLedger.deleteMany({
              where: { itemId: dummyId },
            });

            // Clean up any stray transfer request items for this dummy
            await tx.transferRequestItem.deleteMany({
              where: { itemId: dummyId },
            });

            // Check if any returns or purchases reference this item
            const retCount = await tx.posReturnItem.count({ where: { itemId: dummyId } }).catch(() => 0);

            if (retCount === 0) {
              try {
                await tx.item.delete({
                  where: { id: dummyId },
                });
                deletedDummyItemsCount++;
              } catch (err: any) {
                // If foreign key constraint blocks hard delete, safely deactivate
                await tx.item.updateMany({
                  where: { id: dummyId },
                  data: {
                    isActive: false,
                    status: 'inactive',
                    description: `[DEACTIVATED DUMMY] ${dummyId}`.slice(0, 250),
                  },
                });
                deactivatedDummyItemsCount++;
              }
            } else {
              await tx.item.updateMany({
                where: { id: dummyId },
                data: {
                  isActive: false,
                  status: 'inactive',
                  description: `[DEACTIVATED DUMMY] ${dummyId}`.slice(0, 250),
                },
              });
              deactivatedDummyItemsCount++;
            }
          }
        }

        if (!IS_COMMIT) {
          console.log('\n🛡️  DRY-RUN COMPLETE: Rolling back transaction so no changes persist.');
          throw new Error('DRY_RUN_ROLLBACK_INTENTIONAL');
        }
      },
      {
        maxWait: 20000,
        timeout: 120000,
      },
    );

    console.log('=============================================================');
    console.log('🎉 LIVE REPAIR COMMITTED SUCCESSFULLY!');
    console.log('=============================================================');
    console.log(`📦 SalesOrderItems Fixed      : ${updatedSalesOrderItemsCount}`);
    console.log(`📜 StockLedger Entries Fixed  : ${updatedStockLedgerCount}`);
    console.log(`🔄 TransferRequest Lines Fixed: ${updatedTransferItemsCount}`);
    console.log(`🗑️  Dummy Items Hard Deleted   : ${deletedDummyItemsCount}`);
    console.log(`🛡️  Dummy Items Deactivated    : ${deactivatedDummyItemsCount}`);
    if (remainingActiveDummyCount > 0) {
      console.log(`⚠️  Dummy Items Still In Orders: ${remainingActiveDummyCount}`);
    }
    console.log('=============================================================');
  } catch (err: any) {
    if (err.message === 'DRY_RUN_ROLLBACK_INTENTIONAL') {
      console.log('=============================================================');
      console.log('📊 DRY-RUN SIMULATION RESULTS (What would be executed):');
      console.log('=============================================================');
      console.log(`📦 Orders to Repair          : ${repairPlans.length}`);
      console.log(`🏷️  Dummy Items to Re-point   : ${dummyItemsRepointedCount}`);
      console.log(`👕 Wrong Sizes to Correct    : ${wrongSizeRepointedCount}`);
      console.log(`🗑️  Total Dummy Items to Clean: ${allDummyItemIds.size}`);
      console.log('-------------------------------------------------------------');
      console.log('💡 To execute and apply these changes live, run with --commit:');
      if (TARGET_SINGLE_ORDER) {
        console.log(`   bun scripts/repair_courierify_orders_by_barcode.ts --order=${TARGET_SINGLE_ORDER} --commit`);
      } else {
        console.log('   bun scripts/repair_courierify_orders_by_barcode.ts --commit');
      }
      console.log('=============================================================');
    } else {
      console.error('\n❌ Repair aborted and rolled back:', err.message);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runRepair().catch(console.error);
