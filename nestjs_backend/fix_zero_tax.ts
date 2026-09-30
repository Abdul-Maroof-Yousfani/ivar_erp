import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';

const logger = new Logger('ZeroTaxFixScript');

function isNonZeroHsCode(code: string | null | undefined): boolean {
  if (!code) return false;
  const c = code.trim();
  return c !== '' && c !== '0' && c !== '0.00' && c !== '00000000';
}

async function fixZeroTaxOrdersInChunk(chunk: string[], fbrService: any, prisma: any, correctTaxPercent: number = 18) {
  const taxDivisor = 1 + correctTaxPercent / 100;
  const results: any[] = [];

  for (const orderNumber of chunk) {
    logger.log(`Processing order: ${orderNumber}`);
    try {
      const order = await prisma.salesOrder.findUnique({
        where: { orderNumber },
        include: { items: { include: { item: true } }, customer: true, location: true },
      });

      if (!order) {
        results.push({ orderNumber, success: false, error: 'Order not found' });
        continue;
      }

      if (order.fbrStatus !== 'SYNCED' || !order.fbrInvoiceNumber) {
         results.push({ orderNumber, success: false, error: 'Order is not synced to FBR' });
         continue;
      }

      const location = order.location;
      if (!location?.fbrEnabled || !location.fbrBposId || !location.fbrBearerToken) {
         results.push({ orderNumber, success: false, error: 'Location FBR config missing' });
         continue;
      }

      // 1. Issue Credit Note to cancel the previous invoice
      const creditNoteItems = order.items.map((line: any) => {
        const rec = line.item;
        const validHsCode = isNonZeroHsCode(rec?.hsCode?.hsCode) ? rec?.hsCode?.hsCode : isNonZeroHsCode(rec?.hsCodeStr) ? rec?.hsCodeStr : null;
        return {
          itemId: line.itemId,
          sku: rec?.sku ?? line.itemId,
          description: rec?.description ?? null,
          hsCode: validHsCode,
          pctCode: validHsCode,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          taxPercent: Number(line.taxPercent),
          discountAmount: Number(line.discountAmount),
          taxAmount: Number(line.taxAmount),
          lineTotal: Number(line.lineTotal),
        };
      });

      const creditNotePayload = fbrService.buildPayload({
        posId: location.fbrBposId,
        usin: `${order.orderNumber}-CN`,
        orderDate: new Date(),
        buyerNtn: order.customerNtn || (order.customer as any)?.ntn || null,
        buyerCnic: order.customerCnic || (order.customer as any)?.cnic || null,
        buyerName: order.customerName || (order.customer as any)?.name || 'Guest',
        buyerPhone: order.customerPhone || (order.customer as any)?.contactNo || null,
        paymentMode: 1, 
        invoiceType: 3, 
        refUsin: order.orderNumber, 
        items: creditNoteItems,
      });

      const cnResponse = await fbrService.postInvoice(creditNotePayload, undefined, location.fbrBearerToken);
      const cnCodeStr = String(cnResponse.Code ?? '');
      
      if (cnCodeStr !== '100') {
         logger.warn(`Credit Note failed for ${orderNumber}: ${cnResponse.Errors || cnResponse.Response}`);
         results.push({ orderNumber, success: false, error: `Credit Note failed: ${cnResponse.Errors || cnResponse.Response}` });
         continue;
      }

      logger.log(`Credit note issued for ${orderNumber}. Ref: ${cnResponse.InvoiceNumber}`);

      // 2. Correct Database Calculations
      let newTotalTax = 0;
      let newSubtotal = 0;
      let newTotalDiscount = 0;

      const updatedItemsData = order.items.map((line: any) => {
        const retailPrice = Number(line.unitPrice);
        const quantity = Number(line.quantity);
        const oldDiscountAmt = Number(line.discountAmount);
        
        const wostPerUnit = retailPrice / taxDivisor;
        const totalWost = Math.round(wostPerUnit * quantity * 100) / 100;
        
        // Scale down discount amount
        const newDiscountAmount = Math.round((oldDiscountAmt / taxDivisor) * 100) / 100;
        
        const afterDisc = totalWost - newDiscountAmount;
        const newTaxAmt = Math.round(afterDisc * (correctTaxPercent / 100) * 100) / 100;
        
        const newLineTotal = Math.round((afterDisc + newTaxAmt) * 100) / 100;
        
        newTotalTax += newTaxAmt;
        newSubtotal += totalWost;
        newTotalDiscount += newDiscountAmount;

        return {
           id: line.id,
           taxPercent: correctTaxPercent,
           taxAmount: newTaxAmt,
           discountAmount: newDiscountAmount,
           lineTotal: newLineTotal 
        };
      });

      const fbrPosFee = location.fbrNtn ? 1 : 0;
      const newGrandTotal = Math.max(0, Math.round(newSubtotal - newTotalDiscount + newTotalTax + fbrPosFee));

      await prisma.$transaction(async (tx: any) => {
         for (const itemUpdate of updatedItemsData) {
            await tx.salesOrderItem.update({
               where: { id: itemUpdate.id },
               data: {
                  taxPercent: itemUpdate.taxPercent,
                  taxAmount: itemUpdate.taxAmount,
                  discountAmount: itemUpdate.discountAmount,
                  lineTotal: itemUpdate.lineTotal
               }
            });
         }

         await tx.salesOrder.update({
            where: { id: order.id },
            data: {
               subtotal: newSubtotal,
               taxAmount: newTotalTax,
               discountAmount: newTotalDiscount,
               grandTotal: newGrandTotal
            }
         });
      });

      logger.log(`Database updated for ${orderNumber}`);

      // 3. Resubmit new Invoice to FBR
      const refetchedOrder = await prisma.salesOrder.findUnique({
        where: { id: order.id },
        include: { items: { include: { item: true } } },
      });

      const fbrItems = refetchedOrder.items.map((line: any) => {
        const rec = line.item;
        const validHsCode = isNonZeroHsCode(rec?.hsCode?.hsCode) ? rec?.hsCode?.hsCode : isNonZeroHsCode(rec?.hsCodeStr) ? rec?.hsCodeStr : null;
        return {
          itemId: line.itemId,
          sku: rec?.sku ?? line.itemId,
          description: rec?.description ?? null,
          hsCode: validHsCode,
          pctCode: validHsCode,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          taxPercent: Number(line.taxPercent),
          discountAmount: Number(line.discountAmount),
          taxAmount: Number(line.taxAmount),
          lineTotal: Number(line.lineTotal),
        };
      });

      const revisedUsin = `${order.orderNumber}-R`; 
      
      const newInvoicePayload = fbrService.buildPayload({
        posId: location.fbrBposId,
        usin: revisedUsin,
        orderDate: new Date(),
        buyerNtn: order.customerNtn || (order.customer as any)?.ntn || null,
        buyerCnic: order.customerCnic || (order.customer as any)?.cnic || null,
        buyerName: order.customerName || (order.customer as any)?.name || 'Guest',
        buyerPhone: order.customerPhone || (order.customer as any)?.contactNo || null,
        paymentMode: 1, 
        invoiceType: 1, 
        items: fbrItems,
      });

      const newFbrResponse = await fbrService.postInvoice(newInvoicePayload, undefined, location.fbrBearerToken);
      const newResponseCodeStr = String(newFbrResponse.Code ?? '');
      
      if (newResponseCodeStr === '100' && newFbrResponse.InvoiceNumber) {
         await prisma.salesOrder.update({
           where: { id: order.id },
           data: {
             fbrInvoiceNumber: newFbrResponse.InvoiceNumber,
             fbrQrCode: newFbrResponse.QRCode || String(newFbrResponse.InvoiceNumber),
             fbrStatus: 'SYNCED',
           }
         });
         logger.log(`Successfully resynced ${orderNumber}. New FBR Invoice: ${newFbrResponse.InvoiceNumber}`);
         results.push({ orderNumber, success: true, newFbrInvoiceNumber: newFbrResponse.InvoiceNumber, oldFbrInvoiceNumber: order.fbrInvoiceNumber });
      } else {
         results.push({ orderNumber, success: false, error: `Resync failed: ${newFbrResponse.Errors || newFbrResponse.Response}` });
      }

    } catch (err: any) {
       logger.error(`Exception for order ${orderNumber}: ${err.message}`);
       results.push({ orderNumber, success: false, error: err.message });
    }
  }

  return results;
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  let prisma: any;
  let fbrService: any;
  try {
    const { PosSalesService } = require('./src/pos-sales/pos-sales.service');
    const posSalesService = app.get(PosSalesService);
    
    // Extract injected dependencies directly from the service at runtime
    // (Bypasses TypeScript private modifier and NestJS module encapsulation)
    prisma = posSalesService['prisma'] || posSalesService['prismaService'];
    fbrService = posSalesService['fbrService'];
    
    if (!prisma) throw new Error("Could not extract PrismaService");
    if (!fbrService) throw new Error("Could not extract FbrService");
    
  } catch (err: any) {
    logger.error('Error extracting services: ' + err.message);
    await app.close();
    return;
  }

  const mdPath = path.join(__dirname, 'sales_orders_with_0_taxrate.md');
  if (!fs.existsSync(mdPath)) {
    logger.error('Could not find sales_orders_with_0_taxrate.md in the root directory.');
    await app.close();
    return;
  }
  
  const content = fs.readFileSync(mdPath, 'utf8');
  const lines = content.split('\n');
  const orderNumbers: string[] = [];
  
  for (const line of lines) {
    if (line.trim().startsWith('| SI-')) {
      const parts = line.split('|');
      const orderNumber = parts[1].trim();
      if (orderNumber && !orderNumbers.includes(orderNumber)) {
        orderNumbers.push(orderNumber);
      }
    }
  }

  logger.log(`Found ${orderNumbers.length} unique orders to fix.`);

  const chunkSize = 20;
  for (let i = 0; i < orderNumbers.length; i += chunkSize) {
    const chunk = orderNumbers.slice(i, i + chunkSize);
    logger.log(`Processing chunk ${Math.floor(i / chunkSize) + 1} / ${Math.ceil(orderNumbers.length / chunkSize)}`);
    const results = await fixZeroTaxOrdersInChunk(chunk, fbrService, prisma, 18);
    console.log(results);
  }

  await app.close();
}

bootstrap().catch(err => {
  console.error(err);
  process.exit(1);
});
