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

async function testTransitQuery() {
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
      'PARTIAL_RECEIVED'
    ];

    const openTRs = await prisma.transferRequest.findMany({
      where: {
        status: { in: unacceptedStatuses }
      },
      include: {
        items: true,
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } },
        fromLocation: { select: { name: true } },
        toLocation: { select: { name: true } }
      }
    });

    console.log(`\nFound ${openTRs.length} total unaccepted/in-transit Transfer Requests in DB:`);
    for (const tr of openTRs) {
      const totalQty = tr.items.reduce((s, i) => s + Number(i.quantity), 0);
      const fulfilled = tr.items.reduce((s, i) => s + Number(i.fulfilledQty || 0), 0);
      const remaining = totalQty - fulfilled;
      console.log(`- ${tr.requestNo} [${tr.status}] (${tr.transferType})`);
      console.log(`  From: ${tr.fromWarehouse?.name || tr.fromLocation?.name} -> To: ${tr.toLocation?.name || tr.toWarehouse?.name || tr.fromWarehouse?.name}`);
      console.log(`  Total Qty: ${totalQty}, Fulfilled: ${fulfilled}, Remaining In-Transit: ${remaining}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testTransitQuery();
