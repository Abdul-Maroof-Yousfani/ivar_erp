import { Client } from 'pg';
import 'dotenv/config';

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:admin@localhost:5432/tenant_ivar' });
  await client.connect();

  const pb = await client.query('SELECT * FROM production_batches;');
  console.log('Production Batches:', pb.rows);

  const ft = await client.query('SELECT * FROM fabric_vendor_trackers;');
  console.log('Fabric Trackers:', ft.rows);

  await client.end();
}

main().catch(console.error);
