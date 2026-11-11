import 'dotenv/config';
import { PrismaClient } from '@prisma/management-client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL_MANAGEMENT || process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function checkSeeded() {
  try {
    const adminUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'admin@ivar.com' },
          { email: 'admin@speedlimit.com' },
          { role: { name: { in: ['admin', 'super-admin', 'super_admin'] } } },
        ],
      },
      include: { role: true },
    });

    if (adminUser) {
      console.log(`✅ Seeded admin user found: ${adminUser.email}`);
      process.exit(0);
    } else {
      console.log('ℹ️ No seeded admin user found.');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ check-seed error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

checkSeeded();
