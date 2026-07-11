import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const dbUrl = 'postgresql://speedlimit:speedlimit123@localhost:5433/tenant_new_one_mpl20mbq?schema=public';
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'pos_claims' AND table_schema = 'public';
    `);
    console.log('Columns in pos_claims (tenant_new_one_mpl20mbq):');
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
