/**
 * ==============================================================================
 * SCRIPT: audit_dummy_items_dry_run.ts (V2 - High-Accuracy Matching Engine)
 * PURPOSE: 100% READ-ONLY Audit & Mapping Tool for Courierify Dummy Items
 * 
 * Target Incident: Orders created between Nov 5 - Nov 11, 2026 where SKU mismatch
 * caused auto-creation of fallback/dummy items in IVAR ERP.
 *
 * ADVANCED MATCHING FEATURES (V2):
 * 1. Bidirectional SKU Token Parsing: Automatically handles [Base]-[Size]-[Color]
 *    AND [Base]-[Color]-[Size] (e.g. IVTPRDFTTHRT-M-BR, RILIPOSW-M-STBL, O/STSHIRT-L-BLK).
 * 2. Title-Assisted Color Matching: Scans Dummy Title (e.g. "IVAR Pine Groove...",
 *    "IVAR Grey Flannel...", "Brown", "Steel Blue") against all ERP Colors.
 * 3. Title-Assisted Product Matching: Maps abbreviations like RILIPOSW, O/STSHIRT,
 *    CRNEINVE, ADPLPA, DEJE, MNJOPANT to their true ERP base items.
 * 4. Shopify Online Variant Resolution: For ONL-xxxxxx items (where SKU was blank),
 *    queries Shopify Order API using existing .env credentials to get the exact Size!
 *
 * MULTI-TENANT AWARE:
 * Automatically resolves and connects to the active company's tenant database.
 *
 * SAFETY GUARANTEE:
 * - ZERO DATABASE WRITES (no INSERT, UPDATE, DELETE).
 * - Safe to run directly on LIVE production.
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

// Shopify API configuration for resolving ONL-xxxxxx sizes
const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP_DOMAIN || 'ivarclothing.myshopify.com';
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-10';

// Standard Size Identification Set
const KNOWN_SIZES = new Set([
  's', 'small', 'sm',
  'm', 'medium', 'med',
  'l', 'large', 'lg',
  'xl', 'x-large', 'extra large', '1xl',
  'xxl', 'xx-large', '2xl',
  'xxxl', 'xxx-large', '3xl',
  'xs', 'x-small', 'extra small',
  '28', '30', '32', '34', '36', '38', '40', '42', '44', '46',
  'sz28', 'sz30', 'sz32', 'sz34', 'sz36', 'sz38', 'sz40',
  '39', '41', '43', '45', // Shoe sizes
]);

const SIZE_NORMALIZATION_MAP: Record<string, string> = {
  s: 'small',
  sm: 'small',
  small: 'small',
  m: 'medium',
  med: 'medium',
  medium: 'medium',
  l: 'large',
  lg: 'large',
  large: 'large',
  xl: 'x-large',
  '1xl': 'x-large',
  'extra large': 'x-large',
  'x-large': 'x-large',
  xxl: 'xx-large',
  '2xl': 'xx-large',
  'xx-large': 'xx-large',
  xxxl: 'xxx-large',
  '3xl': 'xxx-large',
  'xxx-large': 'xxx-large',
  xs: 'x-small',
  'extra small': 'x-small',
  'x-small': 'x-small',
  sz28: '28',
  sz30: '30',
  sz32: '32',
  sz34: '34',
  sz36: '36',
  sz38: '38',
  sz40: '40',
};

// Known Base SKU aliases where website SKU differs from ERP SKU
const BASE_SKU_ALIASES: Record<string, string> = {
  'riliposw': 'IVRILLIPOSW', // Johnny Collar Ribline Polo
  'o/stshirt': 'O/STSHIRT',
  'crneinve': 'IVCRNEINVE', // Crew Neck inner Vest
  'adplpa': 'IVADPLPA', // Adjustable Pleated Pants
  'deje': 'IVDEJE', // Denim Jeans
  'knbo': 'IVKNBO', // Knitted Boxer
  'knpa': 'KNPA', // Knitted Pajama
  'mnjopant': 'MNJOPANT', // Stapered Knitted Pants
  'mejope': 'MNJOPANT', // Stapered Knitted Pants
  'ivtdj': 'IVTDJ', // Timeless Denim Jacket
  'ivplgu': 'IVPLGUPNT',
  'ivplgupnt': 'IVPLGUPNT',
  'ivkrn2.0adpa': 'IVKRN2.0ADPA',
  'ivarctrckpnt': 'IVARCTRCKPNT',
  'ivcntrstjcpo': 'IVCNTRSTJCPO',
  'ivoxfdshirt': 'IVOXFDSHIRT',
  'ivraildejo': 'IVRAILDEJO',
  'ivbtnuppo': 'IVBTNUPPO',
  'ivtprdftthrt': 'IVTPRDFTTHRT',
  'ivflquzpr': 'IVFLQUZPR',
  'ivplrflcqtrzpr': 'IVPLRFLCQTRZPR',
  'ivlnenst': 'IVLNENST',
  'ivlnenpnt': 'IVLNENPNT',
  'ivsbadrpndlquzpr': 'IVSBADRPNDLQUZPR',
  'ivwhftrngrtshrt': 'IVWHFTRNGRTSHRT',
  'ivftwhrngrtshrt': 'IVFTWHRNGRTSHRT',
  'ivarlopslvlestshrt': 'IVARLOPSLVLESTSHRT',
  'ivarloptprdftthrt': 'IVARLOPTPRDFTTHRT',
  'ivarlophnly': 'IVARLOPHNLY',
  'ivarlopstppnt': 'IVARLOPSTPPNT',
  'ivdrpnedlvrstyj/cpo': 'IVDRPNEDLVRSTYJ/CPO',
  'ivtppdj/cpo': 'IVTPPDJ/CPO',
  'ivplkflcpo': 'IVPLKFLCPO',
  'ivtxtlnenpnt': 'IVTXTLNENPNT',
  'ivmndrnclrlnenbtndwnshrt': 'IVMNDRNCLRLNENBTNDWNSHRT',
  'ivmnrchbots': 'IVMNRCHBOTS',
  'ivstchlspolo': 'IVSTCHLSPOLO',
  'ivpistjct': 'IVPISTJCT',
  'ric0sut': 'RIC0SUT',
  'thto': 'IVTHTO', // Ribbed Compression Inner
  'weflbr': 'IVWEFLBR', // Wedge Fly Brief
  'drnepo': 'IVDRNEPO', // Drop Needle Polo
  'p3-stbr': 'IVSTBR', // Stretchable Brief
  'flslvmn-shirt': 'IVLNENST', // Pink Salt Linen Shirt
  'ivwfknflslvhnly': 'IVWFKNFLSLVHNLY',
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

async function resolveTenantConnection(): Promise<{ tenantDbUrl: string; tenantName: string }> {
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
      // Continue to management resolution
    } finally {
      try { await testPool.end(); } catch {}
    }
  }

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
      throw new Error(`No active tenant company found in Management Database.`);
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

/**
 * Helper to fetch a Shopify order by order name (e.g. "#130958")
 * Cached in memory so we never query the same order twice.
 */
