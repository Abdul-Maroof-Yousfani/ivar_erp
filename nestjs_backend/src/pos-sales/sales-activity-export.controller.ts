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
import { SalesActivityExportService } from './sales-activity-export.service';

@ApiTags('POS Sales Activity Export')
@Controller('api/pos-sales/activity/export')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class SalesActivityExportController {
  constructor(private readonly exportService: SalesActivityExportService) {}

  /**
   * POST /api/pos-sales/activity/export
   * Queues a background sales activity export job. Returns immediately with a jobId.
   */
  @Post()
  @Permissions('pos.sales.history.view')
  @ApiOperation({ summary: 'Queue a POS sales activity export job' })
  async queueExport(
    @Req() req: any,
    @Query('startDate')    startDate?: string,
    @Query('endDate')      endDate?: string,
    @Query('activityType') activityType?: string,
    @Query('locationId')   locationId?: string,
    @Query('posId')        posId?: string,
    @Query('search')       search?: string,
    @Query('merchantId')   merchantId?: string,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    let effectiveLocationId = locationId;
    if (!effectiveLocationId) {
      if (req.user?.isPosUser || req.user?.isTerminal) {
        effectiveLocationId = req.user.locationId;
      }
    }

    const result = await this.exportService.queueExport({
      userId: req.user?.userId || req.user?.id,
      startDate,
      endDate,
      activityType,
      locationId: effectiveLocationId,
      posId,
      search,
      merchantId,
      paymentMethod,
    });

    return {
      status: true,
      message: "Sales activity export queued. You'll receive a notification when your file is ready.",
      data: result,
    };
  }

  /**
   * GET /api/pos-sales/activity/export/:jobId/status
   */
  @Get(':jobId/status')
  @Permissions('pos.sales.history.view')
  @ApiOperation({ summary: 'Check sales activity export job status' })
  async getStatus(@Param('jobId') jobId: string) {
    const result = await this.exportService.getJobStatus(jobId);
    return { status: true, data: result };
  }

  /**
   * GET /api/pos-sales/activity/export/:jobId/download
   * Streams the completed Excel file. Auto-deletes after download.
   */
  @Get(':jobId/download')
  @Permissions('pos.sales.history.view')
  @ApiOperation({ summary: 'Download a completed sales activity export file' })
  async download(@Param('jobId') jobId: string, @Res() res: any) {
    try {
      await this.exportService.streamExportFile(jobId, res);
    } catch (err: any) {
      const status = err?.status ?? 404;
      res.status(status).send({ status: false, message: err?.message ?? 'Export file not found' });
    }
  }
}
