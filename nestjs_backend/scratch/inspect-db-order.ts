import 'dotenv/config';
import { PrismaService } from '../src/database/prisma.service';

async function main() {
  const prisma = new PrismaService({
    tenantId: 'cmqawmt090001l8u1yls73xhc',
    tenantDbUrl: 'postgresql://user_june_6_mqawmlin:2kaiRX1fQUnq7Bq*vCTYlzrjYqyt2SpJ@localhost:5433/tenant_june_6_mqawmlin?schema=public'
  });

  try {
    const barcodes = ['104800', '105566', '105584'];
    const items = await prisma.item.findMany({
      where: {
        barCode: { in: barcodes }
      }
    });

    console.log('ITEMS FOR BARCODES:', JSON.stringify(items, null, 2));

    const orders = await prisma.salesOrder.findMany({
      where: { orderNumber: 'DHAZ-260707-00010' },
      include: {
        items: true,
      },
    });
    console.log('ORDERS MATCHING DHAZ-260707-00010:', JSON.stringify(orders, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
