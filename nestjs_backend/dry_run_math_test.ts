import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma/prisma.service'; // Assuming PrismaService is here, adjust if needed

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get('PrismaService'); // Or however it's injected

  // Let's take just one order to show the math
  const orderNumber = 'SI-BC26-00542'; // First order from your list
  console.log(`\n===========================================`);
  console.log(`🔍 DRY RUN MATH TEST FOR ORDER: ${orderNumber}`);
  console.log(`===========================================\n`);

  const order = await prisma.salesOrder.findUnique({
    where: { orderNumber },
    include: { items: true },
  });

  if (!order) {
    console.log('Order not found!');
    await app.close();
    return;
  }

  const correctTaxPercent = 18;
  const taxDivisor = 1 + correctTaxPercent / 100;
  
  let newSubtotal = 0;
  let newTotalTax = 0;
  let newDiscountAmount = 0;

  console.log(`--- ITEM LEVEL CHANGES ---`);
  order.items.forEach((item, index) => {
    const qty = Number(item.quantity);
    const retailPrice = Number(item.unitPrice);
    
    // OLD VALUES
    const oldWost = retailPrice * qty; // Since old tax was 0
    const oldDiscountAmt = Number(item.discountAmount);
    const oldDiscountPct = Number(item.discountPercent);
    const oldLineTotal = Number(item.lineTotal);

    // NEW CALCULATIONS (using stored discountPercent)
    const newWostPerUnit = retailPrice / taxDivisor;
    const newTotalWost = Math.round(newWostPerUnit * qty * 100) / 100;
    
    // Recalculate discount amount based on new WOST and original discount percent
    const newDiscAmt = Math.round(newTotalWost * (oldDiscountPct / 100) * 100) / 100;
    
    const afterDisc = newTotalWost - newDiscAmt;
    const newTaxAmt = Math.round(afterDisc * (correctTaxPercent / 100) * 100) / 100;
    const newLineTotal = Math.round((afterDisc + newTaxAmt) * 100) / 100;

    newSubtotal += newTotalWost;
    newDiscountAmount += newDiscAmt;
    newTotalTax += newTaxAmt;

    console.log(`\nItem ${index + 1}: (Retail Price: ${retailPrice}, Qty: ${qty})`);
    console.log(`  Old WOST: ${oldWost}  =>  New WOST: ${newTotalWost}`);
    console.log(`  Old Discount (Amt): ${oldDiscountAmt} (${oldDiscountPct}%)  =>  New Discount (Amt): ${newDiscAmt}`);
    console.log(`  Old Tax: 0  =>  New Tax: ${newTaxAmt} (18%)`);
    console.log(`  Old Line Total: ${oldLineTotal}  =>  New Line Total: ${newLineTotal}`);
    
    if (Math.abs(oldLineTotal - newLineTotal) > 0.05) {
       console.log(`  🚨 WARNING: Line total mismatch!`);
    } else {
       console.log(`  ✅ Line total matches perfectly!`);
    }
  });

  console.log(`\n--- ORDER LEVEL CHANGES ---`);
  const oldGrandTotal = Number(order.grandTotal);
  // Re-calculate grand total
  const fbrPosFee = order.locationId ? 1 : 0; // rough check
  const newGrandTotal = Math.max(0, Math.round(newSubtotal - newDiscountAmount + newTotalTax + fbrPosFee));

  console.log(`Old Subtotal (WOST): ${order.subtotal}  =>  New Subtotal: ${newSubtotal}`);
  console.log(`Old Discount: ${order.discountAmount}  =>  New Discount: ${newDiscountAmount}`);
  console.log(`Old Tax: 0  =>  New Tax: ${newTotalTax}`);
  console.log(`Old Grand Total: ${oldGrandTotal}  =>  New Grand Total: ${newGrandTotal}`);
  
  if (Math.abs(oldGrandTotal - newGrandTotal) > 1) {
     console.log(`\n🚨 WARNING: Grand Total mismatch!`);
  } else {
     console.log(`\n✅ Grand Total matches perfectly! Customer payment is unaffected.`);
  }

  await app.close();
}

bootstrap();
