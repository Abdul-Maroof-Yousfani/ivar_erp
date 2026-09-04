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

async function fixOutletInventory() {
  const prisma = await getPrismaClient();
  try {
    const backupInbounds = await prisma.$queryRaw<Array<{
      item_id: string;
      location_id: string;
      total_qty: string;
    }>>`
      SELECT item_id, location_id, SUM(qty) as total_qty
      FROM stock_ledgers_backup_tr_duplicates
      WHERE movement_type = 'INBOUND' AND location_id IS NOT NULL
      GROUP BY item_id, location_id;
    `;

    console.log(`Found ${backupInbounds.length} outlet inventory items to adjust from backup table`);

    let totalDecremented = 0;
    await prisma.$transaction(async (tx) => {
      for (const row of backupInbounds) {
        const qty = Number(row.total_qty);
        totalDecremented += qty;
        await tx.inventoryItem.updateMany({
          where: { itemId: row.item_id, locationId: row.location_id },
          data: { quantity: { decrement: qty } }
        });
      }
    }, { timeout: 60000 });

    console.log(`✅ Successfully adjusted ${backupInbounds.length} outlet inventory items (total decremented: ${totalDecremented} units).`);
  } finally {
    await prisma.$disconnect();
  }
}

fixOutletInventory();
