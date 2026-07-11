import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const dbUrl = 'postgresql://speedlimit:speedlimit123@localhost:5433/tenant_june_6_mqawmlin?schema=public';
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Item' AND table_schema = 'public'
      ORDER BY column_name;
    `);
    console.log('Columns in "Item" table:');
    console.log(res.rows.map(r => `${r.column_name} (${r.data_type})`).join('\n'));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
