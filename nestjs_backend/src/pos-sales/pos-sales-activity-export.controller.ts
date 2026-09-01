import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PosSalesActivityExportService } from './pos-sales-activity-export.service';
import * as jwt from 'jsonwebtoken';

@ApiTags('POS Sales Activity Export')
@Controller('api/pos-sales/activity/export')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class PosSalesActivityExportController {
  constructor(private readonly exportService: PosSalesActivityExportService) {}

  /**
   * POST /api/pos-sales/activity/export
   * Queues a background POS Sales Activity export job. Returns immediately with a jobId.
   */
  @Post()
  @Permissions('pos.sales.history.view')
  @ApiOperation({ summary: 'Queue a POS sales activity export job' })
  async queueExport(
    @Req() req: any,
    @Query('posId') posId?: string,
    @Query('activityType') activityType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('locationId') locationId?: string,
    @Query('merchantId') merchantId?: string,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    // Resolve effective location and POS filters
    let effectiveLocationId = locationId && locationId !== 'all' ? locationId : undefined;
    let effectivePosId = posId && posId !== 'all' ? posId : undefined;

    // Only restrict to user's location if it's explicitly a terminal/cashier user with no all-locations permission and no explicit location was provided
    if (!effectiveLocationId && req.user?.isPosUser && !req.user?.permissions?.includes('pos.reports.all_locations')) {
      effectiveLocationId = req.user.locationId;
      if (!effectivePosId && !search) {
        effectivePosId = req.user.posId || req.user.terminalId;
      }
    }

    const result = await this.exportService.queueExport({
      userId: req.user?.userId || req.user?.id,
      posId: effectivePosId,
      activityType: activityType === 'all' ? undefined : activityType,
      filters: { 
        startDate, 
        endDate, 
        search,
        merchantId: merchantId === 'all' ? undefined : merchantId,
        paymentMethod: paymentMethod === 'all' ? undefined : paymentMethod,
      },
      locationId: effectiveLocationId,
      merchantId: merchantId === 'all' ? undefined : merchantId,
      paymentMethod: paymentMethod === 'all' ? undefined : paymentMethod,
    });

    return {
      status: true,
      message: "Sales activity export queued. You'll receive a notification when your file is ready.",
      data: result,
    };
  }

  /**
   * GET /api/pos-sales/activities/export/:jobId/status
   */
  @Get(':jobId/status')
  @Permissions('pos.sales.history.view')
  @ApiOperation({ summary: 'Check POS sales activity export status' })
  async getStatus(@Param('jobId') jobId: string) {
    const result = await this.exportService.getJobStatus(jobId);
    return { status: true, data: result };
  }

  /**
   * GET /api/pos-sales/activities/export/:jobId/download
   */
  @Get(':jobId/download')
  @Permissions('pos.sales.history.view')
  @ApiOperation({ summary: 'Download completed POS sales activity export file' })
  async download(@Param('jobId') jobId: string, @Res() res: any) {
    try {
      await this.exportService.streamExportFile(jobId, res);
    } catch (err: any) {
      const status = err?.status ?? 404;
      res.status(status).send({ status: false, message: err?.message ?? 'Export file not found' });
    }
  }
}
