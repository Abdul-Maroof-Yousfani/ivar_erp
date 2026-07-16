import 'dotenv/config';
import { PrismaService } from '../src/database/prisma.service';

async function main() {
  const prisma = new PrismaService({
    tenantId: 'cmqawmt090001l8u1yls73xhc',
    tenantDbUrl: 'postgresql://user_june_6_mqawmlin:2kaiRX1fQUnq7Bq*vCTYlzrjYqyt2SpJ@localhost:5433/tenant_june_6_mqawmlin?schema=public'
  });

  try {
    const searchTerms = ['174445', '6011069-001', '198634'];
    
    // Find items matching any of these terms in id, itemId, sku, or barCode
    const items = await prisma.item.findMany({
      where: {
        OR: [
          { itemId: { in: searchTerms } },
          { sku: { contains: '6011069' } },
          { barCode: { contains: '174445' } },
          { barCode: { contains: '198634' } },
        ]
      }
    });

    console.log('FOUND ITEMS:', JSON.stringify(items, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
