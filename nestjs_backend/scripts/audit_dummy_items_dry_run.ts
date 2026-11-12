/**
 * ==============================================================================
 * SCRIPT: audit_dummy_items_dry_run.ts
 * PURPOSE: 100% READ-ONLY Audit & Mapping Tool for Courierify Dummy Items
 * 
 * Target Incident: Orders created between Nov 5 - Nov 11, 2026 where SKU mismatch
 * caused auto-creation of fallback/dummy items in IVAR ERP.
 *
 * MULTI-TENANT AWARE:
 * Automatically detects whether DATABASE_URL is pointing to the Management DB
 * or directly to a Tenant DB. If Management DB is detected, it automatically
 * resolves and connects to the active company's tenant database.
 *
 * SAFETY GUARANTEE:
 * - ZERO DATABASE WRITES (no INSERT, UPDATE, DELETE).
 * - Safe to run directly on LIVE production or local replica.
 * - Generates CSV reports and a terminal summary for review before any fix.
 * ==============================================================================
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

// Load environment variables (.env from nestjs_backend or system environment)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Common size and color aliases used in Shopify / Web SKUs
const SIZE_ALIASES: Record<string, string[]> = {
  s: ['small', 's'],
  m: ['medium', 'med', 'm'],
  l: ['large', 'lg', 'l'],
  xl: ['x-large', 'extra large', 'xl', '1xl'],
  xxl: ['xx-large', '2xl', 'xxl'],
  xxxl: ['xxx-large', '3xl', 'xxxl'],
  xs: ['x-small', 'extra small', 'xs'],
};

const COLOR_ALIASES: Record<string, string[]> = {
  na: ['navy', 'navy blue', 'dark navy'],
  nv: ['navy', 'navy blue'],
  nvy: ['navy'],
  wh: ['white', 'off white', 'optical white'],
  wht: ['white'],
  bl: ['black', 'blue'],
  blk: ['black'],
  dabl: ['dark blue', 'dark navy', 'dark denim'],
  dbl: ['dark blue', 'dark denim'],
  lbl: ['light blue', 'ice blue'],
  ltbl: ['light blue'],
  blu: ['blue', 'royal blue', 'sky blue'],
  gr: ['grey', 'gray', 'green'],
  gry: ['grey', 'gray'],
  grn: ['green', 'olive green', 'sage green'],
  ol: ['olive', 'olive green'],
  olv: ['olive'],
  kh: ['khaki'],
  khk: ['khaki'],
  bg: ['beige'],
  bge: ['beige'],
  cr: ['cream', 'ecru'],
  crm: ['cream'],
  mr: ['maroon'],
  mrn: ['maroon', 'burgundy'],
  ch: ['charcoal', 'charcoal grey'],
  chr: ['charcoal'],
  br: ['brown'],
  brn: ['brown', 'chocolate'],
};

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

/**
 * Intelligent Database URL Resolver
 * Determines if we are connected to the Tenant DB or Management DB.
 * If Management DB, auto-discovers active tenant and creates connection to Tenant DB.
 */
