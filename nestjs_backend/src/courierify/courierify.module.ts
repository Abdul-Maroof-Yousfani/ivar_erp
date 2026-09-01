import { Module } from '@nestjs/common';
import { CourierifyService } from './courierify.service';
import { CourierifyController } from './courierify.controller';
import { CourierifyWebhookController } from './courierify-webhook.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CourierifyController, CourierifyWebhookController],
  providers: [CourierifyService],
  exports: [CourierifyService],
})
export class CourierifyModule {}
