import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { TransferCsvParserService, TransferParsedRecord } from './transfer-csv-parser.service';
import { TransferValidatorService } from './transfer-validator.service';
import { UploadEventsService } from '../../finance/item/upload-events.service';
import { NotificationsService } from '../../notifications/notifications.service';
import * as fs from 'fs';
import * as path from 'path';

interface TransferUploadProgress {
    totalRecords: number;
    processedRecords: number;
    successRecords: number;
    failedRecords: number;
    skippedRecords: number;
    errors: Array<{ row: number; reason: string; data: any }>;
}

@Processor('transfer-upload')
export class TransferUploadProcessor {
    private readonly logger = new Logger(TransferUploadProcessor.name);

    constructor(
        private readonly csvParser: TransferCsvParserService,
        private readonly validator: TransferValidatorService,
        private readonly eventsService: UploadEventsService,
        private readonly notificationsService: NotificationsService,
    ) { }

    @Process()
    async handleUpload(job: Job<any>): Promise<void> {
        let { uploadId, fileBuffer, filename, userId, tenantId, tenantDbUrl, mode } = job.data;
        mode = mode || 'import';

        if (fileBuffer && (fileBuffer as any).type === 'Buffer' && Array.isArray((fileBuffer as any).data)) {
            fileBuffer = Buffer.from((fileBuffer as any).data);
        }

        if (!fileBuffer) {
            const ext = filename.split('.').pop();
            const filePath = path.join(process.cwd(), 'uploads', 'bulk', 'transfer', `transfer-upload-${uploadId}.${ext}`);
            if (fs.existsSync(filePath)) {
                fileBuffer = fs.readFileSync(filePath);
            } else {
                throw new Error(`File not found on disk at ${filePath}`);
            }
        }

        const prisma = new PrismaService({ tenantId, tenantDbUrl } as any);

        try {
            await prisma.bulkUpload.update({
                where: { id: uploadId },
                data: { status: mode === 'validate' ? 'validating' : 'processing' },
            });

            this.eventsService.emit({
                uploadId, type: 'status',
                data: {
                    status: mode === 'validate' ? 'validating' : 'processing',
                    message: mode === 'validate' ? 'Starting Stock Transfer Validation...' : 'Confirming Stock Transfer Import...'
                }
            });

            const progress: TransferUploadProgress = {
                totalRecords: 0, processedRecords: 0,
                successRecords: 0, failedRecords: 0, skippedRecords: 0, errors: [],
            };

            let totalRecordsCount = 0;
            let successRecordsCount = 0;
            let lastEmitTime = Date.now();

            if (mode === 'import') {
                // Import phase - since stock transfer items are resolved directly to the UI,
                // we simply mark the upload as completed.
                await job.progress(100);
                this.eventsService.emit({
                    uploadId, type: 'progress',
                    data: { progress: 100, processedRecords: 0, successRecords: 0, failedRecords: 0, status: 'completed' }
                });
            } else {
                // Validation mode
                this.eventsService.emit({ uploadId, type: 'status', data: { message: 'Streaming stock transfer validation...' } });

                const allParsedRecords: TransferParsedRecord[] = [];
                const allValidationErrors: any[] = [];

                await this.csvParser.parseFileStreaming(fileBuffer, filename, async (record) => {
                    totalRecordsCount++;
                    allParsedRecords.push(record);

                    const now = Date.now();
                    if (now - lastEmitTime > 2000) {
                        lastEmitTime = now;
                        await job.progress(10);
                        this.eventsService.emit({
                            uploadId, type: 'progress',
                            data: { progress: 10, status: 'validating', message: `Scanning transfer records: ${totalRecordsCount} rows...` }
                        });
                    }
                });

                // 1. Basic field-level validations
                const basicErrors = allParsedRecords.flatMap(r => this.validator.validateRecord(r));
                allValidationErrors.push(...basicErrors);

                // 2. Barcode & SKU existence checks against DB
                const barcodes = [...new Set(allParsedRecords.map(r => r.data.barCode?.trim()).filter(Boolean) as string[])];
                const skus = [...new Set(allParsedRecords.map(r => r.data.sku?.trim()).filter(Boolean) as string[])];

                const items = await prisma.item.findMany({
                    where: {
                        OR: [
                            barcodes.length > 0 ? { barCode: { in: barcodes } } : undefined,
                            skus.length > 0 ? { sku: { in: skus } } : undefined,
                        ].filter(Boolean) as any,
                    },
                    select: { id: true, barCode: true, sku: true },
                });

                const foundBarcodes = new Set(items.map((i: any) => i.barCode?.trim().toLowerCase()).filter(Boolean));
                const foundSkus = new Set(items.map((i: any) => i.sku?.trim().toLowerCase()).filter(Boolean));

                for (const record of allParsedRecords) {
                    const barCode = record.data.barCode?.trim().toLowerCase();
                    const sku = record.data.sku?.trim().toLowerCase();

                    let matched = false;
                    if (barCode && foundBarcodes.has(barCode)) matched = true;
                    if (sku && foundSkus.has(sku)) matched = true;

                    if (!matched) {
                        allValidationErrors.push({
                            row: record.row,
                            field: barCode ? 'barCode' : 'sku',
                            value: barCode || sku,
                            reason: `Item with Barcode/SKU "${barCode || sku}" not found in system.`,
                        });
                    }
                }

                const uniqueFailedRows = new Set(allValidationErrors.map(e => e.row)).size;
                successRecordsCount = totalRecordsCount - uniqueFailedRows;

                await prisma.bulkUpload.update({
                    where: { id: uploadId },
                    data: {
                        status: 'validated',
                        totalRecords: totalRecordsCount,
                        failedRecords: allValidationErrors.length,
                        successRecords: successRecordsCount,
                        errors: allValidationErrors as any,
                        message: `Validation complete: ${successRecordsCount} valid rows, ${allValidationErrors.length} invalid.`,
                        completedAt: new Date(),
                    },
                });

                await this.notificationsService.create({
                    userId, title: 'Transfer Validation Completed',
                    message: `Stock Transfer bulk validation finished: ${successRecordsCount} valid rows, ${allValidationErrors.length} invalid.`,
                    category: 'system', priority: 'normal', channels: ['inApp'],
                });

                await job.progress(100);
                this.eventsService.emit({
                    uploadId, type: 'completed',
                    data: { status: 'validated', totalRecords: totalRecordsCount, successRecords: successRecordsCount, failedRecords: allValidationErrors.length, errors: allValidationErrors, progress: 100 }
                });
                return;
            }

            await prisma.bulkUpload.update({
                where: { id: uploadId },
                data: { status: 'completed', message: `Stock Transfer resolution confirmed.`, completedAt: new Date() },
            });

            await this.notificationsService.create({
                userId, title: 'Transfer Import Completed',
                message: `Stock Transfer items confirmed.`,
                category: 'system', priority: 'high', channels: ['inApp'],
            });

            this.eventsService.emit({
                uploadId, type: 'completed',
                data: { status: 'completed', successRecords: totalRecordsCount, failedRecords: 0, progress: 100 }
            });

        } catch (error: any) {
            this.logger.error(`[Job ${job.id}] FAILED: ${error.message}`, error.stack);
            try {
                await prisma.bulkUpload.update({
                    where: { id: uploadId },
                    data: { status: 'failed', completedAt: new Date(), message: `Error: ${error.message}` },
                });
                await this.notificationsService.create({
                    userId, title: 'Transfer Bulk Job Failed',
                    message: `Stock Transfer job failed: ${error.message}`,
                    category: 'system', priority: 'urgent', channels: ['inApp'],
                });
                this.eventsService.emit({ uploadId, type: 'failed', data: { message: error.message } });
            } catch (e: any) {
                this.logger.error(`Failed to update failure status: ${e.message}`);
            }
        } finally {
            await prisma.$disconnect();
        }
    }
}
