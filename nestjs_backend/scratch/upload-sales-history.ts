import 'dotenv/config';
import { Client } from 'pg';
import * as XLSX from 'xlsx';

import * as path from 'path';

// =========================================================================
// CONFIGURATION: Enter your target Location ID and Excel path here
// =========================================================================
const TARGET_LOCATION_ID = process.env.TARGET_LOCATION_ID || '229c1ecd-11f0-43dd-94f6-17c165a3003d';
const EXCEL_FILE_PATH = process.env.EXCEL_FILE_PATH || path.join(__dirname, '..', '..', 'sales-history.xlsx');


// Excel Date Converter
function parseExcelDate(val: any): Date {
  if (typeof val === 'number') {
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d;
  return new Date();
}

// Generate UUID for records
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function main() {
  console.log(`Starting sales history upload for Location ID: ${TARGET_LOCATION_ID}`);
  console.log(`Reading Excel file: ${EXCEL_FILE_PATH}`);

  // 1. Read Excel Sheet
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.readFile(EXCEL_FILE_PATH);
  } catch (err: any) {
    console.error(`❌ Failed to read Excel file: ${err.message}`);
    return;
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    console.error(`❌ Sheet not found in Excel workbook`);
    return;
  }

  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);
  console.log(`📋 Read ${rawRows.length} rows from Excel.`);

  if (rawRows.length === 0) {
    console.log('ℹ️ No records found in Excel sheet.');
    return;
  }

  // 2. Connect to Management DB and get tenant DBs
  const managementConnectionString = process.env.DATABASE_URL_MANAGEMENT || process.env.DATABASE_URL;
  if (!managementConnectionString) {
    console.error('DATABASE_URL_MANAGEMENT or DATABASE_URL not set in .env');
    return;
  }

  const managementUrl = new URL(managementConnectionString);
  const dbHost = managementUrl.hostname || 'localhost';
  const dbPort = managementUrl.port || '5432';
  const dbUser = managementUrl.username;
  const dbPassword = managementUrl.password;

  const managementClient = new Client({ connectionString: managementConnectionString });
  await managementClient.connect();
  let databases: string[] = [];
  try {
    const res = await managementClient.query(`
      SELECT datname 
      FROM pg_database 
      WHERE datistemplate = false AND datname LIKE 'tenant_%'
      ORDER BY datname;
    `);
    databases = res.rows.map(r => r.datname);
  } catch (err: any) {
    console.error(`Error listing databases: ${err.message}`);
    await managementClient.end();
    return;
  } finally {
    await managementClient.end();
  }

  // 3. Find correct tenant DB (fallback to tenant_june_6_mqawmlin if not found)
  let targetDbName: string | null = null;
  let warehouseId: string | null = null;

  for (const dbName of databases) {
    const connectionString = `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}?schema=public`;
    const client = new Client({ connectionString });
    try {
      await client.connect();
      const locRes = await client.query(`
        SELECT id, name, code, warehouse_id FROM "Location" WHERE id = $1;
      `, [TARGET_LOCATION_ID]);

      if (locRes.rowCount > 0) {
        targetDbName = dbName;
        warehouseId = locRes.rows[0].warehouse_id;
        await client.end();
        break;
      }
      await client.end();
    } catch (e) {
      // ignore
    }
  }

  if (!targetDbName) {
    if (databases.includes('tenant_june_6_mqawmlin')) {
      targetDbName = 'tenant_june_6_mqawmlin';
      console.log(`ℹ️ Location ID not found on any DB. Defaulting target to active DB: "tenant_june_6_mqawmlin"`);
    } else if (databases.length > 0) {
      targetDbName = databases[0];
      console.log(`ℹ️ Location ID not found on any DB. Defaulting target to first DB: "${targetDbName}"`);
    } else {
      console.error(`❌ No tenant databases found on the server.`);
      return;
    }
  }

  // 4. Connect to target database
  const targetConnectionString = `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${targetDbName}?schema=public`;
  const db = new Client({ connectionString: targetConnectionString });
  await db.connect();

  console.log(`🎯 Connected to target database: "${targetDbName}"`);

  try {
    // Check if location exists in this target DB. If not, create it.
    const locCheck = await db.query(`SELECT id, warehouse_id FROM "Location" WHERE id = $1;`, [TARGET_LOCATION_ID]);
    
    if (locCheck.rowCount === 0) {
      // Find first warehouse in DB to link to the new location
      const whRes = await db.query(`SELECT id FROM "Warehouse" WHERE "isDeleted" = false LIMIT 1;`);
      if (whRes.rowCount > 0) {
        warehouseId = whRes.rows[0].id;
      } else {
        throw new Error('No active warehouse found in the database. Cannot create Location.');
      }

      console.log(`➕ Location ID ${TARGET_LOCATION_ID} is missing. Creating new Location "DHA Z Block Lahore" linked to warehouse ${warehouseId}...`);
      await db.query(`
        INSERT INTO "Location" (
          id, name, code, status, warehouse_id, "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW());
      `, [TARGET_LOCATION_ID, 'DHA Z Block Lahore', 'DHAZ', 'active', warehouseId]);
    } else {
      warehouseId = locCheck.rows[0].warehouse_id;
    }

    if (!warehouseId) {
      const whRes = await db.query(`SELECT id FROM "Warehouse" WHERE "isDeleted" = false LIMIT 1;`);
      if (whRes.rowCount > 0) {
        warehouseId = whRes.rows[0].id;
      } else {
        throw new Error('No active warehouse found in the database. Cannot create stock ledgers.');
      }
    }

    // 5. Group rows by Order ID (ID column in Excel)
    const orderGroups = new Map<string, any[]>();
    const allBarcodesSet = new Set<string>();
    const allCustomerCodesSet = new Set<string>();

    for (const row of rawRows) {
      const orderId = row['ID'];
      if (!orderId) continue;
      
      if (!orderGroups.has(orderId)) {
        orderGroups.set(orderId, []);
      }
      orderGroups.get(orderId)!.push(row);

      const barcode = row['Barcode (POS Invoice Item)'];
      if (barcode) allBarcodesSet.add(String(barcode).trim());

      const customerCode = row['Customer'];
      if (customerCode) allCustomerCodesSet.add(String(customerCode).trim());
    }

    console.log(`📦 Grouped Excel rows into ${orderGroups.size} unique sales orders.`);

    // 6. Look up items by Barcode or Item ID in DB
    const barcodesArray = Array.from(allBarcodesSet);
    const itemMap = new Map<string, { id: string; barCode: string }>();
    if (barcodesArray.length > 0) {
      const itemRes = await db.query(`
        SELECT id, "barCode", "itemId" 
        FROM "Item" 
        WHERE "barCode" = ANY($1) OR "itemId" = ANY($1);
      `, [barcodesArray]);
      for (const item of itemRes.rows) {
        if (item.barCode) itemMap.set(item.barCode, item);
        if (item.itemId) itemMap.set(item.itemId, item);
      }
    }
    console.log(`🔍 Looked up items. Matched ${itemMap.size} of ${barcodesArray.length} unique barcodes.`);

    // 7. Auto-create missing items dynamically
    const missingBarcodes = barcodesArray.filter(bc => !itemMap.has(bc));
    if (missingBarcodes.length > 0) {
      console.log(`➕ Creating ${missingBarcodes.length} missing items in database...`);
      await db.query('BEGIN');
      try {
        for (const barcode of missingBarcodes) {
          const rowSample = rawRows.find(r => String(r['Barcode (POS Invoice Item)']).trim() === barcode);
          const itemName = rowSample ? rowSample['Item Name (POS Invoice Item)'] || `Item ${barcode}` : `Item ${barcode}`;
          const itemPrice = rowSample ? Math.abs(parseFloat(rowSample['Amount (POS Invoice Item)'] || '0')) : 0;
          const itemId = generateUUID();

          await db.query(`
            INSERT INTO "Item" (
              id, "itemId", sku, "barCode", description, status, "isActive", "unitPrice", fob, unit_cost, "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW());
          `, [
            itemId,
            barcode, // itemId
            barcode, // sku
            barcode, // barCode
            itemName, // description
            'active', // status
            true, // isActive
            itemPrice, // unitPrice
            0, // fob
            0, // unitCost
          ]);

          itemMap.set(barcode, { id: itemId, barCode: barcode });
        }
        await db.query('COMMIT');
        console.log(`✅ Successfully created ${missingBarcodes.length} new items.`);
      } catch (err: any) {
        await db.query('ROLLBACK');
        console.error(`❌ Failed to create missing items: ${err.message}`);
        throw err;
      }
    }

    // 8. Look up customers by code in DB
    const customersArray = Array.from(allCustomerCodesSet);
    const customerMap = new Map<string, string>(); // code -> id
    if (customersArray.length > 0) {
      const custRes = await db.query(`
        SELECT id, code FROM customers WHERE code = ANY($1);
      `, [customersArray]);
      for (const c of custRes.rows) {
        customerMap.set(c.code, c.id);
      }
    }

    // 9. Process and insert orders inside a single transaction
    await db.query('BEGIN');

    let createdOrdersCount = 0;
    let skippedOrdersCount = 0;

    for (const [orderNumber, rows] of orderGroups.entries()) {
      // Check if orderNumber already exists in sales_orders
      const existsRes = await db.query(`
        SELECT id FROM sales_orders WHERE "orderNumber" = $1;
      `, [orderNumber]);

      if (existsRes.rowCount > 0) {
        skippedOrdersCount++;
        continue;
      }

      const firstRow = rows[0];
      const salesOrderId = generateUUID();
      const orderDate = parseExcelDate(firstRow['Date']);
      const posId = firstRow['POS Id'] ? String(firstRow['POS Id']) : null;
      const grandTotal = parseFloat(firstRow['Grand Total'] || firstRow['Total'] || '0');
      const customerCode = firstRow['Customer'];
      const customerId = customerCode ? customerMap.get(customerCode) || null : null;

      // Calculate totals
      let subtotal = 0;
      
      const lineItemCreates: any[] = [];
      const stockLedgerCreates: any[] = [];

      for (const row of rows) {
        const barcode = String(row['Barcode (POS Invoice Item)']).trim();
        const item = itemMap.get(barcode);
        if (!item) {
          continue;
        }

        const lineAmount = parseFloat(row['Amount (POS Invoice Item)'] || '0');
        const quantity = 1; // Default to 1
        const unitPrice = lineAmount;
        const lineTotal = lineAmount;

        subtotal += lineTotal;

        const itemId = item.id;
        const lineItemId = generateUUID();

        // Stock Ledger entry properties
        const movementQty = lineAmount >= 0 ? -1 : 1; // OUTBOUND reduces stock (-1), INBOUND increases stock (+1)
        const movementType = lineAmount >= 0 ? 'OUTBOUND' : 'INBOUND';

        lineItemCreates.push({
          id: lineItemId,
          salesOrderId,
          itemId,
          quantity,
          unitPrice,
          lineTotal,
          createdAt: orderDate
        });

        stockLedgerCreates.push({
          id: generateUUID(),
          itemId,
          warehouseId,
          qty: movementQty,
          referenceType: 'POS_SALE',
          referenceId: salesOrderId,
          locationId: TARGET_LOCATION_ID,
          movementType,
          rate: Math.abs(unitPrice),
          unitCost: Math.abs(unitPrice),
          createdAt: orderDate
        });
      }

      if (lineItemCreates.length === 0) {
        skippedOrdersCount++;
        continue;
      }

      // Insert Sales Order
      await db.query(`
        INSERT INTO sales_orders (
          id, "orderNumber", "pos_id", "location_id", "customer_id", 
          subtotal, "discountAmount", "taxAmount", "grandTotal", 
          "payment_method", "payment_status", status, "cash_amount", 
          "tender_type", "created_at", "updated_at"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16);
      `, [
        salesOrderId,
        orderNumber,
        posId,
        TARGET_LOCATION_ID,
        customerId,
        subtotal,
        0, // discountAmount
        0, // taxAmount
        grandTotal,
        'cash', // paymentMethod
        grandTotal >= 0 ? 'paid' : 'unpaid', // paymentStatus
        'completed', // status
        grandTotal, // cashAmount
        'cash', // tenderType
        orderDate,
        new Date()
      ]);

      // Insert Sales Order Items
      for (const li of lineItemCreates) {
        await db.query(`
          INSERT INTO sales_order_items (
            id, "sales_order_id", "item_id", quantity, "unitPrice", 
            "discountPercent", "discountAmount", "taxPercent", "taxAmount", 
            "lineTotal", "created_at"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
        `, [
          li.id,
          li.salesOrderId,
          li.itemId,
          li.quantity,
          li.unitPrice,
          0, // discountPercent
          0, // discountAmount
          0, // taxPercent
          0, // taxAmount
          li.lineTotal,
          li.createdAt
        ]);
      }

      // Insert Stock Ledgers and Update InventoryItem
      for (const sl of stockLedgerCreates) {
        await db.query(`
          INSERT INTO stock_ledgers (
            id, item_id, warehouse_id, qty, reference_type, 
            reference_id, location_id, movement_type, rate, 
            unit_cost, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
        `, [
          sl.id,
          sl.itemId,
          sl.warehouseId,
          sl.qty,
          sl.referenceType,
          sl.referenceId,
          sl.locationId,
          sl.movementType,
          sl.rate,
          sl.unitCost,
          sl.createdAt
        ]);

        // Update InventoryItem
        const invRes = await db.query(`
          SELECT id, quantity 
          FROM "InventoryItem" 
          WHERE "locationId" = $1 AND "itemId" = $2 AND "warehouseId" = $3 AND status = 'AVAILABLE';
        `, [TARGET_LOCATION_ID, sl.itemId, warehouseId]);

        if (invRes.rowCount > 0) {
          await db.query(`
            UPDATE "InventoryItem" 
            SET quantity = quantity + $1, "updatedAt" = NOW() 
            WHERE id = $2;
          `, [sl.qty, invRes.rows[0].id]);
        } else {
          await db.query(`
            INSERT INTO "InventoryItem" (
              id, "warehouseId", "locationId", "itemId", quantity, status, "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW());
          `, [generateUUID(), warehouseId, TARGET_LOCATION_ID, sl.itemId, sl.qty, 'AVAILABLE']);
        }
      }

      createdOrdersCount++;
    }

    await db.query('COMMIT');
    
    console.log(`\n============================================================`);
    console.log(`🚀 IMPORT FINISHED SUCCESSFULLY!`);
    console.log(`   Created Orders: ${createdOrdersCount}`);
    console.log(`   Skipped/Existing Orders: ${skippedOrdersCount}`);
    console.log(`============================================================`);

  } catch (err: any) {
    await db.query('ROLLBACK');
    console.error(`❌ Transaction failed and rolled back: ${err.message}`);
  } finally {
    await db.end();
  }
}

main().catch(console.error);
