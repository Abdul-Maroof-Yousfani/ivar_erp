import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import {
    OnlineSalesCsvParserService,
    OnlineSalesParsedRecord,
} from '../../common/services/online-sales-csv-parser.service';
import { OnlineSalesValidatorService } from '../../common/services/online-sales-validator.service';
import { UploadEventsService } from '../../finance/item/upload-events.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { BaseUploadProcessor, BaseUploadProgress } from '../../common/processors/base-upload.processor';

@Processor('online-sales-upload')
export class OnlineSalesUploadProcessor extends BaseUploadProcessor<OnlineSalesParsedRecord> {
    constructor(
        csvParser: OnlineSalesCsvParserService,
        validator: OnlineSalesValidatorService,
        eventsService: UploadEventsService,
        notificationsService: NotificationsService,
    ) {
        super(csvParser, validator, eventsService, notificationsService, 'online-sales');
    }

    @Process()
    override async handleUpload(job: Job<any>): Promise<void> {
        return super.handleUpload(job);
    }

    protected async processBatch(
        batch: OnlineSalesParsedRecord[],
        progress: BaseUploadProgress,
        prisma: PrismaService,
    ): Promise<void> {
        // Group batch rows by orderId (Shopify order number / name, e.g. #1001)
        const orderGroups = new Map<string, OnlineSalesParsedRecord[]>();
        for (const record of batch) {
            const key = record.data.orderId || `__row_${record.row}`;
            if (!orderGroups.has(key)) orderGroups.set(key, []);
            orderGroups.get(key)!.push(record);
        }

        // Collect all SKUs / Barcodes for bulk item lookup
        const allSkus = [
            ...new Set(
                batch
                    .flatMap((r) => [r.data.sku, r.data.barCode])
                    .filter(Boolean) as string[],
            ),
        ];

        // Bulk item lookup by barCode or sku
        const items = await prisma.item.findMany({
            where: {
                OR: [
                    { barCode: { in: allSkus } },
                    { sku: { in: allSkus } },
                    { itemId: { in: allSkus } },
                ],
            },
            select: { id: true, barCode: true, sku: true, itemId: true, unitPrice: true, taxRate1: true },
        });

        const itemMap = new Map<string, typeof items[0]>();
        for (const item of items) {
            if (item.barCode) itemMap.set(item.barCode.toLowerCase().trim(), item);
            if (item.sku) itemMap.set(item.sku.toLowerCase().trim(), item);
            if (item.itemId) itemMap.set(item.itemId.toLowerCase().trim(), item);
        }

        // Online location & terminal lookup
        const onlineLoc = await prisma.location.findFirst({
            where: {
                OR: [
                    { name: { contains: 'online', mode: 'insensitive' } },
                    { code: { contains: 'online', mode: 'insensitive' } },
                    { name: { contains: 'shopify', mode: 'insensitive' } },
                ],
            },
            select: { id: true },
        });

        const defaultLoc = onlineLoc || await prisma.location.findFirst({
            select: { id: true },
        });
        const locationId = defaultLoc?.id;

        // POS terminal lookup for online outlet
        const onlinePos = await prisma.pos.findFirst({
            where: { locationId: locationId || undefined, isDeleted: false },
            orderBy: { createdAt: 'asc' },
            select: { id: true, posId: true },
        });
        const terminalId = onlinePos?.id || '578aea3a-4e1f-4d00-ac5d-19ff6d08dde7';
        const posId = onlinePos?.posId || '001';

        // Process order groups
        for (const [shopifyOrderId, rows] of orderGroups) {
            progress.processedRecords += rows.length;

            try {
                // 1. Resolve or Auto-Create Customer (search across all rows in order for first non-empty details)
                let customerId: string | null = null;
                const customerName = rows.find(r => r.data.customerName)?.data.customerName || 'Online Customer';
                const customerPhone = rows.find(r => r.data.customerPhone)?.data.customerPhone;
                const customerEmail = rows.find(r => r.data.customerEmail)?.data.customerEmail;
                const customerAddress = rows.find(r => r.data.customerAddress)?.data.customerAddress;
                const customerCity = rows.find(r => r.data.customerCity)?.data.customerCity;
                const paymentMethod = rows.find(r => r.data.paymentMethod)?.data.paymentMethod || 'COD';
                const paymentStatus = rows.find(r => r.data.paymentStatus)?.data.paymentStatus || 'paid';
                const orderedAt = rows.find(r => r.data.orderedAt)?.data.orderedAt;
                const shop = rows.find(r => r.data.shop)?.data.shop;

                if (customerPhone || customerEmail) {
                    const existingCustomer = await prisma.customer.findFirst({
                        where: {
                            OR: [
                                ...(customerPhone ? [{ contactNo: customerPhone }] : []),
                                ...(customerEmail ? [{ email: customerEmail }] : []),
                            ],
                        },
                        select: { id: true },
                    });

                    if (existingCustomer) {
                        customerId = existingCustomer.id;
                    }
                }

                if (!customerId) {
                    const code = `CUST-ONL-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
                    try {
                        const newCust = await prisma.customer.create({
                            data: {
                                code,
                                name: customerName,
                                contactNo: customerPhone || undefined,
                                email: customerEmail || undefined,
                                address: customerAddress || customerCity || undefined,
                                customerType: 'POS',
                            },
                            select: { id: true },
                        });
                        customerId = newCust.id;
                    } catch (err) {
                        this.logger.warn(`Failed to auto-create customer for ${customerName}: ${err.message}`);
                    }
                }

                // 2. Calculate Total Order Gross for Proportional Discount Distribution
                let totalOrderGross = 0;
                for (const row of rows) {
                    const d = row.data;
                    const itemKey = (d.sku || d.barCode || '').toLowerCase().trim();
                    const matchedItem = itemMap.get(itemKey);
                    const onlineUnitPrice = d.unitPrice ?? Number(matchedItem?.unitPrice || 0);
                    const qty = d.quantity && d.quantity > 0 ? d.quantity : 1;
                    totalOrderGross += onlineUnitPrice * qty;
                }

                const totalLineDiscounts = rows.reduce((sum, r) => sum + (r.data.discountTotal || 0), 0);
                const orderLevelDiscount = rows.find(r => (r.data.discountTotal || 0) > 0)?.data.discountTotal || 0;
                const isSingleDiscountApplied = rows.length > 1 && totalLineDiscounts === orderLevelDiscount && orderLevelDiscount > 0;

                // 3. Build Line Items and Perform Tax / WOST Discount Calculations
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

                let totalSubtotalWOST = 0;
                let totalDiscountWOST = 0;
                let totalTaxAmount = 0;
                let totalGrandTotal = 0;

                for (const row of rows) {
                    const d = row.data;
                    const itemKey = (d.sku || d.barCode || '').toLowerCase().trim();
                    const matchedItem = itemMap.get(itemKey);

                    if (!matchedItem) {
                        progress.errors.push({
                            row: row.row,
                            reason: `Item with SKU/Barcode "${d.sku || d.barCode || ''}" not found in IVAR ERP`,
                            data: d,
                        });
                        continue;
                    }

                    const qty = d.quantity && d.quantity > 0 ? d.quantity : 1;
                    const taxRate = Number(matchedItem.taxRate1 || 18);
                    const taxDivisor = 1 + taxRate / 100; // e.g. 1.18 for 18% tax

                    // Unit price with tax (online store catalog price)
                    const onlineUnitPrice = d.unitPrice ?? Number(matchedItem.unitPrice || 0);
                    const lineSubtotalWithTax = onlineUnitPrice * qty;

                    // Distribute discount proportionately if order-level discount, otherwise use line discount
                    let discountWithTax = d.discountTotal || 0;
                    if (isSingleDiscountApplied && totalOrderGross > 0) {
                        discountWithTax = Math.round((lineSubtotalWithTax / totalOrderGross) * orderLevelDiscount * 100) / 100;
                    }

                    // Convert Discount to WOST (Without Sales Tax) -> discount / 1.18
                    const discountWOST = Math.round((discountWithTax / taxDivisor) * 100) / 100;

                    // Tax-exclusive unit price and subtotal (WOST)
                    const lineSubtotalWOST = Math.round((lineSubtotalWithTax / taxDivisor) * 100) / 100;

                    // Net amount after discount (WOST)
                    const netSubtotalWOST = Math.max(0, lineSubtotalWOST - discountWOST);

                    // Tax amount on net subtotal
                    const lineTaxAmount = Math.round((netSubtotalWOST * (taxRate / 100)) * 100) / 100;

                    // Final Line Total (with Tax)
                    const lineTotal = netSubtotalWOST + lineTaxAmount;

                    totalSubtotalWOST += lineSubtotalWOST;
                    totalDiscountWOST += discountWOST;
                    totalTaxAmount += lineTaxAmount;
                    totalGrandTotal += lineTotal;

                    lineItems.push({
                        itemId: matchedItem.id,
                        quantity: qty,
                        unitPrice: Math.round((lineSubtotalWOST / qty) * 100) / 100,
                        discountPercent: lineSubtotalWOST > 0 ? Math.round((discountWOST / lineSubtotalWOST) * 100 * 100) / 100 : 0,
                        discountAmount: discountWOST,
                        taxPercent: taxRate,
                        taxAmount: lineTaxAmount,
                        lineTotal: Math.round(lineTotal * 100) / 100,
                    });
                }

                if (lineItems.length === 0) {
                    progress.failedRecords += rows.length;
                    continue;
                }

                // 4. Generate IVAR ERP Internal Order Number
                const now = new Date();
                const year = now.getFullYear();
                const randomSeq = Math.floor(10000 + Math.random() * 90000);
                const generatedOrderNumber = `SI-ONL-${year}-${randomSeq}`;

                // 5. Save SalesOrder
                const createdAt = orderedAt ? new Date(orderedAt) : new Date();

                // Check if this reference order already exists to update
                const existingOrder = await prisma.salesOrder.findFirst({
                    where: { referenceNumber: shopifyOrderId },
                    select: { id: true },
                });

                const orderData = {
                    locationId: locationId || null,
                    posId: posId || null,
                    terminalId: terminalId || null,
                    customerId,
                    paymentMethod: paymentMethod || 'COD',
                    paymentStatus: paymentStatus || 'paid',
                    status: 'completed',
                    subtotal: totalSubtotalWOST,
                    discountAmount: totalDiscountWOST,
                    taxAmount: totalTaxAmount,
                    grandTotal: totalGrandTotal,
                    referenceNumber: shopifyOrderId, // Original Shopify Order Name / Number (#1001)
                    notes: `Online Store: ${shop || 'Shopify'} | Ref: ${shopifyOrderId}`,
                    createdAt: !isNaN(createdAt.getTime()) ? createdAt : new Date(),
                };

                if (existingOrder) {
                    await prisma.$transaction(async (tx) => {
                        await tx.salesOrderItem.deleteMany({ where: { salesOrderId: existingOrder.id } });
                        await tx.salesOrder.update({
                            where: { id: existingOrder.id },
                            data: {
                                ...orderData,
                                items: { create: lineItems },
                            },
                        });
                    });
                } else {
                    await prisma.salesOrder.create({
                        data: {
                            ...orderData,
                            orderNumber: generatedOrderNumber,
                            items: { create: lineItems },
                        },
                    });
                }

                progress.successRecords += lineItems.length;
            } catch (error) {
                this.logger.error(`Failed to save online order "${shopifyOrderId}": ${error.message}`, error.stack);
                progress.failedRecords += rows.length;
                progress.errors.push({
                    row: rows[0].row,
                    reason: `Order import error for "${shopifyOrderId}": ${error.message}`,
                    data: { shopifyOrderId },
                });
            }
        }
    }
}
