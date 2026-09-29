import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const mgmtUrl = process.env.DATABASE_URL_MANAGEMENT || process.env.DATABASE_URL;
  if (!mgmtUrl) throw new Error('DATABASE_URL not set');

  const mgmtPool = new Pool({ connectionString: mgmtUrl, max: 2 });
  const compRes = await mgmtPool.query(`SELECT id, name, "dbName" FROM "Company" WHERE status = 'active'`);

  for (const comp of compRes.rows) {
    console.log(`Checking company: ${comp.name} (${comp.dbName})`);
    const baseUrl = new URL(mgmtUrl.replace(/\?.*$/, ''));
    const tenantDbUrl = `${baseUrl.protocol}//${baseUrl.username}:${baseUrl.password}@${baseUrl.hostname}:${baseUrl.port}/${comp.dbName}`;

    const pool = new Pool({ connectionString: tenantDbUrl, max: 2 });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter } as any);

    try {
      const locations = await prisma.location.findMany({
        where: {
          OR: [
            { name: { contains: 'Islamabad', mode: 'insensitive' } },
            { name: { contains: 'Mozaic', mode: 'insensitive' } },
            { code: { contains: 'I8', mode: 'insensitive' } },
          ],
        },
      });

      console.log('Found locations:', locations.map(l => ({ id: l.id, name: l.name, code: l.code })));

      const startOfDay = new Date('2026-09-28T00:00:00.000Z');
      const endOfDay = new Date('2026-09-29T23:59:59.999Z');

      const locIds = locations.map(l => l.id);

      // Find all orders on 28/09/2026 for these locations (or all locations if not sure)
      const orders = await prisma.salesOrder.findMany({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          ...(locIds.length > 0 ? { locationId: { in: locIds } } : {}),
        },
        include: {
          customer: true,
          voucherRedemptions: true,
        },
      });

      console.log(`Total orders found on 2026-09-28: ${orders.length}`);

      for (const o of orders) {
        const grandTotal = Number(o.grandTotal ?? 0);
        const cash = Number(o.cashAmount ?? 0);
        const card = Number(o.cardAmount ?? 0);
        const change = Number(o.changeAmount ?? 0);
        const voucher = o.voucherRedemptions?.reduce((sum, r) => sum + Number(r.amountUsed), 0) ?? 0;

        const netCash = Math.max(0, cash - change);
        const diff = Number((grandTotal - netCash - card - voucher).toFixed(2));

        const isCreditCandidate =
          o.paymentMethod === 'credit_account' ||
          o.tenderType === 'credit_account' ||
          o.paymentMethod === 'reward_voucher' ||
          o.tenderType === 'reward_voucher' ||
          o.paymentMethod === 'split' ||
          o.tenderType === 'split' ||
          diff > 0;

        if (isCreditCandidate || Math.abs(diff - 5650) < 1 || Math.abs(grandTotal - 5650) < 1) {
          console.log('\n--- MATCHING / POTENTIAL ORDER ---');
          console.log('Order Number:', o.orderNumber);
          console.log('Order ID:', o.id);
          console.log('Grand Total:', grandTotal);
          console.log('Cash Amount:', cash);
          console.log('Card Amount:', card);
          console.log('Change Amount:', change);
          console.log('Voucher Amount:', voucher);
          console.log('Calculated Unpaid Diff:', diff);
          console.log('Payment Method:', o.paymentMethod);
          console.log('Tender Type:', o.tenderType);
          console.log('Payment Status:', o.paymentStatus);
          console.log('Customer:', o.customer?.name, o.customer?.contactNo);
          console.log('Notes:', o.notes);
          console.log('Created At:', o.createdAt);
        }
      }
    } catch (e: any) {
      console.error('Error querying company:', e.message);
    } finally {
      await pool.end();
    }
  }

  await mgmtPool.end();
}

main().catch(console.error);
