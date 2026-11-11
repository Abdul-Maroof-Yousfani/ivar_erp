import { Pool } from 'pg';
const pool = new Pool({ connectionString: 'postgresql://postgres:admin@localhost:5432/tenant_ivar?schema=public' });

async function run() {
  const res = await pool.query(`
    SELECT t.id, t.tracker_number, s.name as supplier_name, i.sku, i.description, 
           w.name as warehouse_name, t.qty_issued, t.qty_used, t.status
    FROM fabric_vendor_trackers t
    JOIN suppliers s ON t.supplier_id = s.id
    JOIN items i ON t.item_id = i.id
    JOIN warehouses w ON t.warehouse_id = w.id
    ORDER BY t.created_at DESC
  `);
  console.log('Total trackers in DB:', res.rows.length);
  res.rows.forEach(r => console.log(r));
  await pool.end();
}
run();

