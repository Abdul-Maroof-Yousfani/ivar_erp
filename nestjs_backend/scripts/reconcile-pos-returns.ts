// @ts-nocheck
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
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

// ─── Resolve Tenant Connections ─────────────────────────────────────
interface TenantInfo {
  name: string;
  dbUrl: string;
}

async function getTenants(): Promise<TenantInfo[]> {
  const explicitTenantUrl = process.env.DATABASE_URL_TENANT;
  if (explicitTenantUrl && !explicitTenantUrl.includes('ivar_managements')) {
    return [{ name: 'Explicit Tenant', dbUrl: explicitTenantUrl }];
  }

  const managementUrl = process.env.DATABASE_URL_MANAGEMENT || process.env.DATABASE_URL;
  const masterKey = process.env.MASTER_ENCRYPTION_KEY;

  if (managementUrl && masterKey) {
    const mPool = new Pool({ connectionString: managementUrl });
    const mAdapter = new PrismaPg(mPool);
    const mClient = new ManagementClient({ adapter: mAdapter } as any);

    try {
      await mClient.$connect();
      const companies = await mClient.company.findMany({
        where: { status: 'active' },
      });

      const list: TenantInfo[] = [];
      for (const comp of companies) {
        let connectionString = comp.dbUrl;
        if (comp.dbPassword && comp.dbPassword.includes(':')) {
          try {
            const plainPass = decrypt(comp.dbPassword, masterKey);
            const urlObj = new URL(comp.dbUrl || '');
            urlObj.password = plainPass;
            connectionString = urlObj.toString();
          } catch (e) {
            console.warn(`Failed decrypting password for company ${comp.name}: ${e.message}`);
          }
        }
        if (connectionString) {
          list.push({ name: comp.name, dbUrl: connectionString });
        }
      }
      await mClient.$disconnect();
      await mPool.end();
      return list;
    } catch (err) {
      console.warn('Could not query management database:', err.message);
    }
  }

  // Fallback to local default tenant
  return [
    {
      name: 'Default Local Tenant',
      dbUrl: 'postgresql://postgres:root@localhost:5432/tenant_ivar_mo2z612h?schema=public',
    },
  ];
}

// ─── Item Candidate Matching Interface ──────────────────────────────
interface ItemCandidate {
  orderItemId: string;
  itemId: string;
  unitPrice: number;
  lineTotal: number;
  paidPerUnit: number;
  quantity: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  name: string;
  sku: string;
}

