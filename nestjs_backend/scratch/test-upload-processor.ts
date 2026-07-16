import 'dotenv/config';
import { PrismaService } from '../src/database/prisma.service';
import { SalesHistoryUploadProcessor, SalesHistoryUploadProgress } from '../src/queue/processors/sales-history-upload.processor';
import { SalesHistoryParsedRecord } from '../src/common/services/sales-history-csv-parser.service';

const DB_URL = 'postgresql://user_june_6_mqawmlin:2kaiRX1fQUnq7Bq*vCTYlzrjYqyt2SpJ@localhost:5433/tenant_june_6_mqawmlin?schema=public';

async function main() {
  const prisma = new PrismaService({
    tenantId: 'cmqawmt090001l8u1yls73xhc',
    tenantDbUrl: DB_URL
  });

  const processor = new SalesHistoryUploadProcessor(null as any, null as any, null as any, null as any);

  // ── SCENARIO 1: Order 18590 — 6 items, payment only on last row, 2-digit year date ──
  console.log('\n═══ SCENARIO 1: Order 18590 (payment on last row only, 2-digit year) ═══');
  await prisma.salesOrderItem.deleteMany({ where: { salesOrder: { orderNumber: '18590' } } });
  await prisma.salesOrder.deleteMany({ where: { orderNumber: '18590' } });

  const rows18590: SalesHistoryParsedRecord[] = [
    { row: 1, data: { documentNumber: '18590', documentDate: '4/30/26', barCode: '104800', quantity: 1, unitPrice: 5000, totalPriceWithTax: 5000 } },
    { row: 2, data: { documentNumber: '18590', documentDate: '4/30/26', barCode: '105566', quantity: 1, unitPrice: 14000, totalPriceWithTax: 14000 } },
    { row: 3, data: { documentNumber: '18590', documentDate: '4/30/26', barCode: '105584', quantity: 1, unitPrice: 15500, totalPriceWithTax: 15500 } },
    { row: 4, data: { documentNumber: '18590', documentDate: '4/30/26', barCode: '104800', quantity: 1, unitPrice: 32000, totalPriceWithTax: 32000 } },
    { row: 5, data: { documentNumber: '18590', documentDate: '4/30/26', barCode: '105566', quantity: 1, unitPrice: 12000, totalPriceWithTax: 12000 } },
    // Only last row has payment column populated:
    { row: 6, data: { documentNumber: '18590', documentDate: '4/30/26', barCode: '105584', quantity: 1, unitPrice: 18500, totalPriceWithTax: 18500, cardSale: 97001 } },
  ];

  const progress1: SalesHistoryUploadProgress = { totalRecords: 6, processedRecords: 0, successRecords: 0, failedRecords: 0, skippedRecords: 0, errors: [] };
  await (processor as any).processOrderBatch([['18590', rows18590]], progress1, 'test-1', prisma, {});
  
  const order18590 = await prisma.salesOrder.findFirst({ where: { orderNumber: '18590' }, include: { items: true } });
  const savedDate = order18590?.createdAt;
  console.log('Date saved:', savedDate?.toISOString(), '(expected: 2026-04-30T00:00:00.000Z)');
  console.log('Card Amount:', order18590?.cardAmount, '(expected: 97001)');
  console.log('Payment Method:', order18590?.paymentMethod, '(expected: card)');
  console.log('Grand Total:', order18590?.grandTotal, '(expected: ~97000)');
  console.log('Items count:', order18590?.items.length, '(expected: 3 - only items with matching barcodes in DB)');

  // ── SCENARIO 2: Order DHAZ-260707-00010 — 3 items, duplicated payments, 4-digit year date ──
  console.log('\n═══ SCENARIO 2: DHAZ-260707-00010 (duplicated payments, 4-digit year) ═══');
  await prisma.salesOrderItem.deleteMany({ where: { salesOrder: { orderNumber: 'DHAZ-260707-00010' } } });
  await prisma.salesOrder.deleteMany({ where: { orderNumber: 'DHAZ-260707-00010' } });

  const rowsDHA: SalesHistoryParsedRecord[] = [
    { row: 10, data: { documentNumber: 'DHAZ-260707-00010', documentDate: '7/7/2026', barCode: '104800', quantity: 3, unitPrice: 4250, totalPriceWithTax: 12750, salesTax: 1945, cashSale: 38250 } },
    { row: 11, data: { documentNumber: 'DHAZ-260707-00010', documentDate: '7/7/2026', barCode: '105566', quantity: 3, unitPrice: 4250, totalPriceWithTax: 12750, salesTax: 1945, cashSale: 38250 } },
    { row: 12, data: { documentNumber: 'DHAZ-260707-00010', documentDate: '7/7/2026', barCode: '105584', quantity: 3, unitPrice: 4250, totalPriceWithTax: 12750, salesTax: 1945, cashSale: 38250 } },
  ];

  const progress2: SalesHistoryUploadProgress = { totalRecords: 3, processedRecords: 0, successRecords: 0, failedRecords: 0, skippedRecords: 0, errors: [] };
  await (processor as any).processOrderBatch([['DHAZ-260707-00010', rowsDHA]], progress2, 'test-2', prisma, {});

  const orderDHA = await prisma.salesOrder.findFirst({ where: { orderNumber: 'DHAZ-260707-00010' }, include: { items: true } });
  console.log('Date saved:', orderDHA?.createdAt?.toISOString(), '(expected: 2026-07-07T00:00:00.000Z)');
  console.log('Cash Amount:', orderDHA?.cashAmount, '(expected: 12750)');
  console.log('Grand Total:', orderDHA?.grandTotal, '(expected: 12750)');
  console.log('Items[0] quantity:', orderDHA?.items[0]?.quantity, '(expected: 1)');
  console.log('Items[0] lineTotal:', orderDHA?.items[0]?.lineTotal, '(expected: 4250)');

  await prisma.$disconnect();
}

main().catch(console.error);
