import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';

export interface OnlineSalesParsedRecord {
    row: number;
    sheetName?: string;
    data: {
        orderId?: string;          // Original Shopify order name/ID, e.g. #1001
        orderedAt?: string;        // Order timestamp
        customerName?: string;
        customerPhone?: string;
        customerEmail?: string;
        customerAddress?: string;
        customerCity?: string;
        sku?: string;
        barCode?: string;
        itemTitle?: string;
        quantity?: number;
        unitPrice?: number;
        discountTotal?: number;    // Online discount amount (inclusive of sales tax)
        paymentMethod?: string;
        paymentStatus?: string;
        source?: string;
        shop?: string;
    };
}

@Injectable()
export class OnlineSalesCsvParserService {
    private readonly logger = new Logger(OnlineSalesCsvParserService.name);

    private normalizeValue(value: any): string | null {
        if (value === null || value === undefined) return null;
        const s = String(value).trim();
        const naPatterns = ['n/a', 'n / a', 'null', 'none', '-', '', '–', '—'];
        if (naPatterns.includes(s.toLowerCase())) return null;
        return s;
    }

    private parseNumber(value: any): number | null {
        const norm = this.normalizeValue(value);
        if (norm === null) return null;
        const clean = norm.replace(/,/g, '').replace(/%/g, '').trim();
        const n = parseFloat(clean);
        return isNaN(n) ? null : n;
    }