const shopifyOrderCache = new Map<string, any>();
async function fetchShopifyOrder(orderRef: string): Promise<any | null> {
  const cleanRef = orderRef.replace(/^#+/, '').trim();
  if (!cleanRef || !SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) return null;

  if (shopifyOrderCache.has(cleanRef)) {
    return shopifyOrderCache.get(cleanRef);
  }

  try {
    const auth = Buffer.from(`${SHOPIFY_API_KEY}:${SHOPIFY_API_SECRET}`).toString('base64');
    const url = `https://${SHOPIFY_SHOP}/admin/api/${SHOPIFY_API_VERSION}/orders.json?name=%23${cleanRef}&status=any`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      shopifyOrderCache.set(cleanRef, null);
      return null;
    }

    const data: any = await res.json();
    const order = data.orders && data.orders.length > 0 ? data.orders[0] : null;
    shopifyOrderCache.set(cleanRef, order);
    return order;
  } catch {
    shopifyOrderCache.set(cleanRef, null);
    return null;
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

function normalize(s?: string | null): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function runAudit() {
  const { tenantDbUrl, tenantName } = await resolveTenantConnection();

  const START_DATE = new Date(process.env.AUDIT_START_DATE || '2026-11-05T00:00:00.000Z');
  const END_DATE = new Date(process.env.AUDIT_END_DATE || '2026-11-11T23:59:59.999Z');

  console.log('\n=============================================================');
  console.log('🔍 IVAR ERP - COURIERIFY DUMMY ITEMS DRY-RUN AUDIT (V2)');
  console.log('=============================================================');
  console.log(`📅 Target Date Range : ${START_DATE.toISOString()} to ${END_DATE.toISOString()}`);
  console.log(`🏢 Tenant Database   : ${tenantName}`);
  console.log(`🛡️  Mode              : 100% READ-ONLY (Zero DB writes)`);
  console.log('-------------------------------------------------------------\n');

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
    const colorNamesMap = new Map<string, string>(); // normalized color name -> real color name

    for (const c of allColors) {
      if (c.name) {
        colorNamesMap.set(normalize(c.name), c.name);
      }
    }

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
        orderRefs: Set<string>;
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
              orderRefs: new Set(),
              totalUnits: 0,
            });
          }
          const usage = dummyItemUsageMap.get(it.id)!;
          usage.orderNumbers.add(order.orderNumber);
          if (order.referenceNumber) usage.orderRefs.add(order.referenceNumber);
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

    // Step 4: High-Accuracy Multi-Strategy Matching
    console.log('\n⏳ [4/5] Executing High-Accuracy Multi-Strategy Matching Engine...');

    const dummyReports: DummyItemReport[] = [];
    let processedCount = 0;

    for (const [dummyId, usage] of dummyItemUsageMap.entries()) {
      processedCount++;
      const dummy = usage.item;
      const dummySku = (dummy.sku || '').trim();
      const dummyBarcode = (dummy.barCode || '').trim();
      const dummyDesc = dummy.description || '';
      const normDesc = normalize(dummyDesc);

      let matchedItem: typeof allRealItems[0] | null = null;
      let confidence: 'HIGH' | 'MEDIUM' | 'UNMATCHED' = 'UNMATCHED';
      let matchRule = 'None';

      // ── STRATEGY 1: Direct Barcode Match ──
      if (dummyBarcode) {
        const match = realItemByBarcode.get(dummyBarcode.toLowerCase());
        if (match && match.id !== dummyId) {
          matchedItem = match;
          confidence = 'HIGH';
          matchRule = `Rule 1: Direct Barcode Match (${dummyBarcode})`;
        }
      }

      // ── STRATEGY 2: Bidirectional SKU Token Parsing + Title Color Assistance ──
      if (!matchedItem && dummySku.includes('-')) {
        const parts = dummySku.split('-').map((p: string) => p.trim());
        const rawBase = parts[0].toLowerCase();
        const baseSku = (BASE_SKU_ALIASES[rawBase] || parts[0]).toUpperCase();

        // Check if we have candidate items for this base SKU
        let candidates = realItemsByBaseSku.get(baseSku) || [];

        // If direct base SKU didn't match, check aliases or partial SKU match
        if (candidates.length === 0) {
          for (const [aliasKey, realBase] of Object.entries(BASE_SKU_ALIASES)) {
            if (rawBase.includes(aliasKey) || aliasKey.includes(rawBase)) {
              candidates = realItemsByBaseSku.get(realBase) || [];
              if (candidates.length > 0) break;
            }
          }
        }

        // If candidates exist, parse size and color from parts AND dummy title
        if (candidates.length > 0) {
          let detectedSize = '';
          let detectedColorPart = '';

          // Determine which part is Size and which is Color
          if (parts.length >= 3) {
            const p1 = parts[1].toLowerCase();
            const p2 = parts[2].toLowerCase();

            if (KNOWN_SIZES.has(p1)) {
              // Format: [Base]-[Size]-[Color] (e.g. IVTPRDFTTHRT-M-BR, RILIPOSW-M-STBL, O/STSHIRT-L-BLK)
              detectedSize = SIZE_NORMALIZATION_MAP[p1] || p1;
              detectedColorPart = p2;
            } else if (KNOWN_SIZES.has(p2)) {
              // Format: [Base]-[Color]-[Size] (e.g. IVKRN2.0ADPA-NA-38, IVCNTRSTJCPO-PNGRVE-M)
              detectedSize = SIZE_NORMALIZATION_MAP[p2] || p2;
              detectedColorPart = p1;
            } else {
              detectedColorPart = p1;
              detectedSize = p2;
            }
          } else if (parts.length === 2) {
            const p1 = parts[1].toLowerCase();
            if (KNOWN_SIZES.has(p1)) {
              detectedSize = SIZE_NORMALIZATION_MAP[p1] || p1;
            } else {
              detectedColorPart = p1;
            }
          }

          // Filter candidates by Size
          let sizeFiltered = candidates;
          if (detectedSize) {
            sizeFiltered = candidates.filter((cand) => {
              const cSize = normalize(cand.size?.name);
              return (
                cSize === detectedSize ||
                cSize === `size ${detectedSize}` ||
                cSize.startsWith(detectedSize) ||
                (detectedSize === 'small' && cSize === 's') ||
                (detectedSize === 'medium' && cSize === 'm') ||
                (detectedSize === 'large' && cSize === 'l') ||
                (detectedSize === 'x-large' && (cSize === 'xl' || cSize === 'x large')) ||
                (detectedSize === 'xx-large' && (cSize === 'xxl' || cSize === '2xl' || cSize === 'xx large'))
              );
            });
          }

          // Now match Color among size-filtered candidates
          // Priority 2A: Match Color using the Dummy Title (e.g. "Pine Groove", "Grey Flannel", "Steel Blue", "Brown")
          if (sizeFiltered.length > 0) {
            let colorMatch = sizeFiltered.find((cand) => {
              const candColor = normalize(cand.color?.name);
              return candColor && normDesc.includes(candColor);
            });

            // Priority 2B: Match Color code from SKU (e.g. "br", "stbl", "pngrve", "blk", "wh")
            if (!colorMatch && detectedColorPart) {
              colorMatch = sizeFiltered.find((cand) => {
                const candColor = normalize(cand.color?.name);
                // Exact code match or initials match (e.g. "stbl" in "steel blue", "br" in "brown")
                if (candColor === detectedColorPart) return true;
                const initials = candColor.split(' ').map((w) => w[0]).join('');
                if (initials === detectedColorPart) return true;
                if (candColor.startsWith(detectedColorPart)) return true;
                return false;
              });
            }

            if (colorMatch) {
              matchedItem = colorMatch;
              confidence = 'HIGH';
              matchRule = `Rule 2: Base SKU (${baseSku}) + Size (${detectedSize || 'Any'}) + Color (${colorMatch.color?.name})`;
            } else if (sizeFiltered.length === 1) {
              // Only one variant exists with this size
              matchedItem = sizeFiltered[0];
              confidence = 'MEDIUM';
              matchRule = `Rule 2C: Base SKU (${baseSku}) + Size (${detectedSize}) (Sole Variant)`;
            }
          }
        }
      }

      // ── STRATEGY 3: Title-Assisted Matching for ONL-xxxxxx & Unmatched Items ──
      if (!matchedItem && (dummySku.startsWith('ONL-') || !matchedItem)) {
        // Step A: Check if we can fetch the exact variant from Shopify order
        let shopifySize = '';
        if (usage.orderRefs.size > 0 && SHOPIFY_API_KEY) {
          for (const ref of usage.orderRefs) {
            const shOrder = await fetchShopifyOrder(ref);
            if (shOrder && Array.isArray(shOrder.line_items)) {
              // Match line item by price or title similarity
              const shLine = shOrder.line_items.find((li: any) => {
                const liTitle = normalize(li.title);
                return (
                  (Math.abs(Number(li.price) - (dummy.unitPrice || 0)) <= 5 || liTitle.includes(normDesc) || normDesc.includes(liTitle)) &&
                  li.variant_title
                );
              });
              if (shLine && shLine.variant_title) {
                // e.g. "Small / Navy" or "Medium" or "Large"
                const vParts = shLine.variant_title.split('/').map((s: string) => normalize(s));
                for (const vp of vParts) {
                  if (KNOWN_SIZES.has(vp) || SIZE_NORMALIZATION_MAP[vp]) {
                    shopifySize = SIZE_NORMALIZATION_MAP[vp] || vp;
                    break;
                  }
                }
                if (shopifySize) break;
              }
            }
          }
        }

        // Step B: Match against all real items using Title + Color + Size
        // Find real items whose description has high overlap with dummy title
        const potentialMatches = allRealItems.filter((cand) => {
          if (!cand.description) return false;
          const candDesc = normalize(cand.description);
          // Check core tokens overlap
          const candTokens = candDesc.split(' ').filter((w) => w.length > 2 && w !== 'ivar');
          const matchedTokens = candTokens.filter((t) => normDesc.includes(t));
          return matchedTokens.length >= Math.min(2, candTokens.length);
        });

        if (potentialMatches.length > 0) {
          // Filter by Title Color
          let colorFiltered = potentialMatches.filter((cand) => {
            const candColor = normalize(cand.color?.name);
            return candColor && normDesc.includes(candColor);
          });
          if (colorFiltered.length === 0) colorFiltered = potentialMatches;

          // Filter by Shopify Size if discovered
          if (shopifySize) {
            const sizeAndColorMatch = colorFiltered.find((cand) => {
              const cSize = normalize(cand.size?.name);
              return cSize === shopifySize || cSize.startsWith(shopifySize);
            });
            if (sizeAndColorMatch) {
              matchedItem = sizeAndColorMatch;
              confidence = 'HIGH';
              matchRule = `Rule 3A: Title Match + Shopify Size (${shopifySize}) + Color (${sizeAndColorMatch.color?.name})`;
            }
          }

          // If still not matched, check if sole candidate
          if (!matchedItem && colorFiltered.length === 1) {
            matchedItem = colorFiltered[0];
            confidence = 'MEDIUM';
            matchRule = `Rule 3B: Title Overlap + Color (${colorFiltered[0].color?.name}) (Sole Match)`;
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

      if (processedCount % 50 === 0 || processedCount === dummyItemUsageMap.size) {
        process.stdout.write(`   ↳ Processed ${processedCount}/${dummyItemUsageMap.size} dummy items...\r`);
      }
    }

    console.log(`\n   ✅ Matching completed for all ${dummyReports.length} dummy items.`);

    // Step 5: Export CSV Reports and Print Summary Table
    console.log('\n⏳ [5/5] Generating Updated CSV Reports...');

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

    const highConfidenceCount = dummyReports.filter((r) => r.matchConfidence === 'HIGH').length;
    const mediumConfidenceCount = dummyReports.filter((r) => r.matchConfidence === 'MEDIUM').length;
    const unmatchedCount = dummyReports.filter((r) => r.matchConfidence === 'UNMATCHED').length;
    const matchedCount = highConfidenceCount + mediumConfidenceCount;
    const totalUnits = dummyReports.reduce((s, r) => s + r.totalUnitsSold, 0);

    console.log('\n=============================================================');
    console.log('📊 DRY-RUN AUDIT SUMMARY STATISTICS (V2 ENGINE)');
    console.log('=============================================================');
    console.log(`📦 Total Scanned Orders (Nov 5 - 11)   : ${orders.length}`);
    console.log(`🚨 Affected Orders with Dummy Items    : ${affectedOrdersList.length}`);
    console.log(`🏷️  Total Unique Dummy Items Found      : ${dummyReports.length}`);
    console.log(`👕 Total Dummy Units Sold              : ${totalUnits}`);
    console.log('-------------------------------------------------------------');
    console.log(`🎯 TOTAL RESOLVED MATCHES               : ${matchedCount} / ${dummyReports.length} (${((matchedCount / (dummyReports.length || 1)) * 100).toFixed(1)}%)`);
    console.log(`   ✅ HIGH Confidence Matches (Exact)  : ${highConfidenceCount} (${((highConfidenceCount / (dummyReports.length || 1)) * 100).toFixed(1)}%)`);
    console.log(`   ⚠️  MEDIUM Confidence Matches (Fuzzy): ${mediumConfidenceCount} (${((mediumConfidenceCount / (dummyReports.length || 1)) * 100).toFixed(1)}%)`);
    console.log(`❌ UNMATCHED Items (Remaining)         : ${unmatchedCount} (${((unmatchedCount / (dummyReports.length || 1)) * 100).toFixed(1)}%)`);
    console.log('-------------------------------------------------------------');
    console.log(`📁 CSV Report: ${dummyReportPath}`);
    console.log('=============================================================\n');

    console.log('🔍 PREVIEW OF NEWLY RESOLVED MAPPINGS:');
    console.table(
      dummyReports.slice(0, 15).map((r) => ({
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
    console.log('Once satisfied, we can run the database update script to re-point order items!\n');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runAudit().catch((err) => {
  console.error('\n❌ Audit script failed with error:', err);
});
