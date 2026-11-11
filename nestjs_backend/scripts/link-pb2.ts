import { Client } from 'pg';
import 'dotenv/config';

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:admin@localhost:5432/tenant_ivar' });
  await client.connect();

  const pbRes = await client.query(
    "UPDATE production_batches SET tracker_id = '1a142eab-d832-483d-a664-1fcec2d87854' WHERE batch_number = 'PB-2026-0002' RETURNING id;"
  );
  console.log('Updated PB-2026-0002 rows:', pbRes.rowCount);

  const ftRes = await client.query(
    "UPDATE fabric_vendor_trackers SET qty_used = 150, status = 'PARTIAL', consumption_date = '2026-11-10' WHERE id = '1a142eab-d832-483d-a664-1fcec2d87854' RETURNING id;"
  );
  console.log('Updated FT-2026-0004 rows:', ftRes.rowCount);

  await client.query(
    "INSERT INTO fabric_vendor_consumption_logs (id, tracker_id, qty_used, qty_returned, qty_shortage, consumption_date, notes, created_at) VALUES (gen_random_uuid(), '1a142eab-d832-483d-a664-1fcec2d87854', 150, 0, 0, '2026-11-10', 'Auto-logged from Production Batch #PB-2026-0002', NOW());"
  );
  console.log('Inserted consumption log successfully');

  await client.end();
}

main().catch(console.error);

