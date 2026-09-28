/**
 * ─────────────────────────────────────────────────────────────────
 *  Cross-Location Return Inventory Re-Sync Script
 * ─────────────────────────────────────────────────────────────────
 *  Multi-tenant architecture: connects to management DB first,
 *  fetches all tenant company DB URLs, then runs the fix on each.
 *
 *  Usage:
 *    DRY_RUN=true  npx ts-node -r tsconfig-paths/register src/scripts/fix-cross-location-returns.ts
 *    DRY_RUN=false npx ts-node -r tsconfig-paths/register src/scripts/fix-cross-location-returns.ts
 *
 *    # Run for specific company only:
 *    COMPANY_ID=<id> DRY_RUN=false npx ts-node -r tsconfig-paths/register src/scripts/fix-cross-location-returns.ts
 * ─────────────────────────────────────────────────────────────────
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const DRY_RUN = process.env.DRY_RUN !== 'false';
const TARGET_COMPANY = process.env.COMPANY_ID || null;

// ── Helpers ──────────────────────────────────────────────────────

function makePrismaClient(dbUrl: string): PrismaClient {
  const pool = new Pool({
    connectionString: dbUrl,
    max: 5,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 10000,
  });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter } as any);
  (client as any)._pool = pool;
  return client;
}

async function closePrismaClient(client: PrismaClient) {
  const pool = (client as any)._pool as Pool | undefined;
  await client.$disconnect();
  if (pool) await pool.end();
}

// ── Decrypt tenant DB URL (uses same logic as auth service) ──────

function decryptDbUrl(encrypted: string): string {
  // If already a plain URL (development), return as-is
  if (encrypted.startsWith('postgresql://') || encrypted.startsWith('postgres://')) {
    return encrypted;
  }

  // For encrypted values, use the same AES decryption from the app
  // In dev this usually isn't needed — if you hit this, check MASTER_ENCRYPTION_KEY
  const key = process.env.MASTER_ENCRYPTION_KEY;
  if (!key) throw new Error('MASTER_ENCRYPTION_KEY not set in .env');

  const crypto = require('crypto');
  const [ivHex, encHex] = encrypted.split(':');
  if (!ivHex || !encHex) return encrypted; // Not encrypted
  const iv = Buffer.from(ivHex, 'hex');
  const encKey = crypto.scryptSync(key, 'salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', encKey, iv);
  let dec = decipher.update(encHex, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

// ── Main fix logic for a single tenant DB ────────────────────────

async function fixTenantReturns(
  tenantPrisma: PrismaClient,
  companyId: string,
  companyName: string,
): Promise<void> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(` Company: ${companyName} (${companyId})`);
  console.log(`${'═'.repeat(60)}`);

  // Find all cross-location PosReturn records
  const allPosReturns = await tenantPrisma.posReturn.findMany({
    where: { originalLocationId: { not: null } },
    include: { items: true },
  });

  const trulyCrossLocation = allPosReturns.filter(
    (r) => r.originalLocationId && r.locationId && r.originalLocationId !== r.locationId,
  );

  console.log(`Found ${trulyCrossLocation.length} cross-location returns out of ${allPosReturns.length} total.`);

  if (trulyCrossLocation.length === 0) {
    console.log('  ✅ Nothing to fix.');
    return;
  }

  let fixed = 0;
  let skipped = 0;
  let stnsCreated = 0;

  for (const posReturn of trulyCrossLocation) {
    console.log(`\n  ▸ ${posReturn.returnNumber} (Order: ${posReturn.orderNumber})`);
    console.log(`    Original loc: ${posReturn.originalLocationId}`);
    console.log(`    Return  loc:  ${posReturn.locationId}`);

    // Check StockLedger — where did inbound stock go?
    const ledgerEntries = await tenantPrisma.stockLedger.findMany({
      where: {
        referenceType: 'POS_RETURN',
        referenceId: posReturn.orderId,
        movementType: 'INBOUND',
      },
      select: { itemId: true, qty: true, locationId: true },
    });

    if (ledgerEntries.length === 0) {
      console.log(`    ⚠️  SKIP — no INBOUND ledger entries found`);
      skipped++;
      continue;
    }

    const misrouted: { itemId: string; qty: number }[] = [];
    for (const e of ledgerEntries) {
      const qty = Math.abs(Number(e.qty));
      if (e.locationId === posReturn.originalLocationId) {
        misrouted.push({ itemId: e.itemId, qty });
        console.log(`    🔴 Misrouted — item ${e.itemId} qty=${qty} at ORIGINAL loc`);
      } else if (e.locationId === posReturn.locationId) {
        console.log(`    ✅ Correct  — item ${e.itemId} qty=${qty} already at RETURN loc`);
      } else {
        console.log(`    ⚠️  Unknown  — item ${e.itemId} qty=${qty} at ${e.locationId}`);
      }
    }

    if (misrouted.length === 0) {
      console.log(`    ✅ SKIP — stock already at correct location`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`    🔵 DRY RUN — would move ${misrouted.length} item(s) to return branch`);
      fixed++;
      stnsCreated++;
      continue;
    }

    // LIVE: apply fixes in a transaction
    try {
      await tenantPrisma.$transaction(async (tx) => {
        const warehouse = await tx.warehouse.findFirst({
          where: { isActive: true, isDeleted: false },
        });
        if (!warehouse) throw new Error('No active warehouse found');

        for (const { itemId, qty } of misrouted) {
          // Deduct from original (wrong) location
          const origInv = await tx.inventoryItem.findFirst({
            where: { itemId, locationId: posReturn.originalLocationId!, status: 'AVAILABLE' },
          });
          if (origInv) {
            await tx.inventoryItem.update({
              where: { id: origInv.id },
              data: { quantity: { decrement: qty } },
            });
          } else {
            // Create negative record to reflect the correction
            await tx.inventoryItem.create({
              data: {
                itemId,
                locationId: posReturn.originalLocationId!,
                warehouseId: warehouse.id,
                quantity: -qty,
                status: 'AVAILABLE',
              },
            });
          }

          // Add to return (correct) location
          const retInv = await tx.inventoryItem.findFirst({
            where: { itemId, locationId: posReturn.locationId, status: 'AVAILABLE' },
          });
          if (retInv) {
            await tx.inventoryItem.update({
              where: { id: retInv.id },
              data: { quantity: { increment: qty } },
            });
          } else {
            await tx.inventoryItem.create({
              data: {
                itemId,
                locationId: posReturn.locationId,
                warehouseId: warehouse.id,
                quantity: qty,
                status: 'AVAILABLE',
              },
            });
          }

          // Corrective StockLedger audit entries
          await (tx as any).stockLedger.createMany({
            data: [
              {
                itemId,
                warehouseId: warehouse.id,
                locationId: posReturn.originalLocationId!,
                qty: -qty,
                movementType: 'OUTBOUND',
                referenceType: 'CROSS_LOCATION_CORRECTION',
                referenceId: posReturn.orderId,
              },
              {
                itemId,
                warehouseId: warehouse.id,
                locationId: posReturn.locationId,
                qty: qty,
                movementType: 'INBOUND',
                referenceType: 'CROSS_LOCATION_CORRECTION',
                referenceId: posReturn.orderId,
              },
            ],
          });
        }

        // Create missing STN if not already present
        const existingSTN = await tx.transferRequest.findFirst({
          where: {
            fromLocationId: posReturn.originalLocationId!,
            toLocationId: posReturn.locationId,
            notes: { contains: posReturn.returnNumber },
          },
        });

        if (!existingSTN) {
          const currentYear = new Date().getFullYear();
          const lastReq = await tx.transferRequest.findFirst({
            where: { requestNo: { startsWith: `STN-${currentYear}` } },
            orderBy: { createdAt: 'desc' },
          });
          let nextNum = 1;
          if (lastReq) {
            const n = parseInt(lastReq.requestNo.split('-').pop() || '0', 10);
            if (!isNaN(n)) nextNum = n + 1;
          }
          const requestNo = `STN-${currentYear}-${nextNum.toString().padStart(4, '0')}`;

          const origLoc = await tx.location.findUnique({
            where: { id: posReturn.originalLocationId! },
            select: { warehouseId: true, name: true },
          });
          const retLoc = await tx.location.findUnique({
            where: { id: posReturn.locationId },
            select: { warehouseId: true, name: true },
          });

          await (tx as any).transferRequest.create({
            data: {
              requestNo,
              fromLocationId: posReturn.originalLocationId!,
              toLocationId: posReturn.locationId,
              fromWarehouseId: origLoc?.warehouseId || warehouse.id,
              toWarehouseId: retLoc?.warehouseId || warehouse.id,
              transferType: 'OUTLET_TO_OUTLET',
              status: 'COMPLETED',
              requiresSourceApproval: false,
              sourceApprovedAt: posReturn.createdAt,
              checkedAt: posReturn.createdAt,
              authorizedAt: posReturn.createdAt,
              approvedAt: posReturn.createdAt,
              notes: `[RETROACTIVE] Corrective STN for SR#${posReturn.returnNumber} (Order#${posReturn.orderNumber}). Stock at ${retLoc?.name || posReturn.locationId}. Script-generated.`,
              items: {
                create: misrouted.map(({ itemId, qty }) => ({
                  itemId,
                  quantity: qty,
                  fulfilledQty: qty,
                })),
              },
            },
          });
          stnsCreated++;
          console.log(`    📋 STN created: ${requestNo}`);
        }
      });

      console.log(`    ✅ FIXED — ${misrouted.length} item(s) moved to correct location`);
      fixed++;
    } catch (err: any) {
      console.error(`    ❌ ERROR: ${err.message}`);
    }
  }

  console.log(`\n  Summary for ${companyName}:`);
  console.log(`    Total cross-location:  ${trulyCrossLocation.length}`);
  console.log(`    ${DRY_RUN ? 'Would fix' : 'Fixed'}:               ${fixed}`);
  console.log(`    Skipped:               ${skipped}`);
  console.log(`    STNs ${DRY_RUN ? 'to create' : 'created'}:        ${stnsCreated}`);
}

// ── Entry Point ──────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(60));
  console.log(' Cross-Location Return Inventory Re-Sync');
  console.log(` Mode: ${DRY_RUN ? '🟡 DRY RUN (no DB changes)' : '🔴 LIVE MODE'}`);
  if (TARGET_COMPANY) console.log(` Target Company: ${TARGET_COMPANY}`);
  console.log('═'.repeat(60));

  const mgmtUrl = process.env.DATABASE_URL_MANAGEMENT || process.env.DATABASE_URL;
  if (!mgmtUrl) throw new Error('DATABASE_URL_MANAGEMENT not set in .env');

  // Use raw pg Pool to query management DB (PrismaClient is generated for tenant schema)
  const mgmtPool = new Pool({ connectionString: mgmtUrl, max: 3 });

  let companies: { id: string; name: string; dbUrl: string }[] = [];
  try {
    const query = TARGET_COMPANY
      ? `SELECT id, name, "dbUrl", "dbHost", "dbPort", "dbUser", "dbPassword", "dbName"
         FROM "Company" WHERE status = 'active' AND id = $1`
      : `SELECT id, name, "dbUrl", "dbHost", "dbPort", "dbUser", "dbPassword", "dbName"
         FROM "Company" WHERE status = 'active'`;

    const result = await mgmtPool.query(query, TARGET_COMPANY ? [TARGET_COMPANY] : []);

    companies = result.rows
      .map((r: any) => {
        // In dev: reuse the superuser from DATABASE_URL but switch the dbName
        // This avoids needing to decrypt per-tenant user passwords
        const baseUrl = new URL(mgmtUrl.replace(/\?.*$/, ''));
        const tenantDbUrl = `${baseUrl.protocol}//${baseUrl.username}:${baseUrl.password}@${baseUrl.hostname}:${baseUrl.port}/${r.dbName}`;
        return { id: r.id, name: r.name, dbUrl: tenantDbUrl };
      })
      .filter((c: any) => c.dbUrl && c.dbUrl.includes('/'));
  } catch (err: any) {
    console.error('Failed to fetch companies from management DB:', err.message);
    await mgmtPool.end();
    process.exit(1);
  }

  await mgmtPool.end();

  console.log(`\nFound ${companies.length} tenant(s) to process.\n`);

  for (const company of companies) {
    const tenantPrisma = makePrismaClient(company.dbUrl);
    try {
      await fixTenantReturns(tenantPrisma, company.id, company.name);
    } catch (err: any) {
      console.error(`\n❌ Failed for company ${company.name}: ${err.message}`);
    } finally {
      await closePrismaClient(tenantPrisma);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(DRY_RUN ? '⚠️  DRY RUN complete. Run with DRY_RUN=false to commit.' : '✅ All done.');
  console.log('═'.repeat(60));
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
