import 'dotenv/config';
import { Client } from 'pg';

const TARGET_LOCATION_ID = '229c1ecd-11f0-43dd-94f6-17c165a3003d';

async function main() {
  const dbUrl = 'postgresql://speedlimit:speedlimit123@localhost:5433/tenant_june_6_mqawmlin?schema=public';
  const db = new Client({ connectionString: dbUrl });
  await db.connect();

  console.log(`Cleaning up all imported records for Location: ${TARGET_LOCATION_ID}...`);

  try {
    await db.query('BEGIN');

    // Delete Inventory Items for this location
    const invDel = await db.query(`
      DELETE FROM "InventoryItem" WHERE "locationId" = $1;
    `, [TARGET_LOCATION_ID]);
    console.log(`🗑️ Deleted ${invDel.rowCount} inventory items.`);

    // Delete Stock Ledgers for this location
    const slDel = await db.query(`
      DELETE FROM stock_ledgers WHERE location_id = $1;
    `, [TARGET_LOCATION_ID]);
    console.log(`🗑️ Deleted ${slDel.rowCount} stock ledger entries.`);

    // Delete Sales Order Items
    const soiDel = await db.query(`
      DELETE FROM sales_order_items 
      WHERE sales_order_id IN (
        SELECT id FROM sales_orders WHERE location_id = $1
      );
    `, [TARGET_LOCATION_ID]);
    console.log(`🗑️ Deleted ${soiDel.rowCount} sales order items.`);

    // Delete Sales Orders
    const soDel = await db.query(`
      DELETE FROM sales_orders WHERE location_id = $1;
    `, [TARGET_LOCATION_ID]);
    console.log(`🗑️ Deleted ${soDel.rowCount} sales orders.`);

    await db.query('COMMIT');
    console.log('✅ Cleanup completed successfully!');
  } catch (err: any) {
    await db.query('ROLLBACK');
    console.error(`❌ Cleanup failed: ${err.message}`);
  } finally {
    await db.end();
  }
}

main().catch(console.error);
