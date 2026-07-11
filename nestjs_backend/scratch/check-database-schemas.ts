import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const managementClient = new Client({ connectionString: process.env.DATABASE_URL_MANAGEMENT || process.env.DATABASE_URL });
  await managementClient.connect();
  let databases: string[] = [];
  try {
    const res = await managementClient.query(`
      SELECT datname 
      FROM pg_database 
      WHERE datistemplate = false AND datname LIKE 'tenant_%'
      ORDER BY datname;
    `);
    databases = res.rows.map(r => r.datname);
  } finally {
    await managementClient.end();
  }

  console.log(`Found ${databases.length} tenant databases. Checking for pos_vouchers table...`);

  for (const dbName of databases) {
    const dbUrl = `postgresql://speedlimit:speedlimit123@localhost:5433/${dbName}?schema=public`;
    const client = new Client({ connectionString: dbUrl });
    try {
      await client.connect();
      const tableRes = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'pos_vouchers';
      `);
      if (tableRes.rowCount > 0) {
        console.log(`✅ Database ${dbName} HAS 'pos_vouchers' table.`);
        // Let's print all tables with voucher or claim in the name
        const allVoucherRes = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' AND (table_name LIKE '%voucher%' OR table_name LIKE '%claim%')
          ORDER BY table_name;
        `);
        console.log(`  Matching tables: ${allVoucherRes.rows.map(r => r.table_name).join(', ')}`);
      } else {
        console.log(`❌ Database ${dbName} does NOT have 'pos_vouchers' table.`);
      }
    } catch (err: any) {
      console.error(`Error connecting to ${dbName}: ${err.message}`);
    } finally {
      await client.end();
    }
  }
}

main();
