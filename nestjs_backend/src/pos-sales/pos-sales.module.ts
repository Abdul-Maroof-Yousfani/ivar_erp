import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PosSalesController } from './pos-sales.controller';
import { PosSalesService } from './pos-sales.service';
import { SalesHistoryBulkUploadController } from './sales-history-bulk-upload.controller';
import { SalesHistoryBulkUploadService } from './sales-history-bulk-upload.service';
import { SalesHistoryUploadProcessor } from '../queue/processors/sales-history-upload.processor';
import { SalesHistoryCsvParserService } from '../common/services/sales-history-csv-parser.service';
import { SalesHistoryValidatorService } from '../common/services/sales-history-validator.service';
import { UploadEventsService } from '../finance/item/upload-events.service';
import { DatabaseModule } from '../database/database.module';
import { StockLedgerModule } from '../warehouse/stock-ledger/stock-ledger.module';
import { FbrService } from './fbr.service';
import { CustomerModule } from '../sales/customer/customer.module';
import { PosConfigModule } from '../pos-config/pos-config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PosSalesExportController } from './pos-sales-export.controller';
import { PosSalesExportService } from './pos-sales-export.service';
import { PosSalesExportProcessor } from './pos-sales-export.processor';

@Module({
    imports: [
        DatabaseModule,
        StockLedgerModule,
        CustomerModule,
        PosConfigModule,
        NotificationsModule,
        BullModule.registerQueue(
            { name: 'sales-history-upload' },
            { name: 'pos-sales-export' }
        ),
    ],
    controllers: [
        PosSalesController,
        SalesHistoryBulkUploadController,
        PosSalesExportController
    ],
    providers: [
        PosSalesService,
        FbrService,
        SalesHistoryBulkUploadService,
        SalesHistoryUploadProcessor,
        SalesHistoryCsvParserService,
        SalesHistoryValidatorService,
        UploadEventsService,
        PosSalesExportService,
        PosSalesExportProcessor,
    ],
    exports: [PosSalesService],
})
export class PosSalesModule { }

