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
import { PosSalesExportService } from './pos-sales-export.service';

@ApiTags('POS Sales Export')
@Controller('api/pos-sales/export')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class PosSalesExportController {
  constructor(private readonly exportService: PosSalesExportService) {}

  /**
   * POST /api/pos-sales/export
   * Queues a background export job. Returns immediately with a jobId.
   * User receives an in-app notification when the file is ready.
   */
  @Post()
  @Permissions('pos.dashboard.view')
  @ApiOperation({ summary: 'Queue a POS sales export job (returns immediately, notifies when done)' })
  async queueExport(
    @Req() req: any,
    @Query('startDate')     startDate?: string,
    @Query('endDate')       endDate?: string,
    @Query('locationId')    locationId?: string,
    @Query('cashierUserId') cashierUserId?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('status')        status?: string,
    @Query('search')        search?: string,
  ) {
    // Determine effective location context (similar to reports/sales)
    let effectiveLocationId = locationId;
    if (!effectiveLocationId) {
      if (req.user?.isPosUser || req.user?.isTerminal) {
        effectiveLocationId = req.user.locationId;
      } else if (req.user?.locationId) {
        effectiveLocationId = req.user.locationId;
      }
    }

    const result = await this.exportService.queueExport({
      userId: req.user?.userId || req.user?.id,
      startDate,
      endDate,
      locationId: effectiveLocationId,
      cashierUserId,
      paymentMethod,
      status,
      search,
    });

    return {
      status: true,
      message: "Export queued. You'll receive a notification when your file is ready.",
      data: result,
    };
  }

  /**
   * GET /api/pos-sales/export/:jobId/status
   */
  @Get(':jobId/status')
  @Permissions('pos.dashboard.view')
  @ApiOperation({ summary: 'Check POS sales export job status' })
  async getStatus(@Param('jobId') jobId: string) {
    const result = await this.exportService.getJobStatus(jobId);
    return { status: true, data: result };
  }

  /**
   * GET /api/pos-sales/export/:jobId/download
   * Streams the completed Excel file. Auto-deletes after download.
   */
  @Get(':jobId/download')
  @Permissions('pos.dashboard.view')
  @ApiOperation({ summary: 'Download a completed POS sales export file' })
  async download(@Param('jobId') jobId: string, @Res() res: any) {
    try {
      await this.exportService.streamExportFile(jobId, res);
    } catch (err: any) {
      const status = err?.status ?? 404;
      res.status(status).send({ status: false, message: err?.message ?? 'Export file not found' });
    }
  }
}
