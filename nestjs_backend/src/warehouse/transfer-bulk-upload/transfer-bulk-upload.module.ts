import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TransferBulkUploadController } from './transfer-bulk-upload.controller';
import { TransferBulkUploadService } from './transfer-bulk-upload.service';
import { TransferUploadProcessor } from './transfer-upload.processor';
import { TransferCsvParserService } from './transfer-csv-parser.service';
import { TransferValidatorService } from './transfer-validator.service';
import { UploadEventsService } from '../../finance/item/upload-events.service';
import { DatabaseModule } from '../../database/database.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
    imports: [
        DatabaseModule,
        NotificationsModule,
        BullModule.registerQueue({ name: 'transfer-upload' }),
    ],
    controllers: [TransferBulkUploadController],
    providers: [
        TransferBulkUploadService,
        TransferUploadProcessor,
        TransferCsvParserService,
        TransferValidatorService,
        UploadEventsService,
    ],
    exports: [TransferBulkUploadService],
})
export class TransferBulkUploadModule { }
