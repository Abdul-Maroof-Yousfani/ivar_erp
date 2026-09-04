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

async function scanAllTRDuplicates() {
  const prisma = await getPrismaClient();
  try {
    // Find all transfer request ledgers grouped by referenceId, itemId, movementType
    const duplicates = await prisma.$queryRaw<Array<{
      reference_id: string;
      item_id: string;
      movement_type: string;
      cnt: bigint;
    }>>`
      SELECT reference_id, item_id, movement_type, COUNT(*) as cnt
      FROM stock_ledgers
      WHERE reference_type = 'TRANSFER_REQUEST'
      GROUP BY reference_id, item_id, movement_type
      HAVING COUNT(*) > 1
    `;

    console.log(`Found ${duplicates.length} item duplicate groups in stock_ledgers`);

    const refIds = [...new Set(duplicates.map(d => d.reference_id))];
    console.log(`Total Transfer Requests affected: ${refIds.length}`);

    const trs = await prisma.transferRequest.findMany({
      where: { id: { in: refIds } },
      select: { id: true, requestNo: true }
    });
    const trMap = new Map(trs.map(t => [t.id, t.requestNo]));

    const affectedTRs = refIds.map(id => trMap.get(id) || id);
    console.log('Affected Transfer Requests:', affectedTRs);
  } finally {
    await prisma.$disconnect();
  }
}

scanAllTRDuplicates();
