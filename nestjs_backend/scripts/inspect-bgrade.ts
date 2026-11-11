import { Client } from 'pg';
import 'dotenv/config';

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:admin@localhost:5432/tenant_ivar' });
  await client.connect();

  const pb = await client.query(`
    SELECT id, batch_number, article_item_id, a_grade_warehouse_id, b_grade_warehouse_id, qty_total_received, qty_a_grade, qty_b_grade, a_final_unit_cost, b_total_value
    FROM production_batches
    ORDER BY created_at DESC;
  `);
  console.log('Production Batches:', JSON.stringify(pb.rows, null, 2));

  const items = await client.query(`
    SELECT pbi.id, pbi.batch_id, pbi.article_item_id, i.sku, pbi.qty_total_received, pbi.qty_a_grade, pbi.qty_b_grade, pbi.a_final_unit_cost, pbi.b_unit_value
    FROM production_batch_items pbi
    LEFT JOIN items i ON pbi.article_item_id = i.id
    ORDER BY pbi.id;
  `);
  console.log('Production Batch Items:', JSON.stringify(items.rows, null, 2));

  const bgrade = await client.query(`
    SELECT b.id, b.batch_id, pb.batch_number, b.item_id, i.sku, b.warehouse_id, b.qty_initial, b.qty_current, b.unit_value, b.status
    FROM b_grade_inventory_items b
    LEFT JOIN production_batches pb ON b.batch_id = pb.id
    LEFT JOIN items i ON b.item_id = i.id
    ORDER BY b.id;
  `);
  console.log('B-Grade Inventory Items:', JSON.stringify(bgrade.rows, null, 2));

  await client.end();
}

main().catch(console.error);
