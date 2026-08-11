import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import {
    SalesHistoryCsvParserService,
    SalesHistoryParsedRecord,
} from '../../common/services/sales-history-csv-parser.service';
import { SalesHistoryValidatorService } from '../../common/services/sales-history-validator.service';
import { UploadEventsService } from '../../finance/item/upload-events.service';
import { NotificationsService } from '../../notifications/notifications.service';
import * as fs from 'fs';
import * as path from 'path';

export interface SalesHistoryUploadProgress {
    totalRecords: number;
    processedRecords: number;
    successRecords: number;
    failedRecords: number;
    skippedRecords: number;
    errors: Array<{ row: number; reason: string; data: any }>;
}

/**
 * Groups raw line-item rows by DocumentNumber so that multi-item orders
 * (Sale7 has 4 rows) are created as a single SalesOrder with multiple items.
 */
interface OrderGroup {
    documentNumber: string;
    rows: SalesHistoryParsedRecord[];
} 
@Processor('sales-history-upload')
export class SalesHistoryUploadProcessor {
    private readonly logger = new Logger(SalesHistoryUploadProcessor.name);

    constructor(
        private readonly csvParser: SalesHistoryCsvParserService,
        private readonly validator: SalesHistoryValidatorService,
        private readonly eventsService: UploadEventsService,
        private readonly notificationsService: NotificationsService,
    ) {}

    /**
     * Robust date parser that handles:
     * - Excel numeric serial dates (e.g. 46200)
     * - 2-digit year strings: "4/30/26" → 2026-04-30
     * - 4-digit year strings: "7/7/2026", "2026-07-07"
     */
    private parseExcelDate(value: any): Date | undefined {
        if (value === null || value === undefined) return undefined;

        // Excel numeric serial date
        if (typeof value === 'number') {
            // Excel epoch is 1899-12-30
            const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
            if (!isNaN(date.getTime())) return date;
        }

        const s = String(value).trim();
        if (!s) return undefined;

        // Try ISO / standard formats first
        const iso = new Date(s);
        if (!isNaN(iso.getTime()) && iso.getFullYear() > 2000) return iso;

        // Handle M/D/YY or M/D/YYYY (and D/M/YY variants)
        const slashParts = s.split('/');
        if (slashParts.length === 3) {
            let [a, b, c] = slashParts.map((p) => parseInt(p, 10));
            // Fix 2-digit year
            if (c < 100) c = c + 2000;
            // Determine M/D/YYYY vs D/M/YYYY: if first part > 12 it must be the day
            let month: number, day: number, year: number;
            if (a > 12) {
                // D/M/YYYY
                day = a; month = b; year = c;
            } else {
                // M/D/YYYY (Excel default US format)
                month = a; day = b; year = c;
            }
            const date = new Date(Date.UTC(year, month - 1, day));
            if (!isNaN(date.getTime())) return date;
        }

        return undefined;
    }

    @Process()
    async handleUpload(job: Job<any>): Promise<void> {
        let { uploadId, fileBuffer, filename, userId, tenantId, tenantDbUrl, mode,
              posId, terminalId, locationId } = job.data;
        mode = mode || 'import';

        this.logger.log(
            `[Job ${job.id}] Sales History ${mode.toUpperCase()} started for ${filename} (Upload: ${uploadId})`,
        );

        // Reconstruct Buffer if serialised through Bull
        if (fileBuffer && (fileBuffer as any).type === 'Buffer' && Array.isArray((fileBuffer as any).data)) {
            fileBuffer = Buffer.from((fileBuffer as any).data);
        }

        // Recover from disk if buffer is missing (import phase)
        if (!fileBuffer) {
            const ext = filename.split('.').pop();
            const filePath = path.join(
                process.cwd(),
                'uploads',
                'bulk',
                'sales-history',
                `sales-history-upload-${uploadId}.${ext}`,
            );
            if (fs.existsSync(filePath)) {
                this.logger.log(`[Job ${job.id}] Recovering file from disk: ${filePath}`);
                fileBuffer = fs.readFileSync(filePath);
            } else {
                this.logger.error(`[Job ${job.id}] CRITICAL: File not found at ${filePath}`);
                throw new Error(`File buffer missing and not found on disk at ${filePath}`);
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
                    message:
                        mode === 'validate'
                            ? 'Starting Sales History Validation...'
                            : 'Starting Sales History Import...',
                },
            });

