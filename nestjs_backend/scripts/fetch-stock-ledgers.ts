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
    console.log('🔗 Connecting using explicit DATABASE_URL_TENANT...');
    const pool = new Pool({ connectionString: explicitTenantUrl });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter } as any);
  }

  const managementUrl = process.env.DATABASE_URL_MANAGEMENT || process.env.DATABASE_URL;
  const masterKey = process.env.MASTER_ENCRYPTION_KEY;

  if (managementUrl && masterKey) {
    console.log('🔍 Locating active tenant database from Management DB...');
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
          console.log(`✅ Connected to active tenant: ${company.name} (${company.dbName})`);
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
  console.log(`ℹ️ Falling back to default database URL...`);
  const fallbackPool = new Pool({ connectionString: defaultUrl });
  const fallbackAdapter = new PrismaPg(fallbackPool);
  return new PrismaClient({ adapter: fallbackAdapter } as any);
}

async function run() {
  const locationId = process.argv[2] || 'a6448ab5-24f0-4e39-854a-8c70ca98488e';
  const asOfDateStr = process.argv[3] || '2026-08-25';

  const targetDate = new Date(asOfDateStr);
  targetDate.setHours(23, 59, 59, 999);

  console.log(`=======================================================`);
  console.log(`📦 STOCK LEDGER FETCH & AVAILABLE STOCK CALCULATION`);
  console.log(`=======================================================`);
  console.log(`📍 Location ID: ${locationId}`);
  console.log(`📅 Cut-off Date (As of): ${targetDate.toISOString()}`);
  console.log(`-------------------------------------------------------\n`);

  const prisma = await getPrismaClient();

  try {
    // 1. Fetch location details
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true, name: true, code: true },
    });

    if (location) {
      console.log(`🏢 Location Name: ${location.name} (${location.code || 'N/A'})\n`);
    } else {
      console.log(`⚠️  Location with ID ${locationId} not found in database.`);
      const allLocations = await prisma.location.findMany({ select: { id: true, name: true, code: true } });
      console.log(`📋 Available Locations in DB (${allLocations.length}):`);
      allLocations.forEach(l => console.log(`   - ID: ${l.id} | Name: ${l.name} | Code: ${l.code || 'N/A'}`));
      
      const allWarehouses = await prisma.warehouse.findMany({ select: { id: true, name: true } });
      console.log(`\n🏬 Available Warehouses in DB (${allWarehouses.length}):`);
      allWarehouses.forEach(w => console.log(`   - ID: ${w.id} | Name: ${w.name}`));
      console.log(`\n`);
    }

    const totalStockLedgers = await prisma.stockLedger.count();
    console.log(`📊 Total StockLedger rows in entire DB: ${totalStockLedgers}`);

    // 2. Fetch all stock ledger entries up to targetDate for location or warehouse
    const ledgers = await prisma.stockLedger.findMany({
      where: {
        OR: [
          { locationId: locationId },
          { warehouseId: locationId },
        ],
        createdAt: { lte: targetDate },
      },
      include: {
        item: {
          include: {
            color: true,
            size: true,
            brand: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`📊 Found ${ledgers.length} total StockLedger entries for location up to ${asOfDateStr}.\n`);

    // Group ledger entries by Item ID
    const itemLedgerSummary = new Map<string, {
      itemId: string;
      sku: string;
      description: string;
      color: string;
      size: string;
      unitPrice: number;
      unitCost: number;
      totalIn: number;
      totalOut: number;
      availableQty: number;
      entriesCount: number;
    }>();

    for (const entry of ledgers) {
      const qty = Number(entry.qty || 0);
      const item = entry.item;
      if (!item) continue;

      let summary = itemLedgerSummary.get(entry.itemId);
      if (!summary) {
        summary = {
          itemId: entry.itemId,
          sku: item.sku,
          description: item.description || '',
          color: item.color?.name || 'N/A',
          size: item.size?.name || 'N/A',
          unitPrice: Number(item.unitPrice || 0),
          unitCost: Number(item.unitCost || 0),
          totalIn: 0,
          totalOut: 0,
          availableQty: 0,
          entriesCount: 0,
        };
        itemLedgerSummary.set(entry.itemId, summary);
      }

      summary.entriesCount++;
      if (qty > 0) {
        summary.totalIn += qty;
      } else {
        summary.totalOut += Math.abs(qty);
      }
      summary.availableQty += qty;
    }

    // 3. Query In-Transit stock for this location
    const transitItems = await prisma.transferRequestItem.findMany({
      where: {
        transferRequest: {
          toLocationId: locationId,
          createdAt: { lte: targetDate },
          status: { in: ['PENDING', 'SOURCE_APPROVED'] },
        },
      },
      select: { itemId: true, quantity: true },
    });

    const transitMap = new Map<string, number>();
    for (const t of transitItems) {
      const q = Number(t.quantity || 0);
      transitMap.set(t.itemId, (transitMap.get(t.itemId) || 0) + q);
    }

    // 4. Query Reserved stock for this location
    const reserveGroup = await prisma.stockReserve.groupBy({
      by: ['itemId'],
      where: {
        createdAt: { lte: targetDate },
        OR: [{ expiresAt: null }, { expiresAt: { gte: targetDate } }],
      },
      _sum: { quantity: true },
    });

    const reserveMap = new Map<string, number>();
    for (const r of reserveGroup) {
      reserveMap.set(r.itemId, Number(r._sum.quantity || 0));
    }

    // Format and Output Results Table
    console.log(`==============================================================================================================================================`);
    console.log(`| SKU                     | Variant (Size-Color)   | Ledger IN  | Ledger OUT | Available  | Transit | Reserved | Total Stock | Value (Selling) | Value (Costing) |`);
    console.log(`==============================================================================================================================================`);

    let grandTotalIn = 0;
    let grandTotalOut = 0;
    let grandAvailable = 0;
    let grandTransit = 0;
    let grandReserved = 0;
    let grandTotalStock = 0;
    let grandSellingVal = 0;
    let grandCostingVal = 0;

    for (const [itemId, summary] of itemLedgerSummary.entries()) {
      const transit = transitMap.get(itemId) || 0;
      const reserved = reserveMap.get(itemId) || 0;
      const totalStock = summary.availableQty + transit + reserved;
      const sellingVal = totalStock * summary.unitPrice;
      const costingVal = totalStock * summary.unitCost;

      grandTotalIn += summary.totalIn;
      grandTotalOut += summary.totalOut;
      grandAvailable += summary.availableQty;
      grandTransit += transit;
      grandReserved += reserved;
      grandTotalStock += totalStock;
      grandSellingVal += sellingVal;
      grandCostingVal += costingVal;

      const variantStr = `${summary.size}-${summary.color}`;
      console.log(
        `| ${summary.sku.padEnd(23)} | ${variantStr.padEnd(22)} | ${String(summary.totalIn).padStart(10)} | ${String(summary.totalOut).padStart(10)} | ${String(summary.availableQty).padStart(10)} | ${String(transit).padStart(7)} | ${String(reserved).padStart(8)} | ${String(totalStock).padStart(11)} | ${sellingVal.toLocaleString('en-US', { minimumFractionDigits: 2 }).padStart(15)} | ${costingVal.toLocaleString('en-US', { minimumFractionDigits: 2 }).padStart(15)} |`
      );
    }

    console.log(`==============================================================================================================================================`);
    console.log(
      `| GRAND TOTALS (${String(itemLedgerSummary.size).padStart(3)} Items)                     | ${String(grandTotalIn).padStart(10)} | ${String(grandTotalOut).padStart(10)} | ${String(grandAvailable).padStart(10)} | ${String(grandTransit).padStart(7)} | ${String(grandReserved).padStart(8)} | ${String(grandTotalStock).padStart(11)} | ${grandSellingVal.toLocaleString('en-US', { minimumFractionDigits: 2 }).padStart(15)} | ${grandCostingVal.toLocaleString('en-US', { minimumFractionDigits: 2 }).padStart(15)} |`
    );
    console.log(`==============================================================================================================================================\n`);

  } catch (error) {
    console.error(`❌ Error fetching stock ledgers:`, error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
