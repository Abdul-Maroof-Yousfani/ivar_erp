import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:root@localhost:5432/tenant_ivar_mo2z612h?schema=public'
  });
  await client.connect();
  
  // Check any RV details with non-null tagAccountId
  const rvTags = await client.query(`
    SELECT d.id, a.code as acc_code, a.name as acc_name,
           t.code as tag_code, t.name as tag_name,
           d.debit, d.credit, d.narration
    FROM "ReceiptVoucherDetail" d
    JOIN "ChartOfAccount" a ON d."accountId" = a.id
    JOIN "ChartOfAccount" t ON d."tagAccountId" = t.id
    LIMIT 5;
  `);
  console.log('RV Details with tagAccountId:', rvTags.rows);

  // Check any JV details with non-null tagAccountId
  const jvTags = await client.query(`
    SELECT d.id, a.code as acc_code, a.name as acc_name,
           t.code as tag_code, t.name as tag_name,
           d.debit, d.credit, d.narration
    FROM "JournalVoucherDetail" d
    JOIN "ChartOfAccount" a ON d."accountId" = a.id
    JOIN "ChartOfAccount" t ON d."tagAccountId" = t.id
    LIMIT 5;
  `);
  console.log('JV Details with tagAccountId:', jvTags.rows);

  // Check how 4001 or 40010013 is used in JV or RV
  const salesLines = await client.query(`
    SELECT d.id, a.code as acc_code, a.name as acc_name,
           t.code as tag_code, t.name as tag_name,
           d.debit, d.credit, d.narration
    FROM "JournalVoucherDetail" d
    LEFT JOIN "ChartOfAccount" a ON d."accountId" = a.id
    LEFT JOIN "ChartOfAccount" t ON d."tagAccountId" = t.id
    WHERE a.code LIKE '4001%' OR t.code LIKE '4001%'
    LIMIT 10;
  `);
  console.log('JV Details with 4001%:', salesLines.rows);

  await client.end();
}

main().catch(console.error);
