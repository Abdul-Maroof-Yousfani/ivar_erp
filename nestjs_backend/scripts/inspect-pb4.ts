import { Client } from 'pg';
import 'dotenv/config';

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:admin@localhost:5432/tenant_ivar' });
  await client.connect();

  const pb = await client.query(`
    SELECT pb.id, pb.batch_number, pb.article_item_id, 
           w_a.name as a_wh_name, w_b.name as b_wh_name, w_f.name as f_wh_name,
           pb.qty_total_received, pb.qty_a_grade, pb.qty_b_grade, pb.qty_refreshed,
           pb.a_final_unit_cost, pb.b_total_value
    FROM production_batches pb
    LEFT JOIN "Warehouse" w_a ON pb.a_grade_warehouse_id = w_a.id
    LEFT JOIN "Warehouse" w_b ON pb.b_grade_warehouse_id = w_b.id
    LEFT JOIN "Warehouse" w_f ON pb.fabric_warehouse_id = w_f.id
    WHERE pb.batch_number = 'PB-2026-0004';
  `);
  console.log('PB-2026-0004:', JSON.stringify(pb.rows, null, 2));

  const items = await client.query(`
    SELECT pbi.id, pbi.batch_id, pbi.article_item_id, pbi.size_name,
           pbi.qty_total_received, pbi.qty_a_grade, pbi.qty_b_grade, pbi.qty_refreshed,
           pbi.a_final_unit_cost, pbi.b_unit_value
    FROM production_batch_items pbi
    WHERE pbi.batch_id = $1;
  `, [pb.rows[0]?.id]);
  console.log('Items for PB-2026-0004:', JSON.stringify(items.rows, null, 2));

  await client.end();
}

main().catch(console.error);
