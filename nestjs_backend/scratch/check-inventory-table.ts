import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Tables in public schema:');
    console.log(res.rows.map(r => r.table_name).join('\n'));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