            const progress: SalesHistoryUploadProgress = {
                totalRecords: 0,
                processedRecords: 0,
                successRecords: 0,
                failedRecords: 0,
                skippedRecords: 0,
                errors: [],
            };

            let totalRecordsCount = 0;
            let successRecordsCount = 0;
            let lastEmitTime = Date.now();

            // ── VALIDATE MODE ──────────────────────────────────────────────
            if (mode === 'validate') {
                this.eventsService.emit({
                    uploadId,
                    type: 'status',
                    data: { message: 'Streaming sales history validation scan...' },
                });

                let validationBatch: SalesHistoryParsedRecord[] = [];
                const allValidationErrors: any[] = [];
                const docNumberSet = new Set<string>(); // track duplicate doc numbers

                await this.csvParser.parseFileStreaming(fileBuffer, filename, async (record) => {
                    totalRecordsCount++;

                    // Duplicate DocumentNumber detection (within file)
                    // Note: same DocumentNumber on multiple rows is EXPECTED (multi-item order)
                    // so we only flag if the same barCode appears twice under the same DocumentNumber
                    const dupKey = `${record.data.documentNumber}::${record.data.barCode}`;
                    if (record.data.documentNumber && record.data.barCode) {
                        if (docNumberSet.has(dupKey)) {
                            allValidationErrors.push({
                                row: record.row,
                                field: 'barCode',
                                value: record.data.barCode,
                                reason: `Duplicate barCode "${record.data.barCode}" under DocumentNumber "${record.data.documentNumber}".`,
                            });
                        } else {
                            docNumberSet.add(dupKey);
                        }
                    }

                    validationBatch.push(record);

                    if (validationBatch.length >= 1000) {
                        const batchErrors = this.validator.validateRecords(validationBatch);
                        allValidationErrors.push(...batchErrors);
                        successRecordsCount += validationBatch.length - batchErrors.length;
                        validationBatch = [];

                        const now = Date.now();
                        if (now - lastEmitTime > 2000) {
                            lastEmitTime = now;
                            await job.progress(10);
                            this.eventsService.emit({
                                uploadId,
                                type: 'progress',
                                data: {
                                    progress: 10,
                                    status: 'validating',
                                    message: `Validating: ${totalRecordsCount} rows scanned...`,
                                },
                            });
                        }
                    }
                });

                // Flush remaining
                if (validationBatch.length > 0) {
                    const batchErrors = this.validator.validateRecords(validationBatch);
                    allValidationErrors.push(...batchErrors);
                    successRecordsCount += validationBatch.length - batchErrors.length;
                }

                docNumberSet.clear();

                await prisma.bulkUpload.update({
                    where: { id: uploadId },
                    data: {
                        status: 'validated',
                        totalRecords: totalRecordsCount,
                        failedRecords: allValidationErrors.length,
                        successRecords: successRecordsCount,
                        errors: allValidationErrors as any,
                        message: `Validation complete: ${successRecordsCount} valid, ${allValidationErrors.length} invalid.`,
                        completedAt: new Date(),
                    },
                });

                await this.notificationsService.create({
                    userId,
                    title: 'Sales History Validation Completed',
                    message: `Validation finished: ${successRecordsCount} valid rows, ${allValidationErrors.length} invalid.`,
                    category: 'system',
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
                        successRecords: successRecordsCount,
                        failedRecords: allValidationErrors.length,
                        errors: allValidationErrors,
                        progress: 100,
                    },
                });
                return;
            }

            // ── IMPORT MODE ────────────────────────────────────────────────
            this.logger.log(`[Job ${job.id}] Starting Streaming Sales History Import for ${uploadId}`);

            const uploadRecord = await prisma.bulkUpload.findUnique({
                where: { id: uploadId },
                select: { errors: true, totalRecords: true },
            });

            const allValidationErrors = (
                Array.isArray(uploadRecord?.errors) ? uploadRecord.errors : []
            ) as any[];
            const invalidRows = new Set(allValidationErrors.map((e) => e.row));
            const totalToBeProcessed = (uploadRecord?.totalRecords || 0) - invalidRows.size;

            progress.totalRecords = uploadRecord?.totalRecords || 0;
            progress.failedRecords = invalidRows.size;
            progress.errors = allValidationErrors.map((e) => ({
                row: e.row,
                reason: `${e.field}: ${e.reason}`,
                data: { field: e.field, value: e.value },
            }));

            const startTime = Date.now();

            // Collect all valid rows first, then group by DocumentNumber
            // We need to group because one order = multiple rows (multi-item)
            // Buffer is manageable — typical sales history files are <100k rows
            const allValidRows: SalesHistoryParsedRecord[] = [];

            await this.csvParser.parseFileStreaming(fileBuffer, filename, async (record) => {
                totalRecordsCount++;
                if (!invalidRows.has(record.row)) {
                    allValidRows.push(record);
                }
            });

            // Group rows by DocumentNumber
            const orderGroups = new Map<string, SalesHistoryParsedRecord[]>();
            for (const row of allValidRows) {
                const key = row.data.documentNumber || `__row_${row.row}`;
                if (!orderGroups.has(key)) orderGroups.set(key, []);
                orderGroups.get(key)!.push(row);
            }

            this.logger.log(
                `[Job ${job.id}] Grouped ${allValidRows.length} rows into ${orderGroups.size} orders`,
            );

            // Process in batches of 50 orders at a time
            const BATCH_SIZE = 50;
            const groups = Array.from(orderGroups.entries());

            for (let i = 0; i < groups.length; i += BATCH_SIZE) {
                const batch = groups.slice(i, i + BATCH_SIZE);
                await this.processOrderBatch(batch, progress, uploadId, prisma, { posId, terminalId, locationId });

                // Yield to event loop
                await new Promise((resolve) => setImmediate(resolve));

                const now = Date.now();
                if (now - lastEmitTime > 100) {
                    lastEmitTime = now;
                    const elapsedSec = (now - startTime) / 1000;
                    const recsPerSec = Math.round(progress.processedRecords / (elapsedSec || 1));
                    const memoryUsageMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
                    const currentProgress =
                        totalToBeProcessed > 0
                            ? Math.round((progress.processedRecords / totalToBeProcessed) * 100)
                            : 0;

                    if (now % 5000 < 200) {
                        await prisma.bulkUpload.update({
                            where: { id: uploadId },
                            data: {
                                processedRecords: progress.processedRecords,
                                successRecords: progress.successRecords,
                                failedRecords: progress.failedRecords,
                                message: `Importing: ${progress.processedRecords} rows @ ${recsPerSec} recs/s`,
                            },
                        });
                    }

                    await job.progress(currentProgress);
                    this.eventsService.emit({
                        uploadId,
                        type: 'progress',
                        data: {
                            progress: currentProgress,
                            processedRecords: progress.processedRecords,
                            successRecords: progress.successRecords,
                            failedRecords: progress.failedRecords,
                            recsPerSec,
                            memoryUsageMB,
                            status: 'processing',
                        },
                    });
                }
            }

            await prisma.bulkUpload.update({
                where: { id: uploadId },
                data: {
                    status: 'completed',
                    processedRecords: progress.processedRecords,
                    successRecords: progress.successRecords,
                    failedRecords: progress.failedRecords,
                    message: `Sales history import completed: ${progress.successRecords} orders created.`,
                    completedAt: new Date(),
                },
            });

            await this.notificationsService.create({
                userId,
                title: 'Sales History Import Completed',
                message: `Import finished: ${progress.successRecords} orders created, ${progress.failedRecords} failed.`,
                category: 'system',
                priority: 'high',
                channels: ['inApp'],
            });

            this.eventsService.emit({
                uploadId,
                type: 'completed',
                data: {
                    status: 'completed',
                    successRecords: progress.successRecords,
                    failedRecords: progress.failedRecords,
                    progress: 100,
                },
            });
        } catch (error) {
            this.logger.error(`[Job ${job.id}] FAILED: ${error.message}`, error.stack);
            try {
                await prisma.bulkUpload.update({
                    where: { id: uploadId },
                    data: {
                        status: 'failed',
                        completedAt: new Date(),
                        message: `Error: ${error.message}`,
                    },
                });

                await this.notificationsService.create({
                    userId,
                    title: 'Sales History Import Failed',
                    message: `The sales history ${mode} job failed: ${error.message}`,
                    category: 'system',
                    priority: 'urgent',
                    channels: ['inApp'],
                });

                this.eventsService.emit({
                    uploadId,
                    type: 'failed',
                    data: { message: error.message },
                });
            } catch (e) {
                this.logger.error(`Failed to update failure status: ${e.message}`);
            }
        } finally {
            await prisma.$disconnect();
        }
    }

    /**
     * Process a batch of order groups.
     * Each group = one DocumentNumber = one SalesOrder with N items.
     */
    private async processOrderBatch(
        batch: [string, SalesHistoryParsedRecord[]][],
        progress: SalesHistoryUploadProgress,
        uploadId: string,
        prisma: PrismaService,
        terminalCtx: { posId?: string; terminalId?: string; locationId?: string } = {},
    ): Promise<void> {
        // Collect all barcodes in this batch for a single bulk lookup
        const allBarCodes = [
            ...new Set(
                batch.flatMap(([, rows]) =>
                    rows.map((r) => r.data.barCode).filter(Boolean) as string[],
                ),
            ),
        ];

        // Bulk item lookup by barCode
        const items = await prisma.item.findMany({
            where: { barCode: { in: allBarCodes } },
            select: { id: true, barCode: true, unitPrice: true, taxRate1: true },
        });
        const itemByBarCode = new Map(items.map((i) => [i.barCode!, i]));

        // Also try by itemId (some barcodes may be stored as itemId)
        const missingBarCodes = allBarCodes.filter((bc) => !itemByBarCode.has(bc));
        if (missingBarCodes.length > 0) {
            const byItemId = await prisma.item.findMany({
                where: { itemId: { in: missingBarCodes } },
                select: { id: true, barCode: true, itemId: true, unitPrice: true, taxRate1: true },
            });
            for (const item of byItemId) {
                // Index by the barCode we searched for (which was the itemId)
                const searchedAs = missingBarCodes.find((bc) => bc === item.itemId);
                if (searchedAs) itemByBarCode.set(searchedAs, item);
            }
        }

        // Check which DocumentNumbers already exist to update them
        const docNumbers = batch.map(([docNum]) => docNum);
        const existingOrders = await prisma.salesOrder.findMany({
            where: { orderNumber: { in: docNumbers } },
            select: { id: true, orderNumber: true },
        });
        const existingOrderMap = new Map(existingOrders.map((o) => [o.orderNumber, o.id]));

        // Gather unique customer codes from this batch
        const allCustomerCodes = [
            ...new Set(
                batch.map(([, rows]) => rows[0].data.customerCode).filter(Boolean) as string[]
            )
        ];

        // Gather mapping of code to customerName
        const customerNameByCode = new Map<string, string>();
        for (const [, rows] of batch) {
            for (const row of rows) {
                const code = row.data.customerCode;
                const name = row.data.customerName;
                if (code) {
                    if (name && !customerNameByCode.has(code)) {
                        customerNameByCode.set(code, name);
                    }
                }
            }
        }

        // Query existing customers
        const existingCustomers = await prisma.customer.findMany({
            where: { code: { in: allCustomerCodes } },
            select: { id: true, code: true },
        });
        const customerIdByCode = new Map<string, string>(
            existingCustomers.map((c) => [c.code, c.id])
        );

        // Auto-create missing customers
        for (const code of allCustomerCodes) {
            if (!customerIdByCode.has(code)) {
                const name = customerNameByCode.get(code) || code;
                try {
                    const newCustomer = await prisma.customer.create({
                        data: {
                            code,
                            name,
                            customerType: 'POS',
                        },
                        select: { id: true },
                    });
                    customerIdByCode.set(code, newCustomer.id);
                } catch (err) {
                    // Try to look it up in case it was created concurrently
                    const existing = await prisma.customer.findUnique({
                        where: { code },
                        select: { id: true },
                    });
                    if (existing) {
                        customerIdByCode.set(code, existing.id);
                    } else {
                        throw err;
                    }
                }
            }
        }

        for (const [documentNumber, rows] of batch) {
            // Count all rows in this group as processed
            progress.processedRecords += rows.length;

            const existingOrderId = existingOrderMap.get(documentNumber);

            try {
                // Use the first row for order-level fields
                const firstRow = rows[0].data;

                // Resolve order date using robust parser (handles 2-digit years like "4/30/26")
                const createdAt = this.parseExcelDate(firstRow.documentDate);

                // ── Determine payment method and amounts ──
                // Scan ALL rows in the group — the exporter may populate payment
                // columns only on certain rows (e.g. only on the last row).
                // Strategy: sum unique non-zero payment values per tender type.
                // For duplicated-totals orders (N rows with identical amounts) we
                // divide by N after detecting the duplication signature.
                const numRows = rows.length;

                // Detect if Excel order quantity/totals are duplicated across all rows (N times)
                let isDuplicated = false;
                if (numRows > 1) {
                    const firstQty = firstRow.quantity;
                    const firstTotal = firstRow.totalPriceWithTax;
                    // Duplication signature: All rows have the same quantity (which equals numRows)
                    // and all rows have the same totalPriceWithTax.
                    if (firstQty === numRows) {
                        const allMatch = rows.every(
                            (r) => r.data.quantity === firstQty && r.data.totalPriceWithTax === firstTotal
                        );
                        if (allMatch) {
                            isDuplicated = true;
                        }
                    }
                }

                // Aggregate payments: take the max across all rows (handles
                // both "last-row-only" and "duplicated on every row" patterns).
                let cashSale = Math.max(...rows.map((r) => r.data.cashSale || 0));
                let cardSale = Math.max(...rows.map((r) => r.data.cardSale || 0));
                let giftVoucher = Math.max(...rows.map((r) => r.data.giftVoucherAmount || 0));
                let creditVoucher = Math.max(...rows.map((r) => r.data.creditVoucherAmount || 0));
                let exchangeVoucher = Math.max(...rows.map((r) => r.data.exchangeVoucherAmount || 0));
                let onCredit = Math.max(...rows.map((r) => r.data.onCreditAmount || 0));

                if (isDuplicated) {
                    // Payments were duplicated N times — divide to get actual order total
                    cashSale = cashSale / numRows;
                    cardSale = cardSale / numRows;
                    giftVoucher = giftVoucher / numRows;
                    creditVoucher = creditVoucher / numRows;
                    exchangeVoucher = exchangeVoucher / numRows;
                    onCredit = onCredit / numRows;
                }

                const voucherAmount = giftVoucher + creditVoucher + exchangeVoucher;
                const totalPaid = cashSale + cardSale + giftVoucher + creditVoucher + exchangeVoucher;
                let paymentMethod = 'cash';
                if (cardSale > 0 && cashSale > 0) paymentMethod = 'split';
                else if (cardSale > 0) paymentMethod = 'card';
                else if (giftVoucher > 0 || creditVoucher > 0 || exchangeVoucher > 0) paymentMethod = 'voucher';
                else if (onCredit > 0) paymentMethod = 'credit_account';

                // Build line items
                const lineItems: {
                    itemId: string;
                    quantity: number;
                    unitPrice: number;
                    discountPercent: number;
                    discountAmount: number;
                    taxPercent: number;
                    taxAmount: number;
                    lineTotal: number;
                }[] = [];

                let hasItemError = false;
                let totalWostSum = 0;

                for (const row of rows) {
                    const d = row.data;
                    const item = d.barCode ? itemByBarCode.get(d.barCode) : null;

                    if (!item) {
                        progress.failedRecords++;
                        progress.errors.push({
                            row: row.row,
                            reason: `Item with barCode "${d.barCode}" not found in the system.`,
                            data: { barCode: d.barCode, documentNumber },
                        });
                        hasItemError = true;
                        continue;
                    }

                    let qty = d.quantity || 1;
                    const unitPrice = d.unitPrice ?? Number(item.unitPrice);
                    const discPct = d.discountPercent || 0;

                    if (isDuplicated) {
                        qty = qty / numRows;
                    }

                    // 1. Calculate tax-inclusive line total first (what the customer paid)
                    const subtotalTaxIncl = unitPrice * qty;
                    
                    let discountAmount = d.discountAmount;
                    if (isDuplicated && discountAmount !== undefined) {
                        discountAmount = discountAmount / numRows;
                    }
                    const discAmtTaxIncl = discountAmount ?? Math.round(subtotalTaxIncl * (discPct / 100) * 100) / 100;
                    
                    let lineTotal = d.totalPriceWithTax ?? Math.max(0, Math.round((subtotalTaxIncl - discAmtTaxIncl) * 100) / 100);
                    if (isDuplicated && d.totalPriceWithTax !== undefined) {
                        lineTotal = lineTotal / numRows;
                    }

                    // 2. Extract tax-exclusive and tax amounts from the line total
                    const taxPct = Number(item.taxRate1 || 0);
                    const taxDivisor = 1 + (taxPct / 100);

                    const afterDisc = Math.round((lineTotal / taxDivisor) * 100) / 100;
                    
                    let salesTax = d.salesTax;
                    if (isDuplicated && salesTax !== undefined) {
                        salesTax = salesTax / numRows;
                    }
                    const taxAmt = salesTax ?? Math.round((lineTotal - afterDisc) * 100) / 100;
                    
                    const discAmt = Math.round((discAmtTaxIncl / taxDivisor) * 100) / 100;
                    const totalWost = afterDisc + discAmt;

                    totalWostSum += totalWost;

                    lineItems.push({
                        itemId: item.id,
                        quantity: qty,
                        unitPrice,
                        discountPercent: discPct,
                        discountAmount: discAmt,
                        taxPercent: taxPct,
                        taxAmount: taxAmt,
                        lineTotal: Math.max(0, lineTotal),
                    });
                }

                // Skip order if ALL items failed lookup
                if (lineItems.length === 0) {
                    progress.failedRecords += rows.length;
                    continue;
                }

                const subtotal = totalWostSum;
                const totalDiscount = lineItems.reduce((s, i) => s + i.discountAmount, 0);
                const totalTax = lineItems.reduce((s, i) => s + i.taxAmount, 0);
                const grandTotal = lineItems.reduce((s, i) => s + i.lineTotal, 0);

                const paymentStatus =
                    totalPaid >= grandTotal ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';

                // FBR invoice — strip leading apostrophe that Excel sometimes adds
                const rawFbr = firstRow.fbrInvoiceNumber;
                const fbrInvoiceNumber = rawFbr ? rawFbr.replace(/^'/, '') : undefined;

                const notesParts: string[] = [];
                if (firstRow.remarks) notesParts.push(firstRow.remarks);
                if (firstRow.isAllianceDiscount) notesParts.push('[Alliance Discount]');
                if (firstRow.salesPerson) notesParts.push(`SP: ${firstRow.salesPerson}`);

                const orderData = {
                    posId: terminalCtx.posId || null,
                    terminalId: terminalCtx.terminalId || null,
                    locationId: terminalCtx.locationId || null,
                    paymentMethod,
                    paymentStatus,
                    status: 'completed',
                    subtotal,
                    discountAmount: totalDiscount,
                    taxAmount: totalTax,
                    grandTotal,
                    cashAmount: cashSale || null,
                    cardAmount: cardSale || null,
                    voucherAmount: voucherAmount || null,
                    tenderType: paymentMethod,
                    fbrInvoiceNumber: fbrInvoiceNumber || null,
                    fbrStatus: fbrInvoiceNumber ? 'SYNCED' : 'PENDING',
                    notes: notesParts.join(' | ') || null,
                    createdAt: createdAt || undefined,
                    customerId: firstRow.customerCode ? customerIdByCode.get(firstRow.customerCode) || null : null,
                };

                if (existingOrderId) {
                    await prisma.$transaction(async (tx) => {
                        // Delete existing items
                        await tx.salesOrderItem.deleteMany({
                            where: { salesOrderId: existingOrderId },
                        });
                        // Update order and recreate items
                        await tx.salesOrder.update({
                            where: { id: existingOrderId },
                            data: {
                                ...orderData,
                                items: {
                                    create: lineItems,
                                },
                            },
                        });
                    });
                } else {
                    await prisma.salesOrder.create({
                        data: {
                            ...orderData,
                            orderNumber: documentNumber,
                            items: {
                                create: lineItems,
                            },
                        },
                    });
                }

                // Count each successfully created line item as a success
                progress.successRecords += lineItems.length;

                // If some items in this order failed lookup, count those as failed
                if (hasItemError) {
                    const failedCount = rows.length - lineItems.length;
                    progress.failedRecords += failedCount;
                }
            } catch (error) {
                this.logger.error(
                    `Failed to save order "${documentNumber}": ${error.message}`,
                );
                progress.failedRecords += rows.length;
                progress.errors.push({
                    row: rows[0].row,
                    reason: `DB error for order "${documentNumber}": ${error.message}`,
                    data: { documentNumber },
                });
            }
        }
    }
}
