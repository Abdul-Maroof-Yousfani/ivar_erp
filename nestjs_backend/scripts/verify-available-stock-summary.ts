import 'dotenv/config';
import { PrismaClient as ManagementClient } from '@prisma/management-client';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as crypto from 'crypto';
import { AvailableStockSummaryExportService } from '../src/warehouse/stock-ledger/available-stock-summary-export.service';

function decrypt(encryptedText: string, masterKeyString: string): string {
  const masterKey = Buffer.from(masterKeyString.slice(0, 32), 'utf-8');
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}

async function getPrismaService(): Promise<any> {
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
  const prisma = new PrismaClient({ adapter: new PrismaPg(tPool) } as any);
  return prisma;
}

async function verify() {
  const prisma = await getPrismaService();
  const service = new AvailableStockSummaryExportService(null as any, prisma, null as any);

  try {
    console.log('\n--- 1. Testing with DHA Z Block Lahore ---');
    const dhaId = '229c1ecd-11f0-43dd-94f6-17c165a3003d';
    const dhaRes = await service.generateAvailableStockSummaryReportDataInternal(prisma, {
      locationId: dhaId,
      summaryOnly: true,
    });
    console.log('DHA Grand Totals:', dhaRes.grandTotals);

    console.log('\n--- 2. Testing with WAREHOUSE-IV ---');
    const whId = '067452c4-00b5-4e2e-b5e5-b6d4fcf1f910';
    const whRes = await service.generateAvailableStockSummaryReportDataInternal(prisma, {
      warehouseId: whId,
      summaryOnly: true,
    });
    console.log('Warehouse-IV Grand Totals:', whRes.grandTotals);

    console.log('\n--- 3. Testing with All Outlets & Warehouses ---');
    const allRes = await service.generateAvailableStockSummaryReportDataInternal(prisma, {
      summaryOnly: true,
    });
    console.log('All Locations Grand Totals:', allRes.grandTotals);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
