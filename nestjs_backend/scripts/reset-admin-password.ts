// @ts-nocheck
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/management-client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

// Load .env from parent directory
config({ path: resolve(__dirname, '../.env') });

async function main() {
    const connectionString = process.env.DATABASE_URL_MANAGEMENT;
    
    if (!connectionString) {
        console.error('❌ DATABASE_URL_MANAGEMENT is not defined in .env file');
        process.exit(1);
    }
    
    console.log('🔗 Using connection string:', connectionString.replace(/:[^:@]+@/, ':****@'));
    
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    const newPassword = 'Access@123';

    console.log(`🔄 Resetting password for all users...`);

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const result = await prisma.user.updateMany({
            data: {
                password: hashedPassword,
                isFirstPassword: false,
                mustChangePassword: false,
            },
        });

        console.log(`✅ Password successfully updated for ${result.count} users`);
    } catch (error) {
        console.error('❌ Error resetting passwords:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();
