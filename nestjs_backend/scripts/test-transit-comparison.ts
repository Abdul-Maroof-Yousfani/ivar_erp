import 'dotenv/config';
import { PrismaClient as ManagementClient } from '@prisma/management-client';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as crypto from 'crypto';

function decrypt(encryptedText: string, masterKeyString: string): string {
  const masterKey = Buffer.from(masterKeyString.slice(0, 32), 'utf-8');
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}

async function getPrismaClient(): Promise<PrismaClient> {
  const managementUrl = process.env.DATABASE_URL_MANAGEMENT || process.env.DATABASE_URL;
  const masterKey = process.env.MASTER_ENCRYPTION_KEY;
  const mPool = new Pool({ connectionString: managementUrl });
  const mClient = new ManagementClient({ adapter: new PrismaPg(mPool) } as any);
  await mClient.$connect();
  const company = await mClient.company.findFirst({ where: { status: 'active' } });
  const decPassword = decrypt(company!.dbPassword!, masterKey!);
  const encUser = encodeURIComponent(company!.dbUser || '');
  const encPassword = encodeURIComponent(decPassword);
  const connectionString = `postgresql://${encUser}:${encPassword}@${company!.dbHost || 'localhost'}:${company!.dbPort || 5432}/${company!.dbName}?schema=public`;
  await mClient.$disconnect();
  await mPool.end();
  const tPool = new Pool({ connectionString });
  return new PrismaClient({ adapter: new PrismaPg(tPool) } as any);
}

async function testAvailableStockReport() {
  const prisma = await getPrismaClient();
  try {
    const unacceptedStatuses = [
      'PENDING',
      'PENDING_CHECKER',
      'PENDING_AUTHORIZER',
      'PENDING_APPROVER',
      'APPROVED',
      'SOURCE_APPROVED',
      'IN_TRANSIT',
      'PARTIAL_RECEIVED',
    ];

    // Check items in TR-000295 and TR-000298 (transferred to DHA Z Block Lahore)
    const dhaId = '229c1ecd-11f0-43dd-94f6-17c165a3003d';
    const whId = '067452c4-00b5-4e2e-b5e5-b6d4fcf1f910';

    const oldQuery = await prisma.transferRequestItem.findMany({
      where: {
        transferRequest: {
          toLocationId: dhaId,
          status: { in: ['PENDING', 'SOURCE_APPROVED'] },
        }
      }
    });

    const newQuery = await prisma.transferRequestItem.findMany({
      where: {
        transferRequest: {
          toLocationId: dhaId,
          status: { in: unacceptedStatuses },
        }
      }
    });

    const oldQty = oldQuery.reduce((s, i) => s + Number(i.quantity), 0);
    const newQty = newQuery.reduce((s, i) => s + Math.max(0, Number(i.quantity) - Number(i.fulfilledQty || 0)), 0);

    console.log(`For DHA Z Block Lahore:`);
    console.log(`- Old transit query (only PENDING, SOURCE_APPROVED): ${oldQuery.length} rows, Qty: ${oldQty}`);
    console.log(`- New transit query (all unaccepted statuses):        ${newQuery.length} rows, Qty: ${newQty}`);

    // Check for Warehouse perspective
    const whTransitQuery = await prisma.transferRequestItem.findMany({
      where: {
        transferRequest: {
          status: { in: unacceptedStatuses },
          OR: [
            { fromWarehouseId: whId, toLocationId: { not: null } },
            { toWarehouseId: whId },
            { transferType: 'OUTLET_TO_WAREHOUSE', fromWarehouseId: whId }
          ]
        }
      }
    });
    const whQty = whTransitQuery.reduce((s, i) => s + Math.max(0, Number(i.quantity) - Number(i.fulfilledQty || 0)), 0);
    console.log(`\nFor WAREHOUSE-IV:`);
    console.log(`- Unaccepted transferred stock involving WAREHOUSE-IV: ${whTransitQuery.length} rows, Qty: ${whQty}`);
  } finally {
    await prisma.$disconnect();
  }
}

testAvailableStockReport();
