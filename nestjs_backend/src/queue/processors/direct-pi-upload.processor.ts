import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { DirectPiCsvParserService, DirectPiParsedRecord } from '../../common/services/direct-pi-csv-parser.service';
import { DirectPiValidatorService, DirectPiValidationError } from '../../common/services/direct-pi-validator.service';
import { UploadEventsService } from '../../finance/item/upload-events.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { Decimal } from '@prisma/client/runtime/client';
import * as fs from 'fs';
import * as path from 'path';

interface DirectPiUploadProgress {
    totalRecords: number;
    processedRecords: number;
    successRecords: number; // Invoices or rows created
    failedRecords: number;
    skippedRecords: number;
    errors: Array<{ row: number; reason: string; data: any }>;
}

@Processor('direct-pi-upload')
export class DirectPiUploadProcessor {
    private readonly logger = new Logger(DirectPiUploadProcessor.name);

    constructor(
        private readonly csvParser: DirectPiCsvParserService,
        private readonly validator: DirectPiValidatorService,
        private readonly eventsService: UploadEventsService,
        private readonly notificationsService: NotificationsService,
    ) { }

    @Process()
    async handleUpload(job: Job<any>): Promise<void> {
        let { uploadId, fileBuffer, filename, userId, tenantId, tenantDbUrl, mode, metadata } = job.data;
        mode = mode || 'import';

        if (fileBuffer && (fileBuffer as any).type === 'Buffer' && Array.isArray((fileBuffer as any).data)) {
            fileBuffer = Buffer.from((fileBuffer as any).data);
        }

        if (!fileBuffer) {
            const ext = filename.split('.').pop();
            const filePath = path.join(process.cwd(), 'uploads', 'bulk', 'direct-pi', `direct-pi-upload-${uploadId}.${ext}`);
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
                uploadId,
                type: 'status',
                data: {
                    status: mode === 'validate' ? 'validating' : 'processing',
                    message: mode === 'validate' ? 'Starting Direct PI validation...' : 'Starting Direct PI import...',
                },
            });

            const progress: DirectPiUploadProgress = {
                totalRecords: 0,
                processedRecords: 0,
                successRecords: 0,
                failedRecords: 0,
                skippedRecords: 0,
                errors: [],
            };

            let totalRecordsCount = 0;
            let lastEmitTime = Date.now();

