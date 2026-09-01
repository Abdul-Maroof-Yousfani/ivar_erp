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

// ─── Helpers ────────────────────────────────────────────────────────
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

async function main() {
  console.log('\n==================================================');
  console.log('🛠️ Pre-12-AUG Duplicate FBR Invoice Reversal Script');
  console.log('==================================================\n');

  const args = process.argv.slice(2);
  const isSendCreditNotes = args.includes('--send-credit-notes');
  const isResetDbOnly = args.includes('--reset-db-only');
  const isPreview = !isSendCreditNotes && !isResetDbOnly;

  const cutoffDate = new Date('2026-08-12T00:00:00.000Z');

  console.log(`📌 Operational Mode:`);
  if (isPreview) {
    console.log(`   🔍 PREVIEW MODE (Run with --send-credit-notes or --reset-db-only to execute)`);
  } else if (isSendCreditNotes) {
    console.log(`   ⚡ CREDIT NOTE MODE (Sending FBR Credit Notes - InvoiceType 3 to reverse on FBR server)`);
  } else if (isResetDbOnly) {
    console.log(`   🔄 DB RESET ONLY MODE (Clearing FBR invoice numbers from local DB only)`);
  }
  console.log(`   - Cutoff Date: Pre-12-AUG-2026 (< ${cutoffDate.toISOString().split('T')[0]})`);
  console.log(`--------------------------------------------------\n`);

  const prisma = await getPrismaClient();

  try {
    // Query all orders created BEFORE 12-AUG-2026 that match store codes (MPI8-, DHAZ-, SHAR-, BKC-) and never start with SI-
    const duplicateOrders = await prisma.salesOrder.findMany({
      where: {
        createdAt: { lt: cutoffDate },
        fbrStatus: 'SYNCED',
        fbrInvoiceNumber: { not: null },
        NOT: {
          orderNumber: { startsWith: 'SI-', mode: 'insensitive' },
        },
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`📋 Found ${duplicateOrders.length} pre-12-AUG store sales order(s) (MPI8-, DHAZ-, SHAR-, BKC-) synced to FBR.`);

    if (duplicateOrders.length === 0) {
      console.log('✨ No pre-12-AUG duplicate FBR invoices found!');
      return;
    }

    const totalValue = duplicateOrders.reduce((acc, o) => acc + Number(o.grandTotal), 0);

    console.table(
      duplicateOrders.map((o) => ({
        'Order #': o.orderNumber,
        'Date Created': new Date(o.createdAt).toISOString().split('T')[0],
        'FBR Invoice #': o.fbrInvoiceNumber,
        'Amount (PKR)': Number(o.grandTotal).toLocaleString('en-PK', { minimumFractionDigits: 2 }),
      })),
    );

    console.log(`\n💰 Total Duplicate Invoices Value: PKR ${totalValue.toLocaleString('en-PK', { minimumFractionDigits: 2 })}\n`);

    if (isPreview) {
      console.log('==================================================');
      console.log('💡 INSTRUCTIONS:');
      console.log('1. To send FBR Credit Notes (InvoiceType 3) to cancel duplicate bills on FBR server:');
      console.log('   bun scripts/revert-duplicate-fbr-pre-aug12.ts --send-credit-notes\n');
      console.log('2. To reset database status ONLY (without sending FBR credit notes):');
      console.log('   bun scripts/revert-duplicate-fbr-pre-aug12.ts --reset-db-only');
      console.log('==================================================\n');
      return;
    }

    // ── Mode 1: Reset DB Only ──
    if (isResetDbOnly) {
      console.log('⚡ Resetting database FBR status for pre-12-AUG orders...');
      const updated = await prisma.salesOrder.updateMany({
        where: {
          id: { in: duplicateOrders.map((o) => o.id) },
        },
        data: {
          fbrInvoiceNumber: null,
          fbrQrCode: null,
          fbrStatus: 'EXEMPT_PREVIOUS_SYSTEM',
        },
      });
      console.log(`✅ Successfully reset ${updated.count} orders in DB to "EXEMPT_PREVIOUS_SYSTEM".`);
      return;
    }

    // ── Mode 2: Send FBR Credit Notes (InvoiceType 3) ──
    console.log('⚡ Sending FBR Credit Notes (InvoiceType 3 / Returns) to FBR Server...');

    const locationIds = [...new Set(duplicateOrders.map((o) => o.locationId).filter(Boolean))] as string[];
    const locations = locationIds.length > 0
      ? await prisma.location.findMany({
          where: { id: { in: locationIds } },
          select: { id: true, name: true, fbrEnabled: true, fbrBposId: true, fbrBearerToken: true },
        })
      : [];
    const locationMap = new Map(locations.map((l) => [l.id, l]));

    let reversedCount = 0;
    let failedCount = 0;

    for (const order of duplicateOrders) {
      const loc = order.locationId ? locationMap.get(order.locationId) : null;
      if (!loc || !loc.fbrEnabled || !loc.fbrBposId || !loc.fbrBearerToken) {
        console.log(`⏭️ [SKIPPED] Order ${order.orderNumber} - FBR credentials missing`);
        continue;
      }

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
          InvoiceType: 3, // Credit Note
          RefUSIN: order.orderNumber || order.id,
        };
      });

      const totalSaleValue = Math.round(fbrItems.reduce((acc, i) => acc + i.SaleValue, 0) * 100) / 100;
      const totalTaxCharged = Math.round(fbrItems.reduce((acc, i) => acc + i.TaxCharged, 0) * 100) / 100;
      const totalQuantity = fbrItems.reduce((acc, i) => acc + i.Quantity, 0);
      const totalDiscount = Math.round(fbrItems.reduce((acc, i) => acc + i.Discount, 0) * 100) / 100;
      const totalBillAmount = Math.round((totalSaleValue + totalTaxCharged) * 100) / 100;

      const posIdNum = parseInt(String(loc.fbrBposId), 10) || 0;
      const creditNoteUsin = `CN-${order.orderNumber}`;

      const payload = {
        InvoiceNumber: '',
        POSID: posIdNum,
        USIN: creditNoteUsin,
        DateTime: formatFbrDateTime(new Date()),
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
        InvoiceType: 3, // Credit Note / Return
        RefUSIN: order.orderNumber || order.id,
        Items: fbrItems,
      };

      try {
        const response = await postFbrInvoice(payload, loc.fbrBearerToken);
        const codeStr = String(response.Code ?? '');

        if (codeStr === '100' && response.InvoiceNumber) {
          console.log(`✅ [CREDIT NOTE ISSUED] Order ${order.orderNumber} -> FBR Credit Note #: ${response.InvoiceNumber}`);
          await prisma.salesOrder.update({
            where: { id: order.id },
            data: {
              fbrInvoiceNumber: null,
              fbrQrCode: null,
              fbrStatus: 'EXEMPT_PREVIOUS_SYSTEM',
            },
          });
          reversedCount++;
        } else {
          const errMsg = response.Errors || response.Response || `Code ${response.Code}`;
          console.error(`❌ [FAILED] Order ${order.orderNumber} Credit Note -> ${errMsg}`);
          failedCount++;
        }
      } catch (err: any) {
        console.error(`❌ [EXCEPTION] Order ${order.orderNumber} -> ${err.message}`);
        failedCount++;
      }
    }

    console.log('\n==================================================');
    console.log('🏁 Credit Note Execution Finished!');
    console.log(`   - Reversed on FBR: ${reversedCount}`);
    console.log(`   - Failed:           ${failedCount}`);
    console.log('==================================================\n');

  } catch (err: any) {
    console.error('❌ Global script exception:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
