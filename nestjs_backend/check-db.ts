import 'dotenv/config';
import { PrismaClient } from '@prisma/management-client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL_MANAGEMENT });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  try {
    const users = await prisma.user.findMany();
    console.log('--- Users ---');
    console.log(users.map(u => ({ id: u.id, email: u.email, roleId: u.roleId })));

    const tenants = await prisma.tenant.findMany();
    console.log('--- Tenants ---');
    console.log(tenants);

    const companies = await prisma.company.findMany();
    console.log('--- Companies ---');
    console.log(companies);
  } catch (error) {
    console.error('Error querying master DB:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