            // ─────────────────────────────────────────────────────────────
            // IMPORT PHASE
            // ─────────────────────────────────────────────────────────────
            if (mode === 'import') {
                const uploadRecord = await prisma.bulkUpload.findUnique({
                    where: { id: uploadId },
                    select: { errors: true, totalRecords: true },
                });

                const allValidationErrors = (Array.isArray(uploadRecord?.errors) ? uploadRecord.errors : []) as any[];
                const invalidRows = new Set(allValidationErrors.map((e: any) => e.row));

                progress.totalRecords = uploadRecord?.totalRecords || 0;
                progress.failedRecords = invalidRows.size;
                progress.errors = allValidationErrors.map((e: any) => ({
                    row: e.row,
                    reason: e.reason || `${e.field}: ${e.reason}`,
                    data: { field: e.field, value: e.value },
                }));

                const validRecords: DirectPiParsedRecord[] = [];

                await this.csvParser.parseFileStreaming(fileBuffer, filename, async (record) => {
                    totalRecordsCount++;
                    if (!invalidRows.has(record.row)) {
                        validRecords.push(record);
                    }
                });

                if (validRecords.length === 0) {
                    throw new Error('No valid records to import');
                }

                try {
                    await this.importDirectInvoices(metadata, validRecords, progress, prisma, userId, uploadId, job);
                } catch (err: any) {
                    this.logger.error(`Failed to import Direct PIs: ${err.message}`, err.stack);
                    progress.failedRecords += validRecords.length;
                    progress.errors.push({ row: validRecords[0]?.row || 1, reason: err.message, data: {} });
                }

                await prisma.bulkUpload.update({
                    where: { id: uploadId },
                    data: {
                        status: 'completed',
                        processedRecords: progress.processedRecords,
                        successRecords: progress.successRecords,
                        failedRecords: progress.failedRecords,
                        errors: progress.errors as any,
                        message: `Direct PI import completed: ${progress.successRecords} invoices created (${validRecords.length} items).`,
                        completedAt: new Date(),
                    },
                });

                await this.notificationsService.create({
                    userId,
                    title: 'Direct Purchase Invoice Import Complete',
                    message: `Bulk import completed: ${progress.successRecords} Direct Purchase Invoices created with ${validRecords.length} items.`,
                    category: 'procurement',
                    priority: 'normal',
                    channels: ['inApp'],
                });

                await job.progress(100);
                this.eventsService.emit({
                    uploadId,
                    type: 'completed',
                    data: {
                        status: 'completed',
                        progress: 100,
                        processedRecords: progress.processedRecords,
                        successRecords: progress.successRecords,
                        failedRecords: progress.failedRecords,
                        totalRecords: progress.totalRecords,
                        message: 'Import completed successfully.',
                    },
                });

            // ─────────────────────────────────────────────────────────────
            // VALIDATE PHASE
            // ─────────────────────────────────────────────────────────────
            } else {
                this.eventsService.emit({
                    uploadId,
                    type: 'status',
                    data: { message: 'Scanning Direct PI records...' },
                });

                const allParsedRecords: DirectPiParsedRecord[] = [];
                const allValidationErrors: DirectPiValidationError[] = [];

                await this.csvParser.parseFileStreaming(fileBuffer, filename, async (record) => {
                    totalRecordsCount++;
                    allParsedRecords.push(record);

                    const now = Date.now();
                    if (now - lastEmitTime > 1500) {
                        lastEmitTime = now;
                        await job.progress(10);
                        this.eventsService.emit({
                            uploadId,
                            type: 'progress',
                            data: {
                                progress: 10,
                                status: 'validating',
                                message: `Scanning Direct PI records: ${totalRecordsCount} rows...`,
                            },
                        });
                    }
                });

                // 1. Field level validations
                const basicErrors = this.validator.validateRecords(allParsedRecords, metadata);
                allValidationErrors.push(...basicErrors);

                // 2. Database existence validations for items, suppliers, warehouses
                const invalidRowsFromBasic = new Set(basicErrors.map(e => e.row));
                const recordsToCheck = allParsedRecords.filter(r => !invalidRowsFromBasic.has(r.row));

                // A. Item lookup
                const identifiers = [
                    ...new Set(
                        recordsToCheck
                            .flatMap(r => [r.data.barCode?.trim(), r.data.sku?.trim()])
                            .filter(Boolean) as string[]
                    ),
                ];

                const existingItems = identifiers.length > 0
                    ? await prisma.item.findMany({
                        where: {
                            OR: [
                                { barCode: { in: identifiers } },
                                { sku: { in: identifiers } },
                                { itemId: { in: identifiers } },
                            ],
                        },
                        select: { id: true, itemId: true, sku: true, barCode: true, description: true, unitPrice: true, unitCost: true, taxRate1: true },
                    })
                    : [];

                const itemMap = new Map<string, typeof existingItems[0]>();
                for (const it of existingItems) {
                    if (it.barCode) itemMap.set(it.barCode.toLowerCase().trim(), it);
                    if (it.sku) itemMap.set(it.sku.toLowerCase().trim(), it);
                    if (it.itemId) itemMap.set(it.itemId.toLowerCase().trim(), it);
                }

                // B. Supplier lookup (load active suppliers for smart matching)
                const existingSuppliers = await prisma.supplier.findMany({
                    select: { id: true, code: true, name: true },
                });

                // C. Warehouse lookup (load active warehouses for smart matching)
                const existingWarehouses = await prisma.warehouse.findMany({
                    select: { id: true, code: true, name: true },
                });

                // Row-by-row verification
                for (const record of recordsToCheck) {
                    const { row, data } = record;

                    // Verify item
                    const bc = data.barCode?.toLowerCase().trim();
                    const sku = data.sku?.toLowerCase().trim();
                    const matchedItem = (bc && itemMap.get(bc)) || (sku && itemMap.get(sku));

                    if (!matchedItem) {
                        allValidationErrors.push({
                            row,
                            field: 'barCode / sku',
                            value: data.barCode || data.sku || '',
                            reason: `Item not found in master catalog for Barcode/SKU "${data.barCode || data.sku}".`,
                        });
                    }

                    // Verify supplier (if specified in row)
                    if (data.supplier?.trim()) {
                        const matchedSup = this.resolveSupplier(data.supplier, existingSuppliers);
                        if (!matchedSup) {
                            allValidationErrors.push({
                                row,
                                field: 'supplier',
                                value: data.supplier,
                                reason: `Supplier "${data.supplier}" not found. Please verify the supplier name/code.`,
                            });
                        }
                    } else if (metadata?.vendorId) {
                        // Check if metadata supplier exists
                        const metaSupplier = await prisma.supplier.findUnique({
                            where: { id: metadata.vendorId },
                            select: { id: true },
                        });
                        if (!metaSupplier) {
                            allValidationErrors.push({
                                row,
                                field: 'supplier',
                                value: metadata.vendorId,
                                reason: 'Selected default supplier does not exist in the database.',
                            });
                        }
                    }

                    // Verify warehouse (if specified in row)
                    if (data.warehouse?.trim()) {
                        const matchedWh = this.resolveWarehouse(data.warehouse, existingWarehouses);
                        if (!matchedWh) {
                            allValidationErrors.push({
                                row,
                                field: 'warehouse',
                                value: data.warehouse,
                                reason: `Warehouse "${data.warehouse}" not found.`,
                            });
                        }
                    }
                }

                // Calculate summary stats
                const uniqueInvalidRows = new Set(allValidationErrors.map(e => e.row));
                const validRowsCount = totalRecordsCount - uniqueInvalidRows.size;

                await prisma.bulkUpload.update({
                    where: { id: uploadId },
                    data: {
                        status: 'validated',
                        totalRecords: totalRecordsCount,
                        failedRecords: uniqueInvalidRows.size,
                        successRecords: validRowsCount,
                        errors: allValidationErrors as any,
                        message: `Validation complete: ${validRowsCount} valid rows, ${uniqueInvalidRows.size} invalid.`,
                        completedAt: new Date(),
                    },
                });

                await this.notificationsService.create({
                    userId,
                    title: 'Direct Purchase Invoice Validation Completed',
                    message: `Validation completed: ${validRowsCount} valid rows ready for import (${uniqueInvalidRows.size} errors).`,
                    category: 'procurement',
                    priority: 'normal',
                    channels: ['inApp'],
                });

                await job.progress(100);
                this.eventsService.emit({
                    uploadId,
                    type: 'completed',
                    data: {
                        status: 'validated',
                        totalRecords: totalRecordsCount,
                        successRecords: validRowsCount,
                        failedRecords: uniqueInvalidRows.size,
                        errors: allValidationErrors,
                        progress: 100,
                    },
                });
            }
        } catch (error: any) {
            this.logger.error(`Direct PI Bulk Upload failed: ${error.message}`, error.stack);
            await prisma.bulkUpload.update({
                where: { id: uploadId },
                data: {
                    status: 'failed',
                    message: error.message,
                    completedAt: new Date(),
                },
            });

            this.eventsService.emit({
                uploadId,
                type: 'failed',
                data: { status: 'failed', message: error.message },
            });

            await this.notificationsService.create({
                userId,
                title: 'Direct PI Bulk Upload Failed',
                message: `Direct PI upload failed: ${error.message}`,
                category: 'procurement',
                priority: 'high',
                channels: ['inApp'],
            });
        }
    }

    private async importDirectInvoices(
        metadata: any,
        records: DirectPiParsedRecord[],
        progress: DirectPiUploadProgress,
        prisma: PrismaService,
        userId: string,
        uploadId: string,
        job: Job<any>,
    ): Promise<void> {
        // Collect all lookup references
        const allIdentifiers = [
            ...new Set(
                records
                    .flatMap(r => [r.data.barCode?.trim(), r.data.sku?.trim()])
                    .filter(Boolean) as string[]
            ),
        ];

        const allSupplierKeys = [
            ...new Set(
                records
                    .map(r => r.data.supplier?.trim())
                    .filter(Boolean) as string[]
            ),
        ];

        const allWarehouseKeys = [
            ...new Set(
                records
                    .map(r => r.data.warehouse?.trim())
                    .filter(Boolean) as string[]
            ),
        ];

        // Bulk load references
        const [items, suppliers, warehouses] = await Promise.all([
            allIdentifiers.length > 0
                ? prisma.item.findMany({
                    where: {
                        OR: [
                            { barCode: { in: allIdentifiers } },
                            { sku: { in: allIdentifiers } },
                            { itemId: { in: allIdentifiers } },
                        ],
                    },
                    select: { id: true, itemId: true, sku: true, barCode: true, description: true, unitPrice: true, unitCost: true, taxRate1: true },
                })
                : [],
            prisma.supplier.findMany({
                select: { id: true, code: true, name: true },
            }),
            prisma.warehouse.findMany({
                select: { id: true, code: true, name: true },
            }),
        ]);

        const itemMap = new Map<string, typeof items[0]>();
        for (const it of items) {
            if (it.barCode) itemMap.set(it.barCode.toLowerCase().trim(), it);
            if (it.sku) itemMap.set(it.sku.toLowerCase().trim(), it);
            if (it.itemId) itemMap.set(it.itemId.toLowerCase().trim(), it);
        }

        // Group records into distinct Direct Invoices
        // Grouping logic:
        // If row has invoiceNumber -> group by invoiceNumber
        // If row has no invoiceNumber -> group by supplier + invoiceDate (or metadata)
        const invoiceGroups = new Map<string, DirectPiParsedRecord[]>();

        for (const record of records) {
            let key = record.data.invoiceNumber?.trim();
            if (!key) {
                const sKey = record.data.supplier?.trim() || metadata?.vendorId || 'DEFAULT_SUPPLIER';
                const dKey = record.data.invoiceDate?.trim() || metadata?.invoiceDate || 'DEFAULT_DATE';
                key = `AUTO_GROUP_${sKey}_${dKey}`;
            }

            if (!invoiceGroups.has(key)) {
                invoiceGroups.set(key, []);
            }
            invoiceGroups.get(key)!.push(record);
        }

        const totalInvoices = invoiceGroups.size;
        let createdInvoicesCount = 0;
        let currentPiSequenceNumber: number | null = null;
        const currentYear = new Date().getFullYear();

        // Helper to get next sequential PI invoice number
        const getNextPiNumber = async (): Promise<string> => {
            if (currentPiSequenceNumber === null) {
                const prefix = 'PI';
                const lastInvoice = await prisma.purchaseInvoice.findFirst({
                    where: {
                        invoiceNumber: {
                            startsWith: `${prefix}-${currentYear}`,
                        },
                    },
                    orderBy: {
                        invoiceNumber: 'desc',
                    },
                });

                let lastNumber = 0;
                if (lastInvoice) {
                    lastNumber = parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0');
                }
                currentPiSequenceNumber = lastNumber + 1;
            } else {
                currentPiSequenceNumber++;
            }

            return `PI-${currentYear}-${currentPiSequenceNumber.toString().padStart(4, '0')}`;
        };

        const totalValidRows = records.length;
        let processedRowsCount = 0;
        const startTime = Date.now();

        // Process each invoice group in a transaction
        for (const [groupKey, groupRecords] of invoiceGroups) {
            const firstRecord = groupRecords[0].data;

            // Resolve supplier
            let resolvedSupplierId: string | null = null;
            if (firstRecord.supplier?.trim()) {
                const matchedSupplier = this.resolveSupplier(firstRecord.supplier, suppliers);
                if (matchedSupplier) resolvedSupplierId = matchedSupplier.id;
            }
            if (!resolvedSupplierId && metadata?.vendorId) {
                resolvedSupplierId = metadata.vendorId;
            }

            if (!resolvedSupplierId) {
                // Fallback: take first supplier from DB
                const fallbackSup = await prisma.supplier.findFirst({ select: { id: true } });
                resolvedSupplierId = fallbackSup?.id || null;
            }

            if (!resolvedSupplierId) {
                throw new Error(`Cannot determine supplier for invoice group "${groupKey}".`);
            }

            // Resolve warehouse
            let resolvedWarehouseId: string | null = null;
            if (firstRecord.warehouse?.trim()) {
                const matchedWarehouse = this.resolveWarehouse(firstRecord.warehouse, warehouses);
                if (matchedWarehouse) resolvedWarehouseId = matchedWarehouse.id;
            }
            if (!resolvedWarehouseId && metadata?.warehouseId) {
                resolvedWarehouseId = metadata.warehouseId;
            }

            // Resolve dates
            const invoiceDateStr = firstRecord.invoiceDate || metadata?.invoiceDate || new Date().toISOString().split('T')[0];
            const invoiceDate = new Date(invoiceDateStr);
            const dueDate = firstRecord.dueDate ? new Date(firstRecord.dueDate) : null;

            // Resolve invoice number
            let invoiceNumber: string;
            if (firstRecord.invoiceNumber?.trim()) {
                invoiceNumber = firstRecord.invoiceNumber.trim();
                // Check uniqueness if provided explicitly
                const existing = await prisma.purchaseInvoice.findUnique({
                    where: { invoiceNumber },
                });
                if (existing) {
                    invoiceNumber = await getNextPiNumber();
                }
            } else {
                invoiceNumber = await getNextPiNumber();
            }

            // Prepare line items & totals
            let subtotal = 0;
            let totalTaxAmount = 0;
            let totalDiscountAmount = 0;

            const preparedItems: any[] = [];

            for (const r of groupRecords) {
                const rd = r.data;
                const bc = rd.barCode?.toLowerCase().trim();
                const sku = rd.sku?.toLowerCase().trim();
                const matchedItem = (bc && itemMap.get(bc)) || (sku && itemMap.get(sku));

                if (!matchedItem) continue;

                const qty = rd.quantity || 1;
                const unitPrice = rd.unitPrice !== undefined && rd.unitPrice !== null && rd.unitPrice >= 0
                    ? rd.unitPrice
                    : Number(matchedItem.unitPrice || matchedItem.unitCost || 0);

                const taxRate = rd.taxRate !== undefined && rd.taxRate !== null
                    ? rd.taxRate
                    : Number(matchedItem.taxRate1 || 0);

                const discountRate = rd.discountRate !== undefined && rd.discountRate !== null
                    ? rd.discountRate
                    : 0;

                const lineTotal = qty * unitPrice;
                const itemDiscountAmount = lineTotal * (discountRate / 100);
                const discountedAmount = lineTotal - itemDiscountAmount;
                const itemTaxAmount = discountedAmount * (taxRate / 100);
                const finalLineTotal = discountedAmount + itemTaxAmount;

                subtotal += discountedAmount;
                totalTaxAmount += itemTaxAmount;
                totalDiscountAmount += itemDiscountAmount;

                preparedItems.push({
                    itemId: matchedItem.id,
                    description: rd.description || matchedItem.description || '',
                    quantity: qty,
                    unitPrice: unitPrice,
                    lineTotal: finalLineTotal,
                    taxRate: taxRate,
                    taxAmount: itemTaxAmount,
                    discountRate: discountRate,
                    discountAmount: itemDiscountAmount,
                    rollSize: rd.rollSize ?? null,
                });
            }

            if (preparedItems.length === 0) continue;

            const totalAmount = subtotal + totalTaxAmount;
            const invoiceNotes = firstRecord.invoiceNotes || metadata?.notes || `Imported via Bulk Uploader (${uploadId})`;

            // Create Purchase Invoice with items and update latest unitCost in Item Master
            await prisma.$transaction(async (tx) => {
                await tx.purchaseInvoice.create({
                    data: {
                        invoiceNumber,
                        invoiceDate,
                        dueDate,
                        supplierId: resolvedSupplierId!,
                        warehouseId: resolvedWarehouseId || null,
                        invoiceType: 'DIRECT',
                        status: 'DRAFT',
                        subtotal: new Decimal(subtotal),
                        taxAmount: new Decimal(totalTaxAmount),
                        discountAmount: new Decimal(totalDiscountAmount),
                        totalAmount: new Decimal(totalAmount),
                        remainingAmount: new Decimal(totalAmount),
                        paidAmount: new Decimal(0),
                        returnAmount: new Decimal(0),
                        notes: invoiceNotes,
                        items: {
                            create: preparedItems.map(item => ({
                                itemId: item.itemId,
                                description: item.description,
                                quantity: new Decimal(item.quantity),
                                unitPrice: new Decimal(item.unitPrice),
                                lineTotal: new Decimal(item.lineTotal),
                                taxRate: new Decimal(item.taxRate),
                                taxAmount: new Decimal(item.taxAmount),
                                discountRate: new Decimal(item.discountRate),
                                discountAmount: new Decimal(item.discountAmount),
                                rollSize: item.rollSize,
                            })),
                        },
                    },
                });

                // Update Item Master's latest unitCost for all items with cost > 0
                for (const item of preparedItems) {
                    if (item.unitPrice > 0) {
                        await tx.item.update({
                            where: { id: item.itemId },
                            data: { unitCost: item.unitPrice },
                        });
                    }
                }
            });

            createdInvoicesCount++;
            processedRowsCount += groupRecords.length;
            progress.successRecords = createdInvoicesCount;
            progress.processedRecords = processedRowsCount;

            const progressPercent = totalValidRows > 0
                ? Math.min(Math.round((processedRowsCount / totalValidRows) * 100), 99)
                : 100;

            const elapsedSec = (Date.now() - startTime) / 1000;
            const recsPerSec = Math.round(processedRowsCount / (elapsedSec || 1));

            this.eventsService.emit({
                uploadId,
                type: 'progress',
                data: {
                    progress: progressPercent,
                    processedRecords: processedRowsCount,
                    successRecords: createdInvoicesCount,
                    failedRecords: progress.failedRecords,
                    recsPerSec,
                    status: 'processing',
                    message: `Created Direct PI ${invoiceNumber} (${createdInvoicesCount}/${totalInvoices} invoices)...`,
                },
            });

            await job.progress(progressPercent);
        }
    }

    /**
     * Smart resolver for Supplier by ID, Code, Name, or formatted combinations like "huz (987888)", "huz 987888", etc.
     */
    private resolveSupplier(
        input: string | undefined | null,
        suppliers: { id: string; code: string | null; name: string }[],
    ): { id: string; code: string | null; name: string } | null {
        if (!input || !input.trim()) return null;
        const raw = input.trim().toLowerCase();

        // 1. Direct exact match by ID, Code, Name
        for (const s of suppliers) {
            if (s.id.toLowerCase() === raw) return s;
            if (s.code && s.code.toLowerCase().trim() === raw) return s;
            if (s.name.toLowerCase().trim() === raw) return s;
        }

        // 2. Formatted labels: "name (code)", "name(code)", "name code", "code - name", "code-name"
        for (const s of suppliers) {
            const name = s.name.toLowerCase().trim();
            const code = (s.code || '').toLowerCase().trim();

            if (code) {
                if (
                    raw === `${name} (${code})` ||
                    raw === `${name}(${code})` ||
                    raw === `${name} ${code}` ||
                    raw === `${code} - ${name}` ||
                    raw === `${code}-${name}` ||
                    raw === `${name} - ${code}`
                ) {
                    return s;
                }
            }
        }

        // 3. Extract bracketed code: "huz (987888)" or "huz [987888]"
        const bracketMatch = input.match(/^(.*?)\s*[\(\[\{](.*?)[\)\]\}]\s*$/);
        if (bracketMatch) {
            const part1 = bracketMatch[1].trim().toLowerCase();
            const part2 = bracketMatch[2].trim().toLowerCase();
            for (const s of suppliers) {
                const name = s.name.toLowerCase().trim();
                const code = (s.code || '').toLowerCase().trim();
                if (name === part1 || code === part2 || name === part2 || code === part1) return s;
            }
        }

        // 4. Word-based or code substring match: If input string contains the supplier's code (e.g. "987888")
        for (const s of suppliers) {
            const code = (s.code || '').toLowerCase().trim();
            if (code && raw.includes(code)) {
                return s;
            }
        }

        // 5. Name match: If input string contains the supplier's name (e.g. "huz")
        for (const s of suppliers) {
            const name = s.name.toLowerCase().trim();
            if (name && raw.includes(name)) {
                return s;
            }
        }

        return null;
    }

    /**
     * Smart resolver for Warehouse by ID, Code, Name, or formatted combinations
     */
    private resolveWarehouse(
        input: string | undefined | null,
        warehouses: { id: string; code: string | null; name: string }[],
    ): { id: string; code: string | null; name: string } | null {
        if (!input || !input.trim()) return null;
        const raw = input.trim().toLowerCase();

        // 1. Direct exact match
        for (const w of warehouses) {
            if (w.id.toLowerCase() === raw) return w;
            if (w.code && w.code.toLowerCase().trim() === raw) return w;
            if (w.name.toLowerCase().trim() === raw) return w;
        }

        // 2. Formatted labels
        for (const w of warehouses) {
            const name = w.name.toLowerCase().trim();
            const code = (w.code || '').toLowerCase().trim();
            if (code) {
                if (
                    raw === `${name} (${code})` ||
                    raw === `${name}(${code})` ||
                    raw === `${name} ${code}` ||
                    raw === `${code} - ${name}` ||
                    raw === `${code}-${name}` ||
                    raw === `${name} - ${code}`
                ) {
                    return w;
                }
            }
        }

        // 3. Extract bracketed code
        const bracketMatch = input.match(/^(.*?)\s*[\(\[\{](.*?)[\)\]\}]\s*$/);
        if (bracketMatch) {
            const part1 = bracketMatch[1].trim().toLowerCase();
            const part2 = bracketMatch[2].trim().toLowerCase();
            for (const w of warehouses) {
                const name = w.name.toLowerCase().trim();
                const code = (w.code || '').toLowerCase().trim();
                if (name === part1 || code === part2 || name === part2 || code === part1) return w;
            }
        }

        // 4. Code substring match
        for (const w of warehouses) {
            const code = (w.code || '').toLowerCase().trim();
            if (code && raw.includes(code)) {
                return w;
            }
        }

        // 5. Name match
        for (const w of warehouses) {
            const name = w.name.toLowerCase().trim();
            if (name && raw.includes(name)) {
                return w;
            }
        }

        return null;
    }
}
