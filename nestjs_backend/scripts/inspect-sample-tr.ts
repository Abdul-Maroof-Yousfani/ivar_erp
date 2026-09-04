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

async function inspectTR() {
  const prisma = await getPrismaClient();
  try {
    const tr = await prisma.transferRequest.findFirst({
      where: { requestNo: 'TR-000116' },
      include: { items: { take: 2 } }
    });

    const sampleItemId = tr!.items[0].itemId;
    console.log(`Sample item in TR-000116: ${sampleItemId}, required qty: ${tr!.items[0].quantity}`);

    const ledgers = await prisma.stockLedger.findMany({
      where: { referenceId: tr!.id, itemId: sampleItemId },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`Found ${ledgers.length} ledgers for this sample item:`);
    for (const l of ledgers) {
      console.log(`ID: ${l.id} | Movement: ${l.movementType} | RefType: ${l.referenceType} | Qty: ${l.qty} | WH: ${l.warehouseId} | Loc: ${l.locationId} | Created: ${l.createdAt.toISOString()}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

inspectTR();
