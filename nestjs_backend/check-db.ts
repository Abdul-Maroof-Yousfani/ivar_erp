import { Client } from 'pg';
import 'dotenv/config';
import { PrismaClient as ManagementClient } from '@prisma/management-client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function run() {
    const managementUrl = process.env.DATABASE_URL_MANAGEMENT;
    const pool = new Pool({ connectionString: managementUrl });
    const adapter = new PrismaPg(pool);
    const management = new ManagementClient({ adapter } as any);
    const companies = await management.company.findMany({
        where: { status: 'active' }
    });
    for (const c of companies) {
        console.log("Company:", c.name, "User:", c.dbUser);
    }
    await management.$disconnect();
    await pool.end();
}
run();
