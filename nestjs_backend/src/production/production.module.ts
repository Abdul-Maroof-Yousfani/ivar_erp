import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StockLedgerModule } from '../warehouse/stock-ledger/stock-ledger.module';
import { PurchaseInvoiceModule } from '../purchase/purchase-invoice/purchase-invoice.module';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';

@Module({
  imports: [
    PrismaModule,
    StockLedgerModule,
    PurchaseInvoiceModule,
  ],
  controllers: [ProductionController],
  providers: [ProductionService],
  exports: [ProductionService],
})
export class ProductionModule {}

