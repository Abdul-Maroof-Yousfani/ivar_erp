import { Client } from 'pg';

async function run() {
  const client = new Client({
    connectionString: "postgresql://ivar:ivar123@localhost:5432/tenant_deepak_mp178tz6"
  });
  await client.connect();
  
  try {
     const res = await client.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public';
     `);
     for (const row of res.rows) {
        await client.query(`ALTER TABLE "${row.tablename}" OWNER TO "user_deepak_mp178tz7"`);
     }
     console.log("Success ALL TABLES");
  } catch (e) {
     console.error(e);
  }
  await client.end();
}
run();
