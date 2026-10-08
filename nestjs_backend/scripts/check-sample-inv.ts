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

async function checkSample() {
  const prisma = await getPrismaClient();
  try {
    const tr = await prisma.transferRequest.findFirst({
      where: { requestNo: 'TR-000116' },
      include: { items: { take: 1 } }
    });
    const item = tr!.items[0];
    const itemId = item.itemId;

    // Check inventoryItems
    const invItems = await prisma.inventoryItem.findMany({
      where: { itemId }
    });

    console.log(`Inventory Items for item ${itemId}:`);
    for (const inv of invItems) {
      console.log(`ID: ${inv.id} | WH: ${inv.warehouseId} | Loc: ${inv.locationId} | Qty: ${inv.quantity}`);
    }

    // Check sum of StockLedgers
    const ledgerSumWh = await prisma.stockLedger.aggregate({
      where: { itemId, locationId: null },
      _sum: { qty: true }
    });
    const ledgerSumLoc = await prisma.stockLedger.aggregate({
      where: { itemId, locationId: tr!.toLocationId },
      _sum: { qty: true }
    });

    console.log(`StockLedger sum WH: ${ledgerSumWh._sum.qty}`);
    console.log(`StockLedger sum Location: ${ledgerSumLoc._sum.qty}`);
  } finally {
    await prisma.$disconnect();
  }
}

checkSample();
