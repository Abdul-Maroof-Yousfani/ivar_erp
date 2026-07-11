import 'dotenv/config';
import { Client } from 'pg';
import * as crypto from 'crypto';

const TARGET_LOCATION_ID = '229c1ecd-11f0-43dd-94f6-17c165a3003d';

function decrypt(encryptedText: string, masterKeyString: string): string {
  const masterKey = Buffer.from(masterKeyString.slice(0, 32), 'utf-8');
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted text format');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(parts[2], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function main() {
  console.log(`Starting cleanup of imported sales for Location ID: ${TARGET_LOCATION_ID}`);

  const managementConnectionString = process.env.DATABASE_URL_MANAGEMENT || process.env.DATABASE_URL;
  const masterKey = process.env.MASTER_ENCRYPTION_KEY;
  if (!managementConnectionString || !masterKey) {
    console.error('DATABASE_URL_MANAGEMENT and MASTER_ENCRYPTION_KEY required in .env');
    return;
  }

  const managementClient = new Client({ connectionString: managementConnectionString });
  await managementClient.connect();
  
  let companies: any[] = [];
  try {
    const res = await managementClient.query(`
      SELECT id, name, code, "dbName", "dbUrl", "dbHost", "dbPort", "dbUser", "dbPassword"
      FROM "Company"
      WHERE status = 'active';
    `);
    companies = res.rows;
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    await managementClient.end();
    return;
  } finally {
    await managementClient.end();
  }

  // Find correct tenant DB containing TARGET_LOCATION_ID
  let targetDbName: string | null = null;
  let targetConnectionString: string | null = null;

  for (const company of companies) {
    let connectionString = company.dbUrl;
    if (company.dbPassword) {
      try {
        const decPassword = encodeURIComponent(decrypt(company.dbPassword, masterKey));
        connectionString = `postgresql://${company.dbUser}:${decPassword}@${company.dbHost || 'localhost'}:${company.dbPort || 5432}/${company.dbName}?schema=public`;
      } catch {}
    }
    if (!connectionString) continue;

    const client = new Client({ connectionString });
    try {
      await client.connect();
      const locRes = await client.query(`SELECT id FROM "Location" WHERE id = $1;`, [TARGET_LOCATION_ID]);
      if (locRes.rowCount > 0) {
        targetDbName = company.dbName;
        targetConnectionString = connectionString;
        await client.end();
        break;
      }
      await client.end();
    } catch (e) {}
  }

  if (!targetConnectionString) {
    console.log(`⚠️ Location ${TARGET_LOCATION_ID} not found in any tenant database. Nothing to clean.`);
    return;
  }

  const db = new Client({ connectionString: targetConnectionString });
  await db.connect();
  console.log(`🎯 Connected to database: "${targetDbName}"`);

  try {
    await db.query('BEGIN');

    // 1. Delete Inventory Items for this location
    const invDel = await db.query(`
      DELETE FROM "InventoryItem" WHERE "locationId" = $1;
    `, [TARGET_LOCATION_ID]);
    console.log(`🗑️ Deleted ${invDel.rowCount} inventory items.`);

    // 2. Delete Stock Ledgers for this location
    const slDel = await db.query(`
      DELETE FROM stock_ledgers WHERE location_id = $1;
    `, [TARGET_LOCATION_ID]);
    console.log(`🗑️ Deleted ${slDel.rowCount} stock ledger entries.`);

    // 3. Delete Sales Order Items
    const soiDel = await db.query(`
      DELETE FROM sales_order_items 
      WHERE sales_order_id IN (
        SELECT id FROM sales_orders WHERE location_id = $1
      );
    `, [TARGET_LOCATION_ID]);
    console.log(`🗑️ Deleted ${soiDel.rowCount} sales order items.`);

    // 4. Delete Sales Orders
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
