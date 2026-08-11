import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PosSalesController } from './pos-sales.controller';
import { PosSalesService } from './pos-sales.service';
import { SalesHistoryBulkUploadController } from './sales-history-bulk-upload.controller';
import { SalesHistoryBulkUploadService } from './sales-history-bulk-upload.service';
import { SalesHistoryUploadProcessor } from '../queue/processors/sales-history-upload.processor';
import { SalesHistoryCsvParserService } from '../common/services/sales-history-csv-parser.service';
import { SalesHistoryValidatorService } from '../common/services/sales-history-validator.service';
import { OnlineSalesBulkUploadController } from './online-sales-bulk-upload.controller';
import { OnlineSalesBulkUploadService } from './online-sales-bulk-upload.service';
import { OnlineSalesUploadProcessor } from '../queue/processors/online-sales-upload.processor';
import { OnlineSalesCsvParserService } from '../common/services/online-sales-csv-parser.service';
import { OnlineSalesValidatorService } from '../common/services/online-sales-validator.service';
import { UploadEventsService } from '../finance/item/upload-events.service';
import { DatabaseModule } from '../database/database.module';
import { StockLedgerModule } from '../warehouse/stock-ledger/stock-ledger.module';
import { FbrService } from './fbr.service';
import { CustomerModule } from '../sales/customer/customer.module';
import { PosConfigModule } from '../pos-config/pos-config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ExportHistoryModule } from '../warehouse/export-history/export-history.module';
import { UploadModule } from '../upload/upload.module';
import { NetSalesSummaryExportService } from './net-sales-summary-export.service';
import { NetSalesSummaryExportProcessor } from './net-sales-summary-export.processor';
import { SalesRegisterExportService } from './sales-register-export.service';
import { SalesRegisterExportProcessor } from './sales-register-export.processor';
import { PosSalesExportService } from './pos-sales-export.service';
import { PosSalesExportProcessor } from './pos-sales-export.processor';
import { PosSalesExportController } from './pos-sales-export.controller';
import { SalesActivityExportService } from './sales-activity-export.service';
import { SalesActivityExportProcessor } from './sales-activity-export.processor';
import { SalesActivityExportController } from './sales-activity-export.controller';
import { WarehouseModule } from '../warehouse/warehouse.module';

@Module({
    imports: [
        DatabaseModule,
        StockLedgerModule,
        WarehouseModule,
        CustomerModule,
        PosConfigModule,
        NotificationsModule,
        ExportHistoryModule,
        UploadModule,
        BullModule.registerQueue(
            { name: 'sales-history-upload' },
            { name: 'online-sales-upload' },
            { name: 'net-sales-summary-export' },
            { name: 'sales-register-export' },
            { name: 'pos-sales-export' },
            { name: 'sales-activity-export' },
        ),
    ],
    controllers: [
        PosSalesController,
        SalesHistoryBulkUploadController,
        OnlineSalesBulkUploadController,
        PosSalesExportController,
        SalesActivityExportController,
    ],
    providers: [
        PosSalesService,
        FbrService,
        SalesHistoryBulkUploadService,
        SalesHistoryUploadProcessor,
        SalesHistoryCsvParserService,
        SalesHistoryValidatorService,
        OnlineSalesBulkUploadService,
        OnlineSalesUploadProcessor,
        OnlineSalesCsvParserService,
        OnlineSalesValidatorService,
        UploadEventsService,
        NetSalesSummaryExportService,
        NetSalesSummaryExportProcessor,
        SalesRegisterExportService,
        SalesRegisterExportProcessor,
        PosSalesExportService,
        PosSalesExportProcessor,
        SalesActivityExportService,
        SalesActivityExportProcessor,
    ],
    exports: [
        PosSalesService,
        NetSalesSummaryExportService,
        SalesRegisterExportService,
        PosSalesExportService,
        SalesActivityExportService,
        OnlineSalesBulkUploadService,
    ],
})
export class PosSalesModule { }


