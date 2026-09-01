// @ts-nocheck
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaClient as ManagementClient } from '@prisma/management-client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as crypto from 'crypto';

// ─── Decryption Helper ──────────────────────────────────────────────
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

// ─── Get Active Tenant Prisma Client ─────────────────────────────────
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
          console.log(`✅ Connected to active tenant DB: ${company.name} (${company.dbName})`);
          await mClient.$disconnect().catch(() => {});
          await mPool.end().catch(() => {});

          const tPool = new Pool({ connectionString });
          const tAdapter = new PrismaPg(tPool);
          return new PrismaClient({ adapter: tAdapter } as any);
        }
      }
    } catch (err: any) {
      console.warn(`⚠️ Management DB lookup warning: ${err.message}`);
    } finally {
      await mClient.$disconnect().catch(() => {});
      await mPool.end().catch(() => {});
    }
  }

  const defaultUrl = process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/ivar_erp?schema=public';
  console.log(`ℹ️ Using default database connection URL...`);
  const fallbackPool = new Pool({ connectionString: defaultUrl });
  const fallbackAdapter = new PrismaPg(fallbackPool);
  return new PrismaClient({ adapter: fallbackAdapter } as any);
}

// ─── FBR Payload & Sync Helpers ─────────────────────────────────────
function isNonZeroHsCode(str?: string | null): boolean {
  if (!str) return false;
  const cleaned = str.replace(/[^0-9]/g, '');
  return cleaned.length > 0 && !/^0+$/.test(cleaned);
}

function formatPctCode(pctCode?: string | null): string {
  if (!pctCode) return '00000000';
  const cleaned = pctCode.replace(/[^0-9]/g, '');
  if (!cleaned || /^0+$/.test(cleaned)) return '00000000';
  if (cleaned.length >= 8) return cleaned.substring(0, 8);
  return cleaned.padEnd(8, '0');
}

function formatFbrDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
}

