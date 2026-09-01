import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query('SELECT count(*), max(code) FROM "Supplier"');
  console.log('Supplier Stats:', res.rows);
  const sample = await pool.query('SELECT code, name, nature, type, city, "contactNo" FROM "Supplier" ORDER BY code ASC LIMIT 10');
  console.log('Sample rows:', sample.rows);
  await pool.end();
}

main().catch(console.error);
