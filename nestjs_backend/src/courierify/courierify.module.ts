import { Module } from '@nestjs/common';
import { CourierifyService } from './courierify.service';
import { CourierifyController } from './courierify.controller';
import { CourierifyWebhookController } from './courierify-webhook.controller';
import { DatabaseModule } from '../database/database.module';
import { PosSalesModule } from '../pos-sales/pos-sales.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { StockLedgerModule } from '../warehouse/stock-ledger/stock-ledger.module';
import { ShopifyModule } from '../shopify/shopify.module';

@Module({
  imports: [DatabaseModule, PosSalesModule, WarehouseModule, StockLedgerModule, ShopifyModule],
  controllers: [CourierifyController, CourierifyWebhookController],
  providers: [CourierifyService],
  exports: [CourierifyService],
})
export class CourierifyModule {}

