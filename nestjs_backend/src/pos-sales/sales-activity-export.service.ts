import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../database/prisma.service';

export interface QueueSalesActivityExportOptions {
  userId: string;
  startDate?: string;
  endDate?: string;
  activityType?: string;
  locationId?: string;
  posId?: string;
  search?: string;
  merchantId?: string;
  paymentMethod?: string;
}

@Injectable()
export class SalesActivityExportService {
  private readonly logger = new Logger(SalesActivityExportService.name);

  constructor(
    @InjectQueue('sales-activity-export') private readonly exportQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async queueExport(opts: QueueSalesActivityExportOptions): Promise<{ jobId: string }> {
    const jobId = uuidv4();

    // Read tenant credentials from the live request context
    const tenantId    = this.prisma.getTenantId()    ?? '';
    const tenantDbUrl = this.prisma.getTenantDbUrl() ?? '';

    await this.exportQueue.add(
      {
        jobId,
        userId: opts.userId,
        tenantId,
        tenantDbUrl,
        startDate: opts.startDate,
        endDate: opts.endDate,
        activityType: opts.activityType,
        locationId: opts.locationId,
        posId: opts.posId,
        search: opts.search,
        merchantId: opts.merchantId,
        paymentMethod: opts.paymentMethod,
      },
      {
        jobId,
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
        timeout: 2 * 60 * 60 * 1000,
      },
    );

    this.logger.log(`[SalesActivityExport] Queued job ${jobId} for user ${opts.userId} (tenant: ${tenantId})`);
    return { jobId };
  }

  async getJobStatus(jobId: string): Promise<{ state: string; progress: number }> {
    const job = await this.exportQueue.getJob(jobId);
    if (!job) throw new NotFoundException(`Export job ${jobId} not found`);
    const state    = await job.getState();
    const progress = typeof job.progress() === 'number' ? (job.progress() as number) : 0;
    return { state, progress };
  }

  async streamExportFile(jobId: string, res: any): Promise<void> {
    const record = await this.prisma.exportHistory.findUnique({
      where: { id: jobId },
      select: { fileName: true, filePath: true },
    });

    let targetPath = record?.filePath || path.join('uploads', 'exports', `export-${jobId}.xlsx`);
    let finalFileName = record?.fileName || `sales-activity-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

    let filePath = path.isAbsolute(targetPath)
      ? targetPath
      : path.join(process.cwd(), targetPath);

    if (!fs.existsSync(filePath)) {
      const cleanRelPath = targetPath.replace(/^[/\\]+/, '');
      const altPath = path.join(process.cwd(), cleanRelPath);
      if (fs.existsSync(altPath)) {
        filePath = altPath;
      } else {
        const publicPath = path.join(process.cwd(), 'public', cleanRelPath);
        if (fs.existsSync(publicPath)) {
          filePath = publicPath;
        }
      }
    }

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Export file not found. It may have expired or the job is still running.');
    }

    const stat = fs.statSync(filePath);
    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      this.logger.error(`[SalesActivityExport] Stream error: ${err.message}`);
    });

    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', `attachment; filename="${finalFileName}"`);
    res.header('Content-Length', stat.size);
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(stream);
  }
}