function findMatchingItems(
  items: ItemCandidate[],
  targetAmount: number,
  orderStatus: string
): { matchedItems: { candidate: ItemCandidate; qty: number; refundPerUnit: number }[]; matchType: string } | null {
  const allSum = items.reduce((s, i) => s + i.lineTotal, 0);
  if (orderStatus === 'returned' || Math.abs(allSum - targetAmount) < 0.15) {
    return {
      matchedItems: items.map((i) => ({
        candidate: i,
        qty: i.quantity,
        refundPerUnit: i.paidPerUnit,
      })),
      matchType: 'FULL_ORDER',
    };
  }

  const candidateVariants: { item: ItemCandidate; value: number }[] = [];
  for (const item of items) {
    const pVal = item.paidPerUnit > 0 ? item.paidPerUnit : item.lineTotal / (item.quantity || 1);
    const rates = [
      pVal,
      item.unitPrice,
      item.unitPrice * 0.75,
      item.unitPrice * 0.70,
      item.unitPrice * 0.80,
      item.unitPrice * 0.85,
    ];
    const uniqueRates = [...new Set(rates.map((r) => Math.round(r * 100) / 100))];
    for (const r of uniqueRates) {
      candidateVariants.push({ item, value: r });
    }
  }

  for (const cv of candidateVariants) {
    if (Math.abs(cv.value - targetAmount) < 0.15) {
      return {
        matchedItems: [{ candidate: cv.item, qty: 1, refundPerUnit: cv.value }],
        matchType: 'EXACT_SINGLE',
      };
    }
  }

  const unitList: { item: ItemCandidate; unitValue: number }[] = [];
  for (const item of items) {
    const pVal = item.paidPerUnit > 0 ? item.paidPerUnit : item.lineTotal / (item.quantity || 1);
    for (let q = 0; q < item.quantity; q++) {
      unitList.push({ item, unitValue: Math.round(pVal * 100) / 100 });
    }
  }

  function subsetSum(
    idx: number,
    currentSum: number,
    chosen: { item: ItemCandidate; unitValue: number }[]
  ): { item: ItemCandidate; unitValue: number }[] | null {
    if (Math.abs(currentSum - targetAmount) < 0.15) return chosen;
    if (currentSum > targetAmount + 0.15 || idx >= unitList.length) return null;

    const withCurrent = subsetSum(idx + 1, currentSum + unitList[idx].unitValue, [...chosen, unitList[idx]]);
    if (withCurrent) return withCurrent;
    return subsetSum(idx + 1, currentSum, chosen);
  }

  const subset = subsetSum(0, 0, []);
  if (subset) {
    const groupMap = new Map<string, { item: ItemCandidate; count: number; unitValue: number }>();
    for (const c of subset) {
      const existing = groupMap.get(c.item.orderItemId);
      if (existing) {
        existing.count++;
      } else {
        groupMap.set(c.item.orderItemId, { item: c.item, count: 1, unitValue: c.unitValue });
      }
    }
    const grouped = Array.from(groupMap.values()).map((g) => ({
      candidate: g.item,
      qty: g.count,
      refundPerUnit: g.unitValue,
    }));
    return { matchedItems: grouped, matchType: 'SUBSET_SUM' };
  }

  const promoUnitList: { item: ItemCandidate; unitValue: number }[] = [];
  for (const item of items) {
    const promoVal = Math.round(item.unitPrice * 0.75 * 100) / 100;
    for (let q = 0; q < item.quantity; q++) {
      promoUnitList.push({ item, unitValue: promoVal });
    }
  }

  function promoSubsetSum(
    idx: number,
    currentSum: number,
    chosen: { item: ItemCandidate; unitValue: number }[]
  ): { item: ItemCandidate; unitValue: number }[] | null {
    if (Math.abs(currentSum - targetAmount) < 0.15) return chosen;
    if (currentSum > targetAmount + 0.15 || idx >= promoUnitList.length) return null;

    const withCurrent = promoSubsetSum(idx + 1, currentSum + promoUnitList[idx].unitValue, [...chosen, promoUnitList[idx]]);
    if (withCurrent) return withCurrent;
    return promoSubsetSum(idx + 1, currentSum, chosen);
  }

  const promoSubset = promoSubsetSum(0, 0, []);
  if (promoSubset) {
    const groupMap = new Map<string, { item: ItemCandidate; count: number; unitValue: number }>();
    for (const c of promoSubset) {
      const existing = groupMap.get(c.item.orderItemId);
      if (existing) {
        existing.count++;
      } else {
        groupMap.set(c.item.orderItemId, { item: c.item, count: 1, unitValue: c.unitValue });
      }
    }
    const grouped = Array.from(groupMap.values()).map((g) => ({
      candidate: g.item,
      qty: g.count,
      refundPerUnit: g.unitValue,
    }));
    return { matchedItems: grouped, matchType: 'PROMO_SUBSET_SUM' };
  }

  if (items.length === 1) {
    const itm = items[0];
    const qty = Math.max(1, Math.round(targetAmount / (itm.paidPerUnit || itm.unitPrice)));
    return {
      matchedItems: [{ candidate: itm, qty, refundPerUnit: targetAmount / qty }],
      matchType: 'SINGLE_LINE_FALLBACK',
    };
  }

  let closest: ItemCandidate | null = null;
  let minDiff = Infinity;
  for (const itm of items) {
    const diff = Math.abs(itm.paidPerUnit - targetAmount);
    if (diff < minDiff) {
      minDiff = diff;
      closest = itm;
    }
  }
  if (closest) {
    return {
      matchedItems: [{ candidate: closest, qty: 1, refundPerUnit: targetAmount }],
      matchType: 'CLOSEST_ITEM_FALLBACK',
    };
  }

  return null;
}

