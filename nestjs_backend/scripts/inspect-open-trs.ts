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

async function inspectOpenTRs() {
  const prisma = await getPrismaClient();
  try {
    const trs = await prisma.transferRequest.findMany({
      where: { requestNo: { in: ['TR-000279', 'TR-000295', 'TR-000298', 'TR-000296'] } },
      include: {
        fromWarehouse: { select: { id: true, name: true } },
        toWarehouse: { select: { id: true, name: true } },
        fromLocation: { select: { id: true, name: true } },
        toLocation: { select: { id: true, name: true } }
      }
    });

    for (const tr of trs) {
      console.log(`\nTR: ${tr.requestNo} [${tr.status}] (${tr.transferType})`);
      console.log(`  fromWarehouse: ${tr.fromWarehouse?.name} (${tr.fromWarehouseId})`);
      console.log(`  toWarehouse:   ${tr.toWarehouse?.name} (${tr.toWarehouseId})`);
      console.log(`  fromLocation:  ${tr.fromLocation?.name} (${tr.fromLocationId})`);
      console.log(`  toLocation:    ${tr.toLocation?.name} (${tr.toLocationId})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

inspectOpenTRs();
