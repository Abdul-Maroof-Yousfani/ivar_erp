import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PurchaseInvoiceController } from './purchase-invoice.controller';
import { PurchaseInvoiceService } from './purchase-invoice.service';
import { DirectPiBulkUploadController } from './direct-pi-bulk-upload.controller';
import { DirectPiBulkUploadService } from './direct-pi-bulk-upload.service';
import { DirectPiUploadProcessor } from '../../queue/processors/direct-pi-upload.processor';
import { DirectPiCsvParserService } from '../../common/services/direct-pi-csv-parser.service';
import { DirectPiValidatorService } from '../../common/services/direct-pi-validator.service';
import { UploadEventsService } from '../../finance/item/upload-events.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { DatabaseModule } from '../../database/database.module';
import { AccountingModule } from '../../finance/accounting/accounting.module';
import { StockLedgerModule } from '../../warehouse/stock-ledger/stock-ledger.module';
import { FinanceAccountConfigModule } from '../../finance/finance-account-config/finance-account-config.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { ActivityLogsModule } from '../../activity-logs/activity-logs.module';

@Module({
  imports: [
    PrismaModule,
    DatabaseModule,
    AccountingModule,
    StockLedgerModule,
    FinanceAccountConfigModule,
    NotificationsModule,
    ActivityLogsModule,
    BullModule.registerQueue({ name: 'direct-pi-upload' }),
  ],
  controllers: [PurchaseInvoiceController, DirectPiBulkUploadController],
  providers: [
    PurchaseInvoiceService,
    DirectPiBulkUploadService,
    DirectPiUploadProcessor,
    DirectPiCsvParserService,
    DirectPiValidatorService,
    UploadEventsService,
  ],
  exports: [PurchaseInvoiceService, DirectPiBulkUploadService],
})
export class PurchaseInvoiceModule {}