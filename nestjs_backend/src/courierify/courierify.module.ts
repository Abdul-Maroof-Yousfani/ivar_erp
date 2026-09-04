import { Module } from '@nestjs/common';
import { CourierifyService } from './courierify.service';
import { CourierifyController } from './courierify.controller';
import { CourierifyWebhookController } from './courierify-webhook.controller';
import { DatabaseModule } from '../database/database.module';
import { StockLedgerModule } from '../warehouse/stock-ledger/stock-ledger.module';
import { PosSalesModule } from '../pos-sales/pos-sales.module';

@Module({
  imports: [DatabaseModule, StockLedgerModule, PosSalesModule],
  controllers: [CourierifyController, CourierifyWebhookController],
  providers: [CourierifyService],
  exports: [CourierifyService],
})
export class CourierifyModule {}
