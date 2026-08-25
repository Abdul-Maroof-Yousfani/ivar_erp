import 'dotenv/config';
import { PrismaClient as ManagementClient } from '@prisma/management-client';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as crypto from 'crypto';

function decrypt(encryptedText: string, masterKeyString: string): string {
  if (!masterKeyString || masterKeyString.length < 32) {
    throw new Error('MASTER_ENCRYPTION_KEY must be at least 32 characters');
  }
  const masterKey = Buffer.from(masterKeyString.slice(0, 32), 'utf-8');
  const algorithm = 'aes-256-gcm';

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(algorithm, masterKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

async function getPrismaClient(): Promise<PrismaClient> {
  const explicitTenantUrl = process.env.DATABASE_URL_TENANT;
  if (explicitTenantUrl && !explicitTenantUrl.includes('ivar_managements')) {
    console.log('🔗 Connecting using explicit DATABASE_URL_TENANT...');
    const pool = new Pool({ connectionString: explicitTenantUrl });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter } as any);
  }

  const managementUrl = process.env.DATABASE_URL_MANAGEMENT || process.env.DATABASE_URL;
  const masterKey = process.env.MASTER_ENCRYPTION_KEY;

  if (managementUrl && masterKey) {
    console.log('🔍 Locating active tenant database from Management DB...');
    const mPool = new Pool({ connectionString: managementUrl });
    const mAdapter = new PrismaPg(mPool);
    const mClient = new ManagementClient({ adapter: mAdapter } as any);

    try {
      await mClient.$connect();
      const company = await mClient.company.findFirst({
        where: { status: 'active' },
      });

      if (company) {
        let connectionString = company.dbUrl;
        if (company.dbPassword) {
          try {
            const decPassword = decrypt(company.dbPassword, masterKey);
            const encUser = encodeURIComponent(company.dbUser || '');
            const encPassword = encodeURIComponent(decPassword);
            connectionString = `postgresql://${encUser}:${encPassword}@${company.dbHost || 'localhost'}:${company.dbPort || 5432}/${company.dbName}?schema=public`;
          } catch (e) {
            console.warn('⚠️ Password decryption failed, using company.dbUrl fallback');
          }
        }

        if (connectionString) {
          console.log(`✅ Connected to active tenant: ${company.name} (${company.dbName})`);
          await mClient.$disconnect();
          await mPool.end();

          const tPool = new Pool({ connectionString });
          const tAdapter = new PrismaPg(tPool);
          return new PrismaClient({ adapter: tAdapter } as any);
        }
      }
    } catch (err: any) {
      console.warn(`⚠️ Management DB lookup error: ${err.message}`);
    } finally {
      await mClient.$disconnect().catch(() => {});
      await mPool.end().catch(() => {});
    }
  }

  const defaultUrl = process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/ivar_erp?schema=public';
  console.log(`ℹ️ Falling back to default database URL...`);
  const fallbackPool = new Pool({ connectionString: defaultUrl });
  const fallbackAdapter = new PrismaPg(fallbackPool);
  return new PrismaClient({ adapter: fallbackAdapter } as any);
}

async function run() {
  const referenceId = process.argv[2] || '16b89aee-c715-4f58-b97f-b827ca79d1e0';
  const executeDelete = process.argv.includes('--delete');

  console.log(`\n======================================================`);
  console.log(`📦 Stock Ledger Duplicate Cleanup Script`);
  console.log(`Target Reference ID: ${referenceId}`);
  console.log(`Mode: ${executeDelete ? '❌ EXECUTE DELETE' : '🔍 DRY RUN (Inspect Only)'}`);
  console.log(`======================================================\n`);

  const prisma = await getPrismaClient();

  try {
    const ledgers = await prisma.stockLedger.findMany({
      where: { referenceId },
      orderBy: { createdAt: 'asc' },
      include: {
        item: { select: { sku: true, description: true } },
        warehouse: { select: { name: true, code: true } },
      },
    });

    console.log(`📊 Found ${ledgers.length} total Stock Ledger entries for Reference ID: ${referenceId}\n`);

    if (ledgers.length === 0) {
      console.log('✨ No records found matching referenceId.');
      return;
    }

    // Group ledgers by key: itemId + warehouseId + movementType + qty
    const grouped = new Map<string, typeof ledgers>();
    for (const entry of ledgers) {
      const key = `${entry.itemId}_${entry.warehouseId}_${entry.movementType}_${entry.qty}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(entry);
    }

    const idsToDelete: string[] = [];
    const idsToKeep: string[] = [];

    for (const [key, group] of grouped.entries()) {
      const original = group[0];
      idsToKeep.push(original.id);

      console.log(`🔹 Item/Warehouse Group (${group[0].item?.sku || group[0].itemId} @ ${group[0].warehouse?.name || group[0].warehouseId}):`);
      console.log(`   Original (KEEPING): ID=${original.id} | Qty=${original.qty} | Created=${original.createdAt.toISOString()}`);

      const duplicates = group.slice(1);
      if (duplicates.length > 0) {
        console.log(`   Duplicates (TO DELETE: ${duplicates.length} entries):`);
        for (const dup of duplicates) {
          idsToDelete.push(dup.id);
          console.log(`     - ID=${dup.id} | Qty=${dup.qty} | Created=${dup.createdAt.toISOString()}`);
        }
      }
      console.log('');
    }

    console.log(`Summary:`);
    console.log(`- Total Records: ${ledgers.length}`);
    console.log(`- Records to KEEP: ${idsToKeep.length}`);
    console.log(`- Records to DELETE: ${idsToDelete.length}`);

    if (executeDelete && idsToDelete.length > 0) {
      console.log(`\n🗑️ Deleting ${idsToDelete.length} duplicate Stock Ledger entries...`);
      const deleteResult = await prisma.stockLedger.deleteMany({
        where: {
          id: { in: idsToDelete },
        },
      });
      console.log(`✅ Cleaned up successfully! Deleted ${deleteResult.count} duplicate records.`);
    } else if (idsToDelete.length > 0) {
      console.log(`\n⚠️ Dry run finished. Run with '--delete' flag to perform actual deletion.`);
    } else {
      console.log(`\n✨ No duplicates detected.`);
    }
  } catch (err: any) {
    console.error('❌ Error executing cleanup:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
