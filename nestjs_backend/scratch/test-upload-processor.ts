import 'dotenv/config';
import { PrismaService } from '../src/database/prisma.service';
import { SalesHistoryUploadProcessor, SalesHistoryUploadProgress } from '../src/queue/processors/sales-history-upload.processor';
import { SalesHistoryParsedRecord } from '../src/common/services/sales-history-csv-parser.service';

async function main() {
  console.log('Running sales upload processor test...');

  const prisma = new PrismaService({
    tenantId: 'cmqawmt090001l8u1yls73xhc',
    tenantDbUrl: 'postgresql://user_june_6_mqawmlin:2kaiRX1fQUnq7Bq*vCTYlzrjYqyt2SpJ@localhost:5433/tenant_june_6_mqawmlin?schema=public'
  });

  const uploadId = 'test-upload-id';

  // 1. Delete existing order and items to start clean
  await prisma.salesOrderItem.deleteMany({
    where: { salesOrder: { orderNumber: 'DHAZ-260707-00010' } }
  });
  await prisma.salesOrder.deleteMany({
    where: { orderNumber: 'DHAZ-260707-00010' }
  });
  console.log('Deleted existing order DHAZ-260707-00010 (if any).');

  // 2. Build mock rows representing DHAZ-260707-00010
  const rows: SalesHistoryParsedRecord[] = [
    {
      row: 30516,
      data: {
        documentNumber: 'DHAZ-260707-00010',
        documentDate: '7/7/2026',
        barCode: '104800',
        quantity: 3,
        unitPrice: 4250,
        totalPriceWithTax: 12750,
        salesTax: 1945,
        cashSale: 38250
      }
    },
    {
      row: 30517,
      data: {
        documentNumber: 'DHAZ-260707-00010',
        documentDate: '7/7/2026',
        barCode: '105566',
        quantity: 3,
        unitPrice: 4250,
        totalPriceWithTax: 12750,
        salesTax: 1945,
        cashSale: 38250
      }
    },
    {
      row: 30518,
      data: {
        documentNumber: 'DHAZ-260707-00010',
        documentDate: '7/7/2026',
        barCode: '105584',
        quantity: 3,
        unitPrice: 4250,
        totalPriceWithTax: 12750,
        salesTax: 1945,
        cashSale: 38250
      }
    }
  ];

  const batch: [string, SalesHistoryParsedRecord[]][] = [
    ['DHAZ-260707-00010', rows]
  ];

  const progress: SalesHistoryUploadProgress = {
    totalRecords: 3,
    processedRecords: 0,
    successRecords: 0,
    failedRecords: 0,
    skippedRecords: 0,
    errors: []
  };

  // 3. Instantiate processor and call processOrderBatch
  const processor = new SalesHistoryUploadProcessor(null as any, null as any, null as any, null as any);
  
  // Expose private method using bracket notation
  await (processor as any).processOrderBatch(batch, progress, uploadId, prisma, {});

  console.log('Progress outcome:', JSON.stringify(progress, null, 2));

  // 4. Query the database to verify the saved order
  const savedOrder = await prisma.salesOrder.findFirst({
    where: { orderNumber: 'DHAZ-260707-00010' },
    include: {
      items: true
    }
  });

  console.log('SAVED ORDER:', JSON.stringify(savedOrder, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
