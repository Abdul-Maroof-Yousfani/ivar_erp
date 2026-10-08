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

async function checkTRStatuses() {
  const prisma = await getPrismaClient();
  try {
    const statusCounts = await prisma.transferRequest.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    console.log('Transfer Request Status counts in DB:', statusCounts);

    const typeCounts = await prisma.transferRequest.groupBy({
      by: ['transferType'],
      _count: { id: true },
    });
    console.log('Transfer Request Types in DB:', typeCounts);

    // Look at some non-completed requests
    const openTRs = await prisma.transferRequest.findMany({
      where: {
        status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] }
      },
      take: 10,
      select: {
        id: true,
        requestNo: true,
        status: true,
        transferType: true,
        fromWarehouseId: true,
        toWarehouseId: true,
        fromLocationId: true,
        toLocationId: true,
        items: {
          select: { itemId: true, quantity: true, fulfilledQty: true }
        }
      }
    });

    console.log(`Found ${openTRs.length} sample open TRs:`);
    for (const tr of openTRs) {
      console.log(`TR: ${tr.requestNo} | Status: ${tr.status} | Type: ${tr.transferType} | toLocation: ${tr.toLocationId} | toWH: ${tr.toWarehouseId} | Items: ${tr.items.length}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkTRStatuses();