async function resolveTenantConnection(): Promise<{ tenantDbUrl: string; tenantName: string }> {
  // Check CLI arguments for override: --tenant <name> or --db <url>
  const args = process.argv.slice(2);
  let cliTenant: string | null = null;
  let cliDb: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tenant' && i + 1 < args.length) {
      cliTenant = args[i + 1];
      i++;
    } else if (args[i] === '--db' && i + 1 < args.length) {
      cliDb = args[i + 1];
      i++;
    }
  }

  if (cliDb) {
    return { tenantDbUrl: cliDb, tenantName: 'CLI Override Database' };
  }

  const initialUrl = process.env.DATABASE_URL;
  const managementUrl = process.env.DATABASE_URL_MANAGEMENT || initialUrl;
  const masterKey = process.env.MASTER_ENCRYPTION_KEY;

  if (!initialUrl && !managementUrl) {
    throw new Error('Neither DATABASE_URL nor DATABASE_URL_MANAGEMENT is set in .env');
  }

  // First, test if initialUrl already contains "Item" table
  if (initialUrl) {
    const testPool = new Pool({ connectionString: initialUrl, max: 1 });
    try {
      const checkRes = await testPool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND (table_name = 'Item' OR table_name = 'item')
        ) as exists;
      `);
      if (checkRes.rows[0]?.exists) {
        await testPool.end();
        return { tenantDbUrl: initialUrl, tenantName: 'Direct Tenant DB' };
      }
    } catch {
      // Ignore and continue to management resolution
    } finally {
      try { await testPool.end(); } catch {}
    }
  }

  // If we reach here, the database does NOT have "Item" table directly — it is the Management DB!
  console.log('ℹ️  Current DATABASE_URL is Management Database. Auto-resolving active Tenant DB...');
  if (!managementUrl) {
    throw new Error('DATABASE_URL_MANAGEMENT is required to resolve tenant database.');
  }

  const mgmtPool = new Pool({ connectionString: managementUrl, max: 1 });
  try {
    let companyQuery = `SELECT * FROM "Company" WHERE status = 'active'`;
    const queryParams: any[] = [];
    if (cliTenant) {
      companyQuery += ` AND ("dbName" = $1 OR "code" = $1 OR "name" = $1)`;
      queryParams.push(cliTenant);
    }
    companyQuery += ` ORDER BY "createdAt" ASC LIMIT 1;`;

    const res = await mgmtPool.query(companyQuery, queryParams);
    if (res.rows.length === 0) {
      throw new Error(`No active tenant company found in Management Database (filter: ${cliTenant || 'any'}).`);
    }

    const company = res.rows[0];
    console.log(`🏢 Selected Tenant Company: "${company.name}" (Code: ${company.code}, DB: ${company.dbName})`);

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
        console.warn(`⚠️  Password decryption failed: ${err.message}. Falling back to dbUrl if present.`);
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

interface DummyItemReport {
  dummyItemId: string;
  dummySku: string;
  dummyBarcode: string;
  dummyTitle: string;
  dummyPrice: number;
  dummyCreatedAt: string;
  ordersCount: number;
  totalUnitsSold: number;
  affectedOrderNumbers: string[];
  matchedRealItemId: string;
  matchedRealSku: string;
  matchedRealBarcode: string;
  matchedRealDescription: string;
  matchedSize: string;
  matchedColor: string;
  matchConfidence: 'HIGH' | 'MEDIUM' | 'UNMATCHED';
  matchRule: string;
}

interface AffectedOrderReport {
  orderId: string;
  orderNumber: string;
  referenceNumber: string;
  createdAt: string;
  status: string;
  grandTotal: number;
  customerName: string;
  customerPhone: string;
  notes: string;
  totalItemsCount: number;
  dummyItemsCount: number;
  dummyLineItemIds: string[];
  dummyItemSkus: string[];
}

function escapeCsv(val: any): string {
  if (val === undefined || val === null) return '';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function normalizeStr(s?: string | null): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
}

async function runAudit() {
  const { tenantDbUrl, tenantName } = await resolveTenantConnection();

  const START_DATE = new Date(process.env.AUDIT_START_DATE || '2026-11-05T00:00:00.000Z');
  const END_DATE = new Date(process.env.AUDIT_END_DATE || '2026-11-11T23:59:59.999Z');

  console.log('\n=============================================================');
  console.log('🔍 IVAR ERP - COURIERIFY DUMMY ITEMS DRY-RUN AUDIT REPORT');
  console.log('=============================================================');
  console.log(`📅 Target Date Range : ${START_DATE.toISOString()} to ${END_DATE.toISOString()}`);
  console.log(`🏢 Tenant Database   : ${tenantName}`);
  console.log(`🛡️  Mode              : 100% READ-ONLY (No modifications)`);
  console.log('-------------------------------------------------------------\n');

  // Setup connection to Tenant Database
  const pool = new Pool({
    connectionString: tenantDbUrl,
    max: 3,
    connectionTimeoutMillis: 10000,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Step 1: Pre-fetch all real active items, sizes, and colors
    console.log('⏳ [1/5] Loading ERP Master Data (Items, Sizes, Colors)...');
    const allRealItems = await prisma.item.findMany({
      where: {
        isActive: true,
        OR: [
          { sizeId: { not: null } },
          { colorId: { not: null } },
          { createdAt: { lt: START_DATE } },
          { createdAt: { gt: END_DATE } },
        ],
      },
      select: {
        id: true,
        itemId: true,
        sku: true,
        barCode: true,
        description: true,
        unitPrice: true,
        createdAt: true,
        size: { select: { id: true, name: true } },
        color: { select: { id: true, name: true } },
        category: { select: { name: true } },
      },
    });

    const allSizes = await prisma.size.findMany({ select: { id: true, name: true } });
    const allColors = await prisma.color.findMany({ select: { id: true, name: true } });

    console.log(`   ✅ Loaded ${allRealItems.length} active ERP items, ${allSizes.length} sizes, ${allColors.length} colors.`);

    // Build lookup maps
    const realItemByBarcode = new Map<string, typeof allRealItems[0]>();
    const realItemsByBaseSku = new Map<string, typeof allRealItems>();

    for (const it of allRealItems) {
      if (it.barCode) {
        realItemByBarcode.set(it.barCode.trim().toLowerCase(), it);
      }
      const baseSkuKey = it.sku.trim().toUpperCase();
      if (!realItemsByBaseSku.has(baseSkuKey)) {
        realItemsByBaseSku.set(baseSkuKey, []);
      }
      realItemsByBaseSku.get(baseSkuKey)!.push(it);
    }

    // Step 2: Query Sales Orders in target incident date range
    console.log('\n⏳ [2/5] Fetching Sales Orders created between Nov 5 and Nov 11...');
    const orders = await prisma.salesOrder.findMany({
      where: {
        createdAt: {
          gte: START_DATE,
          lte: END_DATE,
        },
      },
      include: {
        customer: {
          select: { name: true, contactNo: true },
        },
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
      orderBy: { createdAt: 'asc' },
    });

    console.log(`   ✅ Scanned ${orders.length} total orders in this timeframe.`);

    // Step 3: Identify Dummy Items from scanned orders
    console.log('\n⏳ [3/5] Identifying Dummy Items linked to these orders...');

    const dummyItemUsageMap = new Map<
      string,
      {
        item: any;
        orderNumbers: Set<string>;
        totalUnits: number;
      }
    >();

    const affectedOrdersList: AffectedOrderReport[] = [];

    for (const order of orders) {
      let orderHasDummy = false;
      const dummyLineItemIds: string[] = [];
      const dummyItemSkus: string[] = [];

      for (const line of order.items) {
        const it = line.item;
        if (!it) continue;

        const isIncidentWindow = it.createdAt >= START_DATE && it.createdAt <= END_DATE;
        const isMissingAttributes = !it.sizeId && !it.colorId;
        const isAutoGeneratedPrefix = it.itemId.startsWith('ONL-') || it.sku.startsWith('ONL-');
        const hasWebSuffix = (it.sku.includes('-') && it.sku.split('-').length >= 2 && realItemsByBaseSku.has(it.sku.split('-')[0].toUpperCase()));

        const isDummy = (isIncidentWindow && isMissingAttributes) || isAutoGeneratedPrefix || (isIncidentWindow && hasWebSuffix);

        if (isDummy) {
          orderHasDummy = true;
          dummyLineItemIds.push(line.id);
          dummyItemSkus.push(it.sku);

          if (!dummyItemUsageMap.has(it.id)) {
            dummyItemUsageMap.set(it.id, {
              item: it,
              orderNumbers: new Set(),
              totalUnits: 0,
            });
          }
          const usage = dummyItemUsageMap.get(it.id)!;
          usage.orderNumbers.add(order.orderNumber);
          usage.totalUnits += line.quantity;
        }
      }

      if (orderHasDummy) {
        affectedOrdersList.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          referenceNumber: order.referenceNumber || '',
          createdAt: order.createdAt.toISOString(),
          status: order.status,
          grandTotal: Number(order.grandTotal),
          customerName: order.customer?.name || 'N/A',
          customerPhone: order.customer?.contactNo || 'N/A',
          notes: order.notes || '',
          totalItemsCount: order.items.length,
          dummyItemsCount: dummyLineItemIds.length,
          dummyLineItemIds,
          dummyItemSkus,
        });
      }
    }

    console.log(`   🚨 Detected ${dummyItemUsageMap.size} unique dummy items across ${affectedOrdersList.length} affected orders!`);

    // Step 4: Intelligent Mapping of each Dummy Item to Real ERP Item
    console.log('\n⏳ [4/5] Computing Intelligent Matches against Real ERP Items...');

    const dummyReports: DummyItemReport[] = [];

    for (const [dummyId, usage] of dummyItemUsageMap.entries()) {
      const dummy = usage.item;
      const dummySku = (dummy.sku || '').trim();
      const dummyBarcode = (dummy.barCode || '').trim();
      const dummyDesc = dummy.description || '';

      let matchedItem: typeof allRealItems[0] | null = null;
      let confidence: 'HIGH' | 'MEDIUM' | 'UNMATCHED' = 'UNMATCHED';
      let matchRule = 'None';

      // ── MATCH STRATEGY 1: Direct Barcode Match ──
      if (dummyBarcode) {
        const match = realItemByBarcode.get(dummyBarcode.toLowerCase());
        if (match && match.id !== dummyId) {
          matchedItem = match;
          confidence = 'HIGH';
          matchRule = `Rule 1: Direct Barcode Match (${dummyBarcode})`;
        }
      }

      // ── MATCH STRATEGY 2: Parse Web SKU Pattern (e.g. IVOXFDSHIRT-NA-S or IVRAILDEJO-DABL-S) ──
      if (!matchedItem && dummySku.includes('-')) {
        const parts = dummySku.split('-').map((p: string) => p.trim());
        const baseSku = parts[0].toUpperCase();
        const candidates = realItemsByBaseSku.get(baseSku) || [];

        if (candidates.length > 0) {
          let targetColorPart = '';
          let targetSizePart = '';

          if (parts.length >= 3) {
            targetColorPart = parts[1].toLowerCase();
            targetSizePart = parts[2].toLowerCase();
          } else if (parts.length === 2) {
            const p1 = parts[1].toLowerCase();
            if (SIZE_ALIASES[p1] || ['s', 'm', 'l', 'xl', 'xxl', '28', '30', '32', '34', '36', '38', '40'].includes(p1)) {
              targetSizePart = p1;
            } else {
              targetColorPart = p1;
            }
          }

          let candidate = candidates.find((cand) => {
            const candSizeName = (cand.size?.name || '').toLowerCase();
            const candColorName = (cand.color?.name || '').toLowerCase();

            const sizeMatch = !targetSizePart || (
              candSizeName === targetSizePart ||
              (SIZE_ALIASES[targetSizePart] && SIZE_ALIASES[targetSizePart].includes(candSizeName)) ||
              candSizeName.startsWith(targetSizePart)
            );

            const colorMatch = !targetColorPart || (
              candColorName === targetColorPart ||
              (COLOR_ALIASES[targetColorPart] && COLOR_ALIASES[targetColorPart].some(alias => candColorName.includes(alias))) ||
              candColorName.includes(targetColorPart)
            );

            return sizeMatch && colorMatch;
          });

          if (candidate) {
            matchedItem = candidate;
            confidence = targetSizePart && targetColorPart ? 'HIGH' : 'MEDIUM';
            matchRule = `Rule 2: Base SKU (${baseSku}) + Size (${targetSizePart || 'Any'}) + Color (${targetColorPart || 'Any'})`;
          } else if (candidates.length === 1) {
            matchedItem = candidates[0];
            confidence = 'MEDIUM';
            matchRule = `Rule 2B: Sole candidate for Base SKU (${baseSku})`;
          }
        }
      }

      // ── MATCH STRATEGY 3: Title / Description Fuzzy Matching ──
      if (!matchedItem && dummyDesc) {
        const normalizedTitle = normalizeStr(dummyDesc);
        for (const cand of allRealItems) {
          if (!cand.description) continue;
          const normCand = normalizeStr(cand.description);
          if (normCand && (normalizedTitle.includes(normCand) || normCand.includes(normalizedTitle))) {
            const candSizeName = (cand.size?.name || '').toLowerCase();
            if (candSizeName && normalizedTitle.includes(candSizeName)) {
              matchedItem = cand;
              confidence = 'MEDIUM';
              matchRule = `Rule 3: Title Fuzzy Match ("${dummyDesc}" -> "${cand.description}")`;
              break;
            }
          }
        }
      }

      dummyReports.push({
        dummyItemId: dummyId,
        dummySku,
        dummyBarcode,
        dummyTitle: dummyDesc,
        dummyPrice: dummy.unitPrice || 0,
        dummyCreatedAt: dummy.createdAt.toISOString(),
        ordersCount: usage.orderNumbers.size,
        totalUnitsSold: usage.totalUnits,
        affectedOrderNumbers: Array.from(usage.orderNumbers),
        matchedRealItemId: matchedItem?.id || '',
        matchedRealSku: matchedItem?.sku || '',
        matchedRealBarcode: matchedItem?.barCode || '',
        matchedRealDescription: matchedItem?.description || '',
        matchedSize: matchedItem?.size?.name || '',
        matchedColor: matchedItem?.color?.name || '',
        matchConfidence: confidence,
        matchRule,
      });
    }

    // Step 5: Export CSV Reports and Print Summary Table
    console.log('\n⏳ [5/5] Generating CSV Reports...');

    const reportsDir = path.resolve(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const dummyReportPath = path.join(reportsDir, 'dummy_items_mapping_report.csv');
    const dummyCsvHeaders = [
      'Dummy_Item_ID',
      'Dummy_SKU',
      'Dummy_Barcode',
      'Dummy_Title',
      'Dummy_Price',
      'Dummy_Created_At',
      'Orders_Count',
      'Total_Units_Sold',
      'Affected_Order_Numbers',
      'Matched_Real_Item_ID',
      'Matched_Real_SKU',
      'Matched_Real_Barcode',
      'Matched_Real_Description',
      'Matched_Size',
      'Matched_Color',
      'Match_Confidence',
      'Match_Rule',
    ];

    const dummyCsvRows = dummyReports.map((r) => [
      escapeCsv(r.dummyItemId),
      escapeCsv(r.dummySku),
      escapeCsv(r.dummyBarcode),
      escapeCsv(r.dummyTitle),
      escapeCsv(r.dummyPrice),
      escapeCsv(r.dummyCreatedAt),
      escapeCsv(r.ordersCount),
      escapeCsv(r.totalUnitsSold),
      escapeCsv(r.affectedOrderNumbers.join(', ')),
      escapeCsv(r.matchedRealItemId),
      escapeCsv(r.matchedRealSku),
      escapeCsv(r.matchedRealBarcode),
      escapeCsv(r.matchedRealDescription),
      escapeCsv(r.matchedSize),
      escapeCsv(r.matchedColor),
      escapeCsv(r.matchConfidence),
      escapeCsv(r.matchRule),
    ]);

    fs.writeFileSync(
      dummyReportPath,
      [dummyCsvHeaders.join(','), ...dummyCsvRows.map((row) => row.join(','))].join('\n'),
      'utf-8',
    );

    const affectedOrdersReportPath = path.join(reportsDir, 'affected_orders_summary.csv');
    const ordersCsvHeaders = [
      'Order_ID',
      'Order_Number',
      'Courierify_Ref',
      'Order_Date',
      'Status',
      'Grand_Total',
      'Customer_Name',
      'Customer_Phone',
      'Total_Items_Count',
      'Dummy_Items_Count',
      'Dummy_Item_SKUs',
    ];

    const ordersCsvRows = affectedOrdersList.map((o) => [
      escapeCsv(o.orderId),
      escapeCsv(o.orderNumber),
      escapeCsv(o.referenceNumber),
      escapeCsv(o.createdAt),
      escapeCsv(o.status),
      escapeCsv(o.grandTotal),
      escapeCsv(o.customerName),
      escapeCsv(o.customerPhone),
      escapeCsv(o.totalItemsCount),
      escapeCsv(o.dummyItemsCount),
      escapeCsv(o.dummyItemSkus.join('; ')),
    ]);

    fs.writeFileSync(
      affectedOrdersReportPath,
      [ordersCsvHeaders.join(','), ...ordersCsvRows.map((row) => row.join(','))].join('\n'),
      'utf-8',
    );

    const highConfidenceCount = dummyReports.filter((r) => r.matchConfidence === 'HIGH').length;
    const mediumConfidenceCount = dummyReports.filter((r) => r.matchConfidence === 'MEDIUM').length;
    const unmatchedCount = dummyReports.filter((r) => r.matchConfidence === 'UNMATCHED').length;
    const totalUnits = dummyReports.reduce((s, r) => s + r.totalUnitsSold, 0);

    console.log('\n=============================================================');
    console.log('📊 DRY-RUN AUDIT SUMMARY STATISTICS');
    console.log('=============================================================');
    console.log(`📦 Total Scanned Orders (Nov 5 - 11)   : ${orders.length}`);
    console.log(`🚨 Affected Orders with Dummy Items    : ${affectedOrdersList.length}`);
    console.log(`🏷️  Total Unique Dummy Items Found      : ${dummyReports.length}`);
    console.log(`👕 Total Dummy Units Sold              : ${totalUnits}`);
    console.log('-------------------------------------------------------------');
    console.log(`✅ HIGH Confidence Matches (Exact)      : ${highConfidenceCount} (${((highConfidenceCount / (dummyReports.length || 1)) * 100).toFixed(1)}%)`);
    console.log(`⚠️  MEDIUM Confidence Matches (Fuzzy)   : ${mediumConfidenceCount} (${((mediumConfidenceCount / (dummyReports.length || 1)) * 100).toFixed(1)}%)`);
    console.log(`❌ UNMATCHED Items (Need Manual Review) : ${unmatchedCount} (${((unmatchedCount / (dummyReports.length || 1)) * 100).toFixed(1)}%)`);
    console.log('-------------------------------------------------------------');
    console.log(`📁 CSV Report 1: ${dummyReportPath}`);
    console.log(`📁 CSV Report 2: ${affectedOrdersReportPath}`);
    console.log('=============================================================\n');

    console.log('🔍 PREVIEW OF DETECTED DUMMY ITEMS & MAPPINGS:');
    console.table(
      dummyReports.slice(0, 10).map((r) => ({
        Dummy_SKU: r.dummySku.slice(0, 24),
        Title: r.dummyTitle.slice(0, 24),
        Sold_Qty: r.totalUnitsSold,
        Matched_Real_SKU: r.matchedRealSku || '---',
        Matched_Barcode: r.matchedRealBarcode || '---',
        Size: r.matchedSize || '---',
        Color: r.matchedColor || '---',
        Confidence: r.matchConfidence,
      })),
    );

    console.log('\n💡 Next Step: Review `reports/dummy_items_mapping_report.csv`.');
    console.log('If all mappings look good, we can run the database update script to re-point order items!\n');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runAudit().catch((err) => {
  console.error('\n❌ Audit script failed with error:', err);
});
