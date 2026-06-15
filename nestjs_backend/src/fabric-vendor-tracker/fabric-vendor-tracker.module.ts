import { Module } from '@nestjs/common';
import { FabricVendorTrackerService } from './fabric-vendor-tracker.service';
import { FabricVendorTrackerController } from './fabric-vendor-tracker.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StockLedgerModule } from '../warehouse/stock-ledger/stock-ledger.module';
import { BullModule } from '@nestjs/bull';
import { NotificationsModule } from '../notifications/notifications.module';
import { FabricVendorTrackerExportController } from './fabric-vendor-tracker-export.controller';
import { FabricVendorTrackerExportService } from './fabric-vendor-tracker-export.service';
import { FabricVendorTrackerExportProcessor } from './fabric-vendor-tracker-export.processor';

@Module({
  imports: [
    PrismaModule,
    StockLedgerModule,
    NotificationsModule,
    BullModule.registerQueue({
      name: 'fabric-vendor-tracker-export',
    }),
  ],
  controllers: [
    FabricVendorTrackerController,
    FabricVendorTrackerExportController,
  ],
  providers: [
    FabricVendorTrackerService,
    FabricVendorTrackerExportService,
    FabricVendorTrackerExportProcessor,
  ],
  exports: [
    FabricVendorTrackerService,
    FabricVendorTrackerExportService,
  ],
})
export class FabricVendorTrackerModule {}
