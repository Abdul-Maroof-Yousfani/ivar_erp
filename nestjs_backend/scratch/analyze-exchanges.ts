import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const dbName = 'tenant_1_april_mnsye46l'; // Let's use one of the active tenant DBs
  const dbUrl = `postgresql://speedlimit:speedlimit123@localhost:5433/${dbName}?schema=public`;
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    console.log(`Analyzing DB: ${dbName}`);

    // Count of sales orders by status
    const orderStatus = await client.query(`
      SELECT status, COUNT(*) as count 
      FROM sales_orders 
      GROUP BY status;
    `);
    console.log('\nSales Orders by Status:');
    console.log(orderStatus.rows);

    // Count of claims by type
    const claimTypes = await client.query(`
      SELECT claim_type, status, COUNT(*) as count 
      FROM pos_claims 
      GROUP BY claim_type, status;
    `);
    console.log('\nClaims:');
    console.log(claimTypes.rows);

    // Count of vouchers by type and status
    const voucherTypes = await client.query(`
      SELECT voucher_type, is_redeemed, is_active, COUNT(*) as count 
      FROM pos_vouchers 
      GROUP BY voucher_type, is_redeemed, is_active;
    `);
    console.log('\nVouchers:');
    console.log(voucherTypes.rows);

    // Count of stock ledger entries by reference_type
    const ledgerTypes = await client.query(`
      SELECT reference_type, COUNT(*) as count 
      FROM stock_ledgers 
      GROUP BY reference_type;
    `);
    console.log('\nStock Ledger Entries:');
    console.log(ledgerTypes.rows);

    // Count of locations
    const locations = await client.query(`
      SELECT id, name, code FROM "Location";
    `);
    console.log('\nLocations:');
    console.log(locations.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