// ─── Reconciliation Runner ──────────────────────────────────────────
async function reconcileTenant(tenant: TenantInfo, isLive: boolean, skipStock: boolean) {
  console.log(`\n======================================================`);
  console.log(`Tenant: ${tenant.name}`);
  console.log(`Mode: ${isLive ? '🔴 LIVE (CHANGES COMMITTED)' : '🟡 DRY RUN (SIMULATION)'}`);
  console.log(`Stock Ledger Restoration: ${skipStock ? 'DISABLED (--skip-stock)' : 'ENABLED'}`);
  console.log(`======================================================\n`);

  const pool = new Pool({ connectionString: tenant.dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    const warehouse = await prisma.warehouse.findFirst({
      where: { isActive: true, isDeleted: false },
    });
    if (!warehouse) {
      console.error(`❌ No active warehouse found in tenant ${tenant.name}. Skipping.`);
      return;
    }

    const vouchers = await prisma.voucher.findMany({
      where: {
        voucherType: { in: ['EXCHANGE', 'REFUND'] },
        sourceOrderId: { not: null },
        isDeleted: false,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Found ${vouchers.length} return vouchers to analyze...`);

    let alreadyReconciled = 0;
    let posReturnsCreated = 0;
    let stockLedgersCreated = 0;
    let inventoryItemsUpdated = 0;
    let errorsCount = 0;

    for (const v of vouchers) {
      try {
        const existingPos = await prisma.posReturn.findFirst({
          where: {
            OR: [{ voucherCode: v.code }, { orderId: v.sourceOrderId! }],
          },
        });

        if (existingPos) {
          alreadyReconciled++;
          continue;
        }

        const order = await prisma.salesOrder.findUnique({
          where: { id: v.sourceOrderId! },
          include: {
            items: {
              include: {
                item: {
                  select: { id: true, description: true, sku: true, barCode: true, unitPrice: true, taxRate1: true },
                },
              },
            },
          },
        });

        if (!order) {
          console.warn(`[WARN] Order ${v.sourceOrderId} not found for voucher ${v.code}`);
          errorsCount++;
          continue;
        }

        const targetAmount = Number(v.faceValue);
        const candidates: ItemCandidate[] = order.items.map((i) => {
          const unitPrice = Number(i.unitPrice);
          const lineTot = Number(i.lineTotal);
          const qty = Number(i.quantity) || 1;
          const paidPerUnit = lineTot / qty;
          const taxRate = Number((i.item as any)?.taxRate1 ?? 18);
          const taxAmount = Number(i.taxAmount || 0) / qty;
          const discountAmount = Number(i.discountAmount || 0) / qty;
          const discountPercent = Number(i.discountPercent || 0);

          return {
            orderItemId: i.id,
            itemId: i.itemId,
            unitPrice,
            lineTotal: lineTot,
            paidPerUnit,
            quantity: qty,
            discountPercent,
            discountAmount,
            taxPercent: taxRate,
            taxAmount,
            name: i.item?.description || 'Item',
            sku: i.item?.sku || '',
          };
        });

        const match = findMatchingItems(candidates, targetAmount, order.status);
        if (!match) {
          console.warn(`[UNMATCHED] Voucher ${v.code} (${targetAmount}) on Order ${order.orderNumber}`);
          errorsCount++;
          continue;
        }

        const returnNumber = order.returnNumber || `SR-${v.code.replace('EXC-', 'EX-').replace('RFD-', 'RF-')}`;
        const effectiveLocationId = v.issuedByLocationId || order.locationId || '';
        const returnType = v.voucherType === 'REFUND' ? 'REFUND' : 'EXCHANGE';

        let totalWost = 0;
        let totalTax = 0;
        let totalDiscount = 0;

        const returnItemsData = match.matchedItems.map((m) => {
          const c = m.candidate;
          const taxPct = c.taxPercent > 0 ? c.taxPercent : 18;
          const netPerUnit = m.refundPerUnit;
          const wostPerUnit = Math.round((netPerUnit / (1 + taxPct / 100)) * 100) / 100;
          const taxPerUnit = Math.round((netPerUnit - wostPerUnit) * 100) / 100;
          const discPerUnit = Math.max(0, Math.round((c.unitPrice - netPerUnit) * 100) / 100);

          totalWost += wostPerUnit * m.qty;
          totalTax += taxPerUnit * m.qty;
          totalDiscount += discPerUnit * m.qty;

          return {
            orderItemId: c.orderItemId,
            itemId: c.itemId,
            quantity: m.qty,
            unitPrice: new Prisma.Decimal(c.unitPrice),
            wostAmount: new Prisma.Decimal(Math.round(wostPerUnit * m.qty * 100) / 100),
            discountPercent: new Prisma.Decimal(c.discountPercent),
            discountAmount: new Prisma.Decimal(Math.round(discPerUnit * m.qty * 100) / 100),
            taxPercent: new Prisma.Decimal(taxPct),
            taxAmount: new Prisma.Decimal(Math.round(taxPerUnit * m.qty * 100) / 100),
            couponDeduction: new Prisma.Decimal(0),
            originalPaidPerUnit: new Prisma.Decimal(netPerUnit),
            refundPerUnit: new Prisma.Decimal(netPerUnit),
            netTotal: new Prisma.Decimal(Math.round(netPerUnit * m.qty * 100) / 100),
            priceAdjusted: false,
          };
        });

        if (isLive) {
          // Create PosReturn and items
          await prisma.posReturn.create({
            data: {
              returnNumber,
              orderId: order.id,
              orderNumber: order.orderNumber,
              returnType,
              locationId: effectiveLocationId,
              originalLocationId: order.locationId,
              cashierUserId: v.issuedByUserId || order.cashierUserId,
              subtotal: new Prisma.Decimal(Math.round(totalWost * 100) / 100),
              discountAmount: new Prisma.Decimal(Math.round(totalDiscount * 100) / 100),
              taxAmount: new Prisma.Decimal(Math.round(totalTax * 100) / 100),
              grandTotal: new Prisma.Decimal(Math.round(targetAmount * 100) / 100),
              refundMode: returnType === 'REFUND' ? 'CASH' : 'VOUCHER',
              voucherCode: v.code,
              reason: v.description || 'Historical return reconciliation',
              createdAt: v.createdAt,
              items: {
                create: returnItemsData,
              },
            },
          });

          if (!order.returnNumber) {
            await prisma.salesOrder.update({
              where: { id: order.id },
              data: { returnNumber },
            });
          }

          if (!skipStock) {
            for (const itm of match.matchedItems) {
              const existingStock = await prisma.stockLedger.findFirst({
                where: {
                  referenceId: order.id,
                  itemId: itm.candidate.itemId,
                  referenceType: { in: ['POS_RETURN', 'POS_REFUND'] },
                },
              });

              if (!existingStock) {
                await prisma.stockLedger.create({
                  data: {
                    item: { connect: { id: itm.candidate.itemId } },
                    warehouse: { connect: { id: warehouse.id } },
                    locationId: effectiveLocationId,
                    qty: itm.qty,
                    unitCost: 0,
                    rate: 0,
                    referenceType: returnType === 'REFUND' ? 'POS_REFUND' : 'POS_RETURN',
                    referenceId: order.id,
                    movementType: 'INBOUND',
                    createdAt: v.createdAt,
                  },
                });
                stockLedgersCreated++;

                const invItem = await prisma.inventoryItem.findFirst({
                  where: {
                    itemId: itm.candidate.itemId,
                    locationId: effectiveLocationId,
                    status: 'AVAILABLE',
                  },
                });

                if (invItem) {
                  await prisma.inventoryItem.update({
                    where: { id: invItem.id },
                    data: { quantity: { increment: itm.qty } },
                  });
                } else {
                  await prisma.inventoryItem.create({
                    data: {
                      itemId: itm.candidate.itemId,
                      warehouseId: warehouse.id,
                      locationId: effectiveLocationId,
                      status: 'AVAILABLE',
                      quantity: itm.qty,
                    },
                  });
                }
                inventoryItemsUpdated++;
              }
            }
          }
        }

        posReturnsCreated++;
        if (posReturnsCreated % 50 === 0) {
          console.log(`Reconciled ${posReturnsCreated} returns...`);
        }
      } catch (itemErr) {
        console.error(`Error reconciling voucher ${v.code}:`, itemErr.message);
        errorsCount++;
      }
    }

    console.log(`\n--- SUMMARY FOR ${tenant.name} ---`);
    console.log(`Already Reconciled: ${alreadyReconciled}`);
    console.log(`PosReturns ${isLive ? 'Created' : 'To Create'}: ${posReturnsCreated}`);
    if (!skipStock) {
      console.log(`StockLedgers ${isLive ? 'Created' : 'To Create'}: ${stockLedgersCreated}`);
      console.log(`InventoryItems ${isLive ? 'Incremented' : 'To Increment'}: ${inventoryItemsUpdated}`);
    }
    console.log(`Errors / Unmatched: ${errorsCount}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function main() {
  const isLive = process.argv.includes('--live');
  const skipStock = process.argv.includes('--skip-stock');

  console.log(`Starting POS Return Reconciliation Script...`);
  const tenants = await getTenants();
  console.log(`Found ${tenants.length} tenant(s) to process.`);

  for (const t of tenants) {
    await reconcileTenant(t, isLive, skipStock);
  }

  console.log(`\nAll done.`);
}

main().catch(console.error);
