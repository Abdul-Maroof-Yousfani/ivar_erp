import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { UploadEventsService } from '../../finance/item/upload-events.service';
import * as fs from 'fs';
import * as path from 'path';

export interface DirectPiUploadMetadata {
    vendorId?: string;
    warehouseId?: string;
    invoiceDate?: string;
    notes?: string;
}

@Injectable()
export class DirectPiBulkUploadService {
    private readonly logger = new Logger(DirectPiBulkUploadService.name);

    constructor(
        @InjectQueue('direct-pi-upload') private uploadQueue: Queue,
        private prisma: PrismaService,
        private eventsService: UploadEventsService,
    ) { }

    async initiateValidation(
        fileBuffer: Buffer,
        filename: string,
        userId: string,
        metadata?: DirectPiUploadMetadata,
    ): Promise<{ uploadId: string; jobId: string }> {
        const tempJobId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const upload = await this.prisma.bulkUpload.create({
            data: {
                jobId: tempJobId,
                filename,
                totalRecords: 0,
                uploadedBy: userId,
                status: 'validating',
            },
        });

        const uploadDir = path.join(process.cwd(), 'uploads', 'bulk', 'direct-pi');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const ext = filename.split('.').pop();
        const filePath = path.join(uploadDir, `direct-pi-upload-${upload.id}.${ext}`);
        fs.writeFileSync(filePath, fileBuffer);

        const job = await this.uploadQueue.add(
            {
                uploadId: upload.id,
                fileBuffer,
                filename,
                userId,
                tenantId: this.prisma.getTenantId() || '',
                tenantDbUrl: this.prisma.getTenantDbUrl() || '',
                mode: 'validate',
                metadata,
            } as any,
            { removeOnComplete: false, removeOnFail: false }
        );

        const uniqueJobId = `${upload.id}:${job.id}`;
        await this.prisma.bulkUpload.update({
            where: { id: upload.id },
            data: { jobId: uniqueJobId },
        });

        this.logger.log(`Direct PI validation initiated: ${upload.id} (Job: ${job.id})`);
        return { uploadId: upload.id, jobId: uniqueJobId };
    }

    async confirmUpload(
        uploadId: string,
        userId: string,
        metadata?: DirectPiUploadMetadata,
    ): Promise<{ uploadId: string; jobId: string }> {
        const upload = await this.prisma.bulkUpload.findUnique({ where: { id: uploadId } });
        if (!upload) throw new NotFoundException(`Upload ${uploadId} not found`);

        if (['processing', 'pending', 'completed'].includes(upload.status)) {
            return { uploadId: upload.id, jobId: upload.jobId };
        }

        if (upload.status !== 'validated') {
            throw new Error(`Upload must be in 'validated' status to confirm (current: ${upload.status})`);
        }

        this.eventsService.emit({
            uploadId,
            type: 'status',
            data: { status: 'pending', message: 'Import confirmation received...' },
        });

        await this.prisma.bulkUpload.update({
            where: { id: uploadId },
            data: { status: 'pending', message: 'Confirming upload...' },
        });

        const job = await this.uploadQueue.add(
            {
                uploadId: upload.id,
                filename: upload.filename,
                userId,
                tenantId: this.prisma.getTenantId() || '',
                tenantDbUrl: this.prisma.getTenantDbUrl() || '',
                mode: 'import',
                metadata,
            } as any,
            { removeOnComplete: false, removeOnFail: false }
        );

        const uniqueJobId = `${upload.id}:${job.id}`;
        await this.prisma.bulkUpload.update({
            where: { id: upload.id },
            data: { jobId: uniqueJobId },
        });

        this.logger.log(`Direct PI import confirmed: ${upload.id} (Job: ${job.id})`);
        return { uploadId, jobId: uniqueJobId };
    }

    async getUploadStatus(uploadId: string) {
        const upload = await this.prisma.bulkUpload.findUnique({ where: { id: uploadId } });
        if (!upload) throw new NotFoundException(`Upload ${uploadId} not found`);

        let jobProgress = 0;
        let jobState = 'unknown';
        try {
            const bullJobId = upload.jobId.includes(':')
                ? upload.jobId.split(':').slice(1).join(':')
                : upload.jobId;
            const job = await this.uploadQueue.getJob(bullJobId);
            if (job) {
                jobProgress = await job.progress();
                jobState = await job.getState();
            }
        } catch (error: any) {
            this.logger.warn(`Failed to get job status: ${error.message}`);
        }

        return {
            uploadId: upload.id,
            filename: upload.filename,
            status: upload.status,
            totalRecords: upload.totalRecords,
            processedRecords: upload.processedRecords,
            successRecords: upload.successRecords,
            failedRecords: upload.failedRecords,
            skippedRecords: upload.skippedRecords,
            progress: jobProgress,
            jobState,
            errors: upload.errors,
            message: upload.message,
            createdAt: upload.createdAt,
            completedAt: upload.completedAt,
        };
    }

    async cancelUpload(uploadId: string): Promise<void> {
        const upload = await this.prisma.bulkUpload.findUnique({ where: { id: uploadId } });
        if (!upload) throw new NotFoundException(`Upload ${uploadId} not found`);

        try {
            const bullJobId = upload.jobId.includes(':')
                ? upload.jobId.split(':').slice(1).join(':')
                : upload.jobId;
            const job = await this.uploadQueue.getJob(bullJobId);
            if (job) await job.remove();
        } catch (e) {
            // non-fatal
        }

        await this.prisma.bulkUpload.update({
            where: { id: uploadId },
            data: { status: 'cancelled', completedAt: new Date() },
        });
    }

    generateErrorReport(errors: any[]): string {
        if (!errors?.length) return 'Row,Field,Reason,Value\n';
        let csv = 'Row,Field,Reason,Value\n';
        errors.forEach(e => {
            const row = e.row || 'N/A';
            const field = e.field || e.data?.field || 'N/A';
            const reason = (e.reason || '').replace(/"/g, '""');
            const val = (e.value !== undefined ? String(e.value) : (e.data?.value !== undefined ? String(e.data?.value) : '')).replace(/"/g, '""');
            csv += `${row},${field},"${reason}","${val}"\n`;
        });
        return csv;
    }
}
