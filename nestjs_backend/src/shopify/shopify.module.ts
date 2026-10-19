import { Module } from '@nestjs/common';
import { ShopifyService } from './shopify.service';
import { ShopifyWebhookController } from './shopify-webhook.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ShopifyWebhookController],
  providers: [ShopifyService],
  exports: [ShopifyService], // Export so VoucherService (PosConfigModule) can use it
})
export class ShopifyModule {}

