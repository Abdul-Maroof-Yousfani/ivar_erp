import { Client } from 'pg';

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:admin@localhost:5432/tenant_ivar' });
  await client.connect();

  const existing = await client.query("SELECT id, code, name FROM \"Warehouse\" WHERE code = 'WH-B-GRADE' OR name ILIKE '%b grade%';");
  if (existing.rows.length === 0) {
    const res = await client.query(`
      INSERT INTO "Warehouse" (id, code, name, type, "isActive", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'WH-B-GRADE', 'B Grade Warehouse', 'B_GRADE', true, NOW(), NOW())
      RETURNING id, code, name;
    `);
    console.log('✅ Created B-Grade Warehouse:', res.rows[0]);
  } else {
    console.log('ℹ️ B-Grade Warehouse already exists:', existing.rows[0]);
  }

  const allWh = await client.query('SELECT id, code, name, type FROM "Warehouse";');
  console.log('\nAll Warehouses:');
  for (const w of allWh.rows) {
    console.log(` - [${w.code}] ${w.name} (type: ${w.type}, id: ${w.id})`);
  }

  await client.end();
}

main().catch(console.error);

