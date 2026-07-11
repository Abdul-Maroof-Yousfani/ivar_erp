import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { UploadEventsService } from '../../finance/item/upload-events.service';
import { TransferCsvParserService, TransferParsedRecord } from './transfer-csv-parser.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TransferBulkUploadService {
    private readonly logger = new Logger(TransferBulkUploadService.name);

    constructor(
        @InjectQueue('transfer-upload') private uploadQueue: Queue,
        private prisma: PrismaService,
        private eventsService: UploadEventsService,
        private csvParser: TransferCsvParserService,
    ) { }

    async initiateValidation(
        fileBuffer: Buffer,
        filename: string,
        userId: string,
    ): Promise<{ uploadId: string; jobId: string }> {
        const tempJobId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const upload = await this.prisma.bulkUpload.create({
            data: { jobId: tempJobId, filename, totalRecords: 0, uploadedBy: userId, status: 'validating' },
        });

        const uploadDir = path.join(process.cwd(), 'uploads', 'bulk', 'transfer');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const ext = filename.split('.').pop();
        fs.writeFileSync(path.join(uploadDir, `transfer-upload-${upload.id}.${ext}`), fileBuffer);

        const job = await this.uploadQueue.add({
            uploadId: upload.id, fileBuffer, filename, userId,
            tenantId: this.prisma.getTenantId() || '',
            tenantDbUrl: this.prisma.getTenantDbUrl() || '',
            mode: 'validate',
            uploadType: 'transfer',
        } as any, { removeOnComplete: false, removeOnFail: false });

        await this.prisma.bulkUpload.update({ where: { id: upload.id }, data: { jobId: String(job.id) } });
        return { uploadId: upload.id, jobId: String(job.id) };
    }

    async confirmUpload(
        uploadId: string,
        userId: string,
    ): Promise<{ uploadId: string; jobId: string }> {
        const upload = await this.prisma.bulkUpload.findUnique({ where: { id: uploadId } });
        if (!upload) throw new NotFoundException(`Upload ${uploadId} not found`);
        if (['processing', 'pending', 'completed'].includes(upload.status)) return { uploadId: upload.id, jobId: upload.jobId };
        if (upload.status !== 'validated') throw new Error(`Upload must be 'validated' to confirm (current: ${upload.status})`);

        this.eventsService.emit({ uploadId, type: 'status', data: { status: 'pending', message: 'Import confirmation received...' } });
        await this.prisma.bulkUpload.update({ where: { id: uploadId }, data: { status: 'pending', message: 'Confirming upload...' } });

        const job = await this.uploadQueue.add({
            uploadId: upload.id, filename: upload.filename, userId,
            tenantId: this.prisma.getTenantId() || '',
            tenantDbUrl: this.prisma.getTenantDbUrl() || '',
            mode: 'import',
            uploadType: 'transfer',
        } as any, { removeOnComplete: false, removeOnFail: false });

        await this.prisma.bulkUpload.update({ where: { id: upload.id }, data: { jobId: String(job.id) } });
        return { uploadId, jobId: String(job.id) };
    }

    async getUploadStatus(uploadId: string) {
        const upload = await this.prisma.bulkUpload.findUnique({ where: { id: uploadId } });
        if (!upload) throw new NotFoundException(`Upload ${uploadId} not found`);

        let jobProgress = 0, jobState = 'unknown';
        try {
            const job = await this.uploadQueue.getJob(upload.jobId);
            if (job) { jobProgress = await job.progress(); jobState = await job.getState(); }
        } catch (e) { this.logger.warn(`Failed to get job status: ${e.message}`); }

        return {
            uploadId: upload.id, filename: upload.filename, status: upload.status,
            totalRecords: upload.totalRecords, processedRecords: upload.processedRecords,
            successRecords: upload.successRecords, failedRecords: upload.failedRecords,
            skippedRecords: upload.skippedRecords, progress: jobProgress, jobState,
            errors: upload.errors, message: upload.message,
            createdAt: upload.createdAt, completedAt: upload.completedAt,
        };
    }

    async cancelUpload(uploadId: string): Promise<void> {
        const upload = await this.prisma.bulkUpload.findUnique({ where: { id: uploadId } });
        if (!upload) throw new NotFoundException(`Upload ${uploadId} not found`);
        try { const job = await this.uploadQueue.getJob(upload.jobId); if (job) await job.remove(); } catch (e) { }
        await this.prisma.bulkUpload.update({ where: { id: uploadId }, data: { status: 'cancelled', completedAt: new Date() } });
    }

    generateErrorReport(errors: any[]): string {
        if (!errors?.length) return 'No errors found';
        let csv = 'Row,Field,Reason,Value\n';
        errors.forEach(e => {
            csv += `${e.row || 'N/A'},${e.field || e.data?.field || 'N/A'},"${(e.reason || '').replace(/"/g, '""')}",${e.value || e.data?.value || 'N/A'}\n`;
        });
        return csv;
    }

    async resolveItems(uploadId: string, warehouseId: string, locationId?: string) {
        const upload = await this.prisma.bulkUpload.findUnique({ where: { id: uploadId } });
        if (!upload) throw new NotFoundException(`Upload ${uploadId} not found`);

        const ext = upload.filename.split('.').pop();
        const filePath = path.join(process.cwd(), 'uploads', 'bulk', 'transfer', `transfer-upload-${uploadId}.${ext}`);
        if (!fs.existsSync(filePath)) {
            throw new NotFoundException(`Uploaded file not found on disk`);
        }

        const fileBuffer = fs.readFileSync(filePath);
        const parsedRecords: TransferParsedRecord[] = [];

        await this.csvParser.parseFileStreaming(fileBuffer, upload.filename, async (record) => {
            parsedRecords.push(record);
        });

        const validationErrors = (Array.isArray(upload.errors) ? upload.errors : []) as any[];
        const invalidRows = new Set(validationErrors.map(e => e.row));

        // Skip rows with validation errors
        const validRecords = parsedRecords.filter(r => !invalidRows.has(r.row));

        // Collect unique barcodes & skus
        const barcodes = [...new Set(validRecords.map(r => r.data.barCode?.trim()).filter(Boolean) as string[])];
        const skus = [...new Set(validRecords.map(r => r.data.sku?.trim()).filter(Boolean) as string[])];

        const dbItems = await this.prisma.item.findMany({
            where: {
                OR: [
                    barcodes.length > 0 ? { barCode: { in: barcodes } } : undefined,
                    skus.length > 0 ? { sku: { in: skus } } : undefined,
                ].filter(Boolean) as any,
                isActive: true,
            },
            select: {
                id: true,
                sku: true,
                barCode: true,
                description: true,
                color: { select: { id: true, name: true } },
                size: { select: { id: true, name: true } },
            },
        });

        const itemIds = dbItems.map(i => i.id);
        let stockMap = new Map<string, number>();

        if (locationId && locationId !== 'unassigned') {
            // Outlet stock: use InventoryItem directly
            const inventoryItems = await this.prisma.inventoryItem.findMany({
                where: {
                    itemId: { in: itemIds },
                    locationId,
                    status: 'AVAILABLE',
                },
                select: { itemId: true, quantity: true },
            });
            stockMap = new Map(
                inventoryItems.map((inv) => [inv.itemId, Number(inv.quantity)]),
            );
        } else if (warehouseId) {
            // Warehouse stock: use StockLedger
            const stockEntries = await this.prisma.stockLedger.groupBy({
                by: ['itemId'],
                where: {
                    itemId: { in: itemIds },
                    warehouseId,
                    locationId: null,
                },
                _sum: { qty: true },
            });
            stockMap = new Map(
                stockEntries.map((a) => [a.itemId, Number(a._sum.qty) || 0]),
            );
        }

        // Map parsed rows to items
        const resolvedList: any[] = [];
        for (const record of validRecords) {
            const barCode = record.data.barCode?.trim().toLowerCase();
            const sku = record.data.sku?.trim().toLowerCase();

            const item = dbItems.find(i =>
                (barCode && i.barCode?.trim().toLowerCase() === barCode) ||
                (sku && i.sku?.trim().toLowerCase() === sku)
            );

            if (item) {
                const availableStock = stockMap.get(item.id) || 0;
                resolvedList.push({
                    id: item.id,
                    sku: item.sku,
                    description: item.description,
                    color: item.color?.name,
                    size: item.size?.name,
                    quantity: record.data.quantity || 1,
                    notes: '',
                    availableStock,
                });
            }
        }

        return resolvedList;
    }
}
