import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const managementConnectionString = process.env.DATABASE_URL_MANAGEMENT || process.env.DATABASE_URL;
  console.log('Connecting to management DB:', managementConnectionString);
  const client = new Client({ connectionString: managementConnectionString });
  await client.connect();

  try {
    const dbsRes = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
    console.log('ALL DATABASES:', dbsRes.rows.map(r => r.datname));

    const companyRes = await client.query('SELECT id, name, code, "dbName", "dbUrl" FROM "Company";');
    console.log('ALL COMPANIES:', JSON.stringify(companyRes.rows, null, 2));

    const bulkUploadRes = await client.query('SELECT id, filename, status, "totalRecords", "processedRecords", "successRecords" FROM "BulkUpload";');
    console.log('MANAGEMENT BULK UPLOADS:', JSON.stringify(bulkUploadRes.rows, null, 2));

  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
