import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { DatabaseModule } from '../database/database.module';
import { CompanyModule } from '../admin/company/company.module';

import { MergnService } from './mergn.service';

/**
 * Module for DriveSafe integration features.
 * Provides server-to-server APIs for tenant and user provisioning.
 */
@Module({
  imports: [DatabaseModule, CompanyModule],
  controllers: [IntegrationController],
  providers: [IntegrationService, MergnService],
  exports: [IntegrationService, MergnService],
})
export class IntegrationModule {}
