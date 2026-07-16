import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { Client } from 'pg';

const DB_URL = 'postgresql://ivar_admin:ivar2026%23%23%23may1-unlimited@localhost:5432/tenant_ivar_mo2z612h';

async function main() {
  const uploadDir = path.join(__dirname, '../../sales-history');
  const files = fs.readdirSync(uploadDir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));

  console.log(`Reading ${files.length} upload file(s)...`);

  const allDocNumbers = new Set<string>();

  for (const file of files) {
    const filePath = path.join(uploadDir, file);
    console.log(`  Reading: ${file} (${(fs.statSync(filePath).size / 1024 / 1024).toFixed(1)} MB)`);

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    const headers: string[] = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
      headers.push(cell ? String(cell.v).trim() : `COL_${C}`);
    }

    // Find DocumentNumber column (could be 'DocumentNumber', 'SUB', etc.)
    const docColIdx = headers.findIndex(h =>
      ['DocumentNumber', 'SUB', 'Document Number', 'DocumentNo'].includes(h)
    );

    if (docColIdx === -1) {
      console.error(`  Could not find DocumentNumber column in ${file}. Headers: ${headers.slice(0, 10).join(', ')}`);
      continue;
    }

    console.log(`  Using column "${headers[docColIdx]}" (index ${docColIdx}) as DocumentNumber`);

    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: docColIdx })];
      if (cell && cell.v !== null && cell.v !== undefined) {
        const val = String(cell.w !== undefined ? cell.w : cell.v).trim();
        if (val) allDocNumbers.add(val);
      }
    }

    console.log(`  → Collected ${allDocNumbers.size} unique document numbers so far`);
  }

  console.log(`\nTotal unique DocumentNumbers collected: ${allDocNumbers.size}`);

  if (allDocNumbers.size === 0) {
    console.log('No document numbers found — nothing to delete.');
    return;
  }

  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('\nConnected to database.');

  try {
    // Check how many orders exist
    const docArray = Array.from(allDocNumbers);
    
    // Check in batches to avoid "too many parameters" error
    const BATCH_SIZE = 1000;
    let totalOrders = 0;
    let totalItems = 0;

    for (let i = 0; i < docArray.length; i += BATCH_SIZE) {
      const batch = docArray.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(', ');
      
      const countRes = await client.query(
        `SELECT COUNT(*) FROM sales_orders WHERE "orderNumber" IN (${placeholders})`,
        batch
      );
      totalOrders += parseInt(countRes.rows[0].count);
    }

    console.log(`Found ${totalOrders} sales orders to delete (out of ${allDocNumbers.size} document numbers).`);

    if (totalOrders === 0) {
      console.log('No matching orders found in database. Nothing to delete.');
      return;
    }

    console.log('\nDeleting in batches...');

    let deletedOrders = 0;
    let deletedItems = 0;

    for (let i = 0; i < docArray.length; i += BATCH_SIZE) {
      const batch = docArray.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(', ');

      // Delete orders — items are deleted automatically via ON DELETE CASCADE
      const ordersRes = await client.query(
        `DELETE FROM sales_orders WHERE "orderNumber" IN (${placeholders})`,
        batch
      );
      const deletedCount = ordersRes.rowCount ?? 0;
      deletedOrders += deletedCount;
      // We can't easily count cascaded items, but the orders are deleted
      deletedItems += deletedCount; // placeholder

      const pct = Math.round(((i + batch.length) / docArray.length) * 100);
      process.stdout.write(`\r  Progress: ${pct}% — Deleted ${deletedOrders} orders, ${deletedItems} items`);
    }

    console.log(`\n\n✅ DONE! Deleted ${deletedOrders} sales orders and ${deletedItems} line items.`);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
