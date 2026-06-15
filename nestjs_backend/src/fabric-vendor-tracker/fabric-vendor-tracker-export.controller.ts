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
import { FabricVendorTrackerExportService } from './fabric-vendor-tracker-export.service';
import { FabricStatus } from '@prisma/client';

@ApiTags('Fabric Vendor Tracker Export')
@Controller('api/fabric-vendor-tracker/export')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@Permissions('erp.inventory.view')
export class FabricVendorTrackerExportController {
  constructor(private readonly exportService: FabricVendorTrackerExportService) {}

  /**
   * POST /api/fabric-vendor-tracker/export
   * Queues a background export job. Returns immediately with a jobId.
   * User receives an in-app notification when the file is ready.
   */
  @Post()
  @ApiOperation({ summary: 'Queue a fabric vendor tracker export job (returns immediately, notifies when done)' })
  async queueExport(
    @Req() req: any,
    @Query('supplierId') supplierId?: string,
    @Query('itemId') itemId?: string,
    @Query('status') status?: FabricStatus,
    @Query('search') search?: string,
  ) {
    const result = await this.exportService.queueExport({
      userId: req.user?.userId || req.user?.id,
      supplierId,
      itemId,
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
   * GET /api/fabric-vendor-tracker/export/:jobId/status
   */
  @Get(':jobId/status')
  @ApiOperation({ summary: 'Check fabric vendor tracker export job status' })
  async getStatus(@Param('jobId') jobId: string) {
    const result = await this.exportService.getJobStatus(jobId);
    return { status: true, data: result };
  }

  /**
   * GET /api/fabric-vendor-tracker/export/:jobId/download
   * Streams the completed Excel file. Auto-deletes after download.
   */
  @Get(':jobId/download')
  @ApiOperation({ summary: 'Download a completed fabric vendor tracker export file' })
  async download(@Param('jobId') jobId: string, @Res() res: any) {
    try {
      await this.exportService.streamExportFile(jobId, res);
    } catch (err: any) {
      const status = err?.status ?? 404;
      res.status(status).send({ status: false, message: err?.message ?? 'Export file not found' });
    }
  }
}