async function postFbrInvoice(payload: any, bearerToken: string): Promise<any> {
  const url = process.env.FBR_API_URL || 'https://esp.fbr.gov.pk:8244/imsp/v1/api/Live/PostData';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`;
  }

  const fetchOptions: any = {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  };

  if (url.includes('fbr.gov.pk')) {
    fetchOptions.tls = { rejectUnauthorized: false };
  }

  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`FBR HTTP ${response.status}: ${errText}`);
  }
  return await response.json();
}

// ─── Main Script Function ───────────────────────────────────────────
async function main() {
  console.log('\n==================================================');
  console.log('🚀 FBR Unsynced Invoices Finder & Sync Script');
  console.log('==================================================\n');

  // Parse CLI flags
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  const prefixIdx = args.findIndex((a) => a === '--prefix' || a === '-p');
  const orderPrefix = prefixIdx !== -1 && args[prefixIdx + 1] ? args[prefixIdx + 1] : 'SI-';

  const startIdx = args.findIndex((a) => a === '--start' || a === '-s');
  const startDateStr = startIdx !== -1 && args[startIdx + 1] ? args[startIdx + 1] : '2026-08-19';

  const endIdx = args.findIndex((a) => a === '--end' || a === '-e');
  const endDateStr = endIdx !== -1 && args[endIdx + 1] ? args[endIdx + 1] : '2026-08-26';

  console.log(`📌 Filtering Configuration:`);
  console.log(`   - Order Prefix Constraint: "${orderPrefix}"`);
  console.log(`   - Date Range Constraint:  ${startDateStr}  TO  ${endDateStr}`);
  console.log(`   - Mode:                   ${isDryRun ? '🔍 DRY RUN (Preview only)' : '⚡ LIVE SYNC'}`);
  console.log(`--------------------------------------------------\n`);

  const prisma = await getPrismaClient();

  try {
    const startDate = new Date(`${startDateStr}T00:00:00.000Z`);
    const endDate = new Date(`${endDateStr}T23:59:59.999Z`);

    // 1. Fetch filtered unsynced sales orders
    const whereCondition: any = {
      status: { notIn: ['hold', 'hold_expired', 'hold_cancelled'] },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      OR: [
        { fbrStatus: { not: 'SYNCED' } },
        { fbrInvoiceNumber: null },
      ],
    };

    if (orderPrefix && orderPrefix !== 'ALL') {
      whereCondition.orderNumber = { startsWith: orderPrefix, mode: 'insensitive' };
    }

    const unsyncedOrders = await prisma.salesOrder.findMany({
      where: whereCondition,
      include: {
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`📋 Total Unsynced Invoices Found (Matching Criteria): ${unsyncedOrders.length}`);

    if (unsyncedOrders.length === 0) {
      console.log('✨ No matching unsynced invoices found for the specified date range and prefix!');
      return;
    }

    // Load locations
    const locationIds = [...new Set(unsyncedOrders.map((o) => o.locationId).filter(Boolean))] as string[];
    const locations = locationIds.length > 0
      ? await prisma.location.findMany({
          where: { id: { in: locationIds } },
          select: {
            id: true,
            name: true,
            fbrEnabled: true,
            fbrBposId: true,
            fbrBearerToken: true,
          },
        })
      : [];
    const locationMap = new Map(locations.map((l) => [l.id, l]));

    // Display Table Overview
    const tableData = unsyncedOrders.map((o) => {
      const loc = o.locationId ? locationMap.get(o.locationId) : null;
      return {
        'Order #': o.orderNumber,
        'Date': new Date(o.createdAt).toISOString().split('T')[0],
        'Location': loc?.name || 'Unknown',
        'Amount (PKR)': Number(o.grandTotal).toLocaleString('en-PK', { minimumFractionDigits: 2 }),
        'FBR Configured': loc?.fbrEnabled && loc?.fbrBposId ? 'Yes ✅' : 'No ❌',
        'FBR Status': o.fbrStatus || 'PENDING',
      };
    });

    console.log('\n--- Unsynced Invoices List ---');
    console.table(tableData);

    const totalUnsyncedValue = unsyncedOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
    console.log(`\n💰 Total Pending Invoice Value: PKR ${totalUnsyncedValue.toLocaleString('en-PK', { minimumFractionDigits: 2 })}\n`);

    if (isDryRun) {
      console.log('🔍 Dry run complete. No invoices were posted to FBR.');
      console.log('💡 To perform live sync, run without --dry-run flag.');
      return;
    }

    // 2. Perform FBR Sync Iteration
    console.log('==================================================');
    console.log('⚡ Starting Bulk FBR Submission...');
    console.log('==================================================\n');

    let syncedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const order of unsyncedOrders) {
      const loc = order.locationId ? locationMap.get(order.locationId) : null;

      if (!loc || !loc.fbrEnabled || !loc.fbrBposId || !loc.fbrBearerToken) {
        console.log(`⏭️ [SKIPPED] Order ${order.orderNumber} - FBR disabled or credentials missing for location "${loc?.name || order.locationId}"`);
        skippedCount++;
        continue;
      }

      // Fetch items for HS Code
      const itemIds = order.items.map((i) => i.itemId);
      const itemRecords = await prisma.item.findMany({
        where: { id: { in: itemIds } },
        select: {
          id: true,
          sku: true,
          description: true,
          hsCodeStr: true,
          hsCode: { select: { hsCode: true } },
        },
      });
      const itemMap = new Map(itemRecords.map((r: any) => [r.id, r]));

      const fbrItems = order.items.map((line) => {
        const rec = itemMap.get(line.itemId);
        const validHsCode: string | null = (
          isNonZeroHsCode(rec?.hsCode?.hsCode)
            ? rec?.hsCode?.hsCode
            : isNonZeroHsCode(rec?.hsCodeStr)
              ? rec?.hsCodeStr
              : rec?.hsCode?.hsCode || rec?.hsCodeStr || null
        ) ?? null;

        const taxDivisor = 1 + (Number(line.taxPercent) / 100);
        const wostPerUnit = Number(line.unitPrice) / taxDivisor;
        const totalWost = wostPerUnit * Number(line.quantity);
        const saleValue = Math.max(0, Math.round((totalWost - Number(line.discountAmount)) * 100) / 100);
        const taxCharged = Math.round(Number(line.taxAmount) * 100) / 100;
        const discount = Math.round(Number(line.discountAmount) * 100) / 100;
        const totalAmount = Math.round((saleValue + taxCharged) * 100) / 100;

        return {
          ItemCode: rec?.sku || line.itemId,
          ItemName: (rec?.description || rec?.sku || 'Item').replace(/[^\x20-\x7E]/g, ' ').substring(0, 150),
          PCTCode: formatPctCode(validHsCode),
          Quantity: Number(line.quantity),
          TaxRate: Number(line.taxPercent),
          SaleValue: saleValue,
          Discount: discount,
          FurtherTax: 0,
          TaxCharged: taxCharged,
          TotalAmount: totalAmount,
          InvoiceType: 1,
        };
      });

      const totalSaleValue = Math.round(fbrItems.reduce((acc, i) => acc + i.SaleValue, 0) * 100) / 100;
      const totalTaxCharged = Math.round(fbrItems.reduce((acc, i) => acc + i.TaxCharged, 0) * 100) / 100;
      const totalQuantity = fbrItems.reduce((acc, i) => acc + i.Quantity, 0);
      const totalDiscount = Math.round(fbrItems.reduce((acc, i) => acc + i.Discount, 0) * 100) / 100;
      const totalBillAmount = Math.round((totalSaleValue + totalTaxCharged) * 100) / 100;

      const posIdNum = parseInt(String(loc.fbrBposId), 10) || 0;

      const payload = {
        InvoiceNumber: '',
        POSID: posIdNum,
        USIN: order.orderNumber || order.id,
        DateTime: formatFbrDateTime(new Date(order.createdAt)),
        BuyerNTN: null,
        BuyerCNIC: null,
        BuyerName: 'Guest',
        BuyerPhoneNumber: null,
        TotalSaleValue: totalSaleValue,
        TotalTaxCharged: totalTaxCharged,
        TotalQuantity: totalQuantity,
        Discount: totalDiscount,
        FurtherTax: 0,
        TotalBillAmount: totalBillAmount,
        PaymentMode: 1,
        InvoiceType: 1,
        Items: fbrItems,
      };

      try {
        const response = await postFbrInvoice(payload, loc.fbrBearerToken);
        const codeStr = String(response.Code ?? '');

        if (codeStr === '100' && response.InvoiceNumber) {
          console.log(`✅ [SYNCED] Order ${order.orderNumber} -> FBR Invoice #: ${response.InvoiceNumber}`);
          await prisma.salesOrder.update({
            where: { id: order.id },
            data: {
              fbrInvoiceNumber: String(response.InvoiceNumber),
              fbrQrCode: response.QRCode || String(response.InvoiceNumber),
              fbrStatus: 'SYNCED',
            },
          });
          syncedCount++;
        } else {
          const errMsg = response.Errors || response.Response || `Code ${response.Code}`;
          console.error(`❌ [FAILED] Order ${order.orderNumber} -> ${errMsg}`);
          await prisma.salesOrder.update({
            where: { id: order.id },
            data: { fbrStatus: 'FAILED' },
          });
          failedCount++;
        }
      } catch (err: any) {
        console.error(`❌ [EXCEPTION] Order ${order.orderNumber} -> ${err.message}`);
        await prisma.salesOrder.update({
          where: { id: order.id },
          data: { fbrStatus: 'FAILED' },
        });
        failedCount++;
      }
    }

    console.log('\n==================================================');
    console.log('🏁 Execution Finished!');
    console.log(`   - Synced:  ${syncedCount}`);
    console.log(`   - Failed:  ${failedCount}`);
    console.log(`   - Skipped: ${skippedCount}`);
    console.log('==================================================\n');

  } catch (err: any) {
    console.error('❌ Global script exception:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