    private getValue(row: any, keys: string[]): any {
        if (!row) return null;
        for (const key of keys) {
            if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
                return row[key];
            }
            const lk = key.toLowerCase().replace(/[\s_]/g, '');
            const found = Object.keys(row).find(k => k.toLowerCase().replace(/[\s_]/g, '') === lk);
            if (found !== undefined && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== '') {
                return row[found];
            }
        }
        return null;
    }

    private isEmptyRow(row: any): boolean {
        if (!row) return true;
        const orderId = this.normalizeValue(this.getValue(row, [
            'orderId', 'orderName', 'order_id', 'Order ID', 'Order Name', 'Invoice #', 'Order #', 'Order Number', 'Name', 'Order', 'Id'
        ]));
        const sku = this.normalizeValue(this.getValue(row, [
            'sku', 'SKU', 'Item SKU', 'Lineitem sku', 'Lineitem SKU', 'Line item sku', 'Line Item SKU', 'Variant SKU', 'Product SKU', 'barCode', 'Barcode', 'Bar Code', 'Item Barcode', 'Lineitem barcode'
        ]));
        return !orderId && !sku;
    }

    private mapColumns(row: any): OnlineSalesParsedRecord['data'] {
        const orderId = this.normalizeValue(this.getValue(row, [
            'orderId', 'orderName', 'order_id', 'Order ID', 'Order Name', 'Invoice #', 'Order #', 'Order Number', 'Name', 'Order', 'Id'
        ])) ?? undefined;

        const orderedAt = this.normalizeValue(this.getValue(row, [
            'orderedAt', 'createdAt', 'ordered_at', 'created_at', 'Order Date', 'Date', 'Created at', 'Paid at', 'Fulfilled at'
        ])) ?? undefined;

        const customerName = this.normalizeValue(this.getValue(row, [
            'customerName', 'customer_name', 'Customer Name', 'Customer', 'Billing Name', 'Shipping Name', 'Client Name'
        ])) ?? undefined;

        const customerPhone = this.normalizeValue(this.getValue(row, [
            'customerPhone', 'customer_phone', 'Billing Phone', 'Shipping Phone', 'Phone', 'Contact', 'Mobile', 'Cell'
        ])) ?? undefined;

        const customerEmail = this.normalizeValue(this.getValue(row, [
            'customerEmail', 'customer_email', 'email', 'Email', 'Customer Email', 'Contact Email'
        ])) ?? undefined;

        const customerAddress = this.normalizeValue(this.getValue(row, [
            'customerAddress', 'customer_address', 'Billing Address1', 'Billing Street', 'Shipping Address1', 'Shipping Street', 'Billing Address', 'Shipping Address', 'Address', 'Street'
        ])) ?? undefined;

        const customerCity = this.normalizeValue(this.getValue(row, [
            'customerCity', 'customer_city', 'Billing City', 'Shipping City', 'City'
        ])) ?? undefined;

        const sku = this.normalizeValue(this.getValue(row, [
            'sku', 'SKU', 'Item SKU', 'Lineitem sku', 'Lineitem SKU', 'Line item sku', 'Line Item SKU', 'Variant SKU', 'Product SKU'
        ])) ?? undefined;

        const barCode = this.normalizeValue(this.getValue(row, [
            'barCode', 'Barcode', 'Bar Code', 'Item Barcode', 'Lineitem barcode', 'Lineitem Barcode', 'Line item barcode', 'Variant Barcode'
        ])) ?? undefined;

        const itemTitle = this.normalizeValue(this.getValue(row, [
            'itemTitle', 'title', 'variantTitle', 'Item Name', 'Title', 'Lineitem name', 'Line item name', 'Product Name', 'Item Description', 'Description'
        ])) ?? undefined;

        const quantity = this.parseNumber(this.getValue(row, [
            'quantity', 'Qty', 'QTY', 'Quantity', 'Lineitem quantity', 'Line item quantity', 'Lineitem qty', 'Qty Ordered'
        ])) ?? 1;

        const unitPrice = this.parseNumber(this.getValue(row, [
            'unitPrice', 'price', 'Price', 'Unit Price', 'Lineitem price', 'Line item price', 'Item Price', 'Rate'
        ])) ?? undefined;

        const discountTotal = this.parseNumber(this.getValue(row, [
            'discountTotal', 'discount', 'Discount', 'Discount Total', 'Lineitem discount', 'Line item discount', 'Discount Amount', 'Total Discount'
        ])) ?? 0;

        const paymentMethod = this.normalizeValue(this.getValue(row, [
            'paymentMethod', 'method', 'Payment Method', 'Payment Mode', 'Gateway', 'Payment Type'
        ])) ?? 'COD';

        const paymentStatus = this.normalizeValue(this.getValue(row, [
            'paymentStatus', 'financialStatus', 'Financial Status', 'Payment Status'
        ])) ?? 'paid';

        const source = this.normalizeValue(this.getValue(row, [
            'source', 'Source', 'Channel', 'App'
        ])) ?? 'Shopify';

        const shop = this.normalizeValue(this.getValue(row, [
            'shop', 'Shop', 'Store', 'Vendor', 'Location'
        ])) ?? undefined;

        return {
            orderId,
            orderedAt,
            customerName,
            customerPhone,
            customerEmail,
            customerAddress,
            customerCity,
            sku,
            barCode,
            itemTitle,
            quantity,
            unitPrice,
            discountTotal,
            paymentMethod,
            paymentStatus,
            source,
            shop,
        };
    }

    /**
     * Parse Shopify JSON Payload into OnlineSalesParsedRecord array
     */
    parseJsonPayload(payload: any): OnlineSalesParsedRecord[] {
        const records: OnlineSalesParsedRecord[] = [];
        const payloadArray = Array.isArray(payload) ? payload : [payload];

        let rowCount = 0;
        for (const item of payloadArray) {
            const shop = item.shop || item.store;
            const order = item.order || item;
            const orderId = order.orderName || order.orderId || order.id || `ORD-${Date.now()}`;
            const orderedAt = order.orderedAt || order.createdAt || item.timestamp;
            const customer = order.customer || {};
            const money = order.money || {};
            const payment = order.payment || {};
            const discounts = order.discounts || {};

            const customerName = customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Online Customer';
            const customerPhone = customer.phone;
            const customerEmail = customer.email;
            const customerAddress = customer.address || customer.correctedAddress;
            const customerCity = customer.city || customer.correctedCity;

            const lines = order.items?.lines || order.lineItems || order.items || [];
            const discountTotal = discounts.total ?? money.discountTotal ?? 0;

            if (Array.isArray(lines) && lines.length > 0) {
                for (const line of lines) {
                    rowCount++;
                    records.push({
                        row: rowCount,
                        data: {
                            orderId,
                            orderedAt,
                            customerName,
                            customerPhone,
                            customerEmail,
                            customerAddress,
                            customerCity,
                            sku: line.sku || line.barcode || line.itemCode,
                            barCode: line.barcode || line.barCode || line.sku,
                            itemTitle: line.title ? `${line.title}${line.variantTitle ? ' - ' + line.variantTitle : ''}` : undefined,
                            quantity: line.quantity ? Number(line.quantity) : 1,
                            unitPrice: line.price !== undefined ? Number(line.price) : undefined,
                            discountTotal: Number(discountTotal) / lines.length, // Distribute order-level discount evenly per line item
                            paymentMethod: payment.method || 'COD',
                            paymentStatus: payment.financialStatus || 'paid',
                            source: order.source || 'Shopify',
                            shop,
                        },
                    });
                }
            } else {
                rowCount++;
                records.push({
                    row: rowCount,
                    data: {
                        orderId,
                        orderedAt,
                        customerName,
                        customerPhone,
                        customerEmail,
                        customerAddress,
                        customerCity,
                        discountTotal: Number(discountTotal),
                        paymentMethod: payment.method || 'COD',
                        paymentStatus: payment.financialStatus || 'paid',
                        source: order.source || 'Shopify',
                        shop,
                    },
                });
            }
        }
        return records;
    }

    async parseCSVStreaming(
        fileBuffer: Buffer,
        onRecord: (record: OnlineSalesParsedRecord) => Promise<void>,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const csvString = fileBuffer.toString('utf-8');
            let rowCount = 0;

            Papa.parse(csvString, {
                header: true,
                skipEmptyLines: 'greedy',
                chunkSize: 1024 * 1024 * 2,
                chunk: async (results, parser) => {
                    parser.pause();
                    for (const row of results.data) {
                        if (!this.isEmptyRow(row)) {
                            rowCount++;
                            await onRecord({
                                row: rowCount + 1,
                                data: this.mapColumns(row),
                            });
                        }
                    }
                    parser.resume();
                },
                complete: () => {
                    this.logger.log(`Streamed ${rowCount} online sales records from CSV`);
                    resolve();
                },
                error: (error) => {
                    this.logger.error(`CSV streaming error: ${error.message}`);
                    reject(new Error(`Failed to stream CSV: ${error.message}`));
                },
            });
        });
    }

    async parseExcelStreaming(
        fileBuffer: Buffer,
        onRecord: (record: OnlineSalesParsedRecord) => Promise<void>,
    ): Promise<void> {
        try {
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            let rowCount = 0;
            for (const sheetName of workbook.SheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                if (!worksheet) continue;

                const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
                const headers: string[] = [];
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
                    headers.push(cell ? String(cell.v) : `COL_${C}`);
                }

                for (let R = range.s.r + 1; R <= range.e.r; ++R) {
                    const rowObj: any = {};
                    let hasData = false;
                    for (let C = range.s.c; C <= range.e.c; ++C) {
                        const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
                        if (cell && cell.v !== null && cell.v !== undefined) {
                            rowObj[headers[C]] = cell.w !== undefined ? cell.w : cell.v;
                            hasData = true;
                        }
                    }
                    if (hasData && !this.isEmptyRow(rowObj)) {
                        await onRecord({
                            row: rowCount + 1,
                            sheetName,
                            data: this.mapColumns(rowObj),
                        });
                        rowCount++;
                    }
                }
            }
            this.logger.log(`Processed ${rowCount} online sales records from Excel`);
        } catch (error) {
            this.logger.error(`Excel processing error: ${error.message}`);
            throw new Error(`Failed to process Excel: ${error.message}`);
        }
    }

    async parseFileStreaming(
        fileBuffer: Buffer,
        filename: string,
        onRecord: (record: OnlineSalesParsedRecord) => Promise<void>,
    ): Promise<void> {
        const ext = filename.toLowerCase().split('.').pop();
        if (ext === 'json') {
            const jsonString = fileBuffer.toString('utf-8');
            const payload = JSON.parse(jsonString);
            const records = this.parseJsonPayload(payload);
            for (const record of records) {
                await onRecord(record);
            }
            return;
        }
        if (ext === 'csv') return this.parseCSVStreaming(fileBuffer, onRecord);
        if (['xlsx', 'xls'].includes(ext as string)) return this.parseExcelStreaming(fileBuffer, onRecord);
        throw new Error(`Unsupported file format: ${ext}`);
    }
}
