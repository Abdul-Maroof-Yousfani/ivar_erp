import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';

export interface DirectPiParsedRecord {
    row: number;
    sheetName?: string;
    data: {
        invoiceNumber?: string;
        invoiceDate?: string;
        dueDate?: string;
        supplier?: string;
        warehouse?: string;
        barCode?: string;
        sku?: string;
        description?: string;
        quantity?: number;
        unitPrice?: number;
        taxRate?: number;
        discountRate?: number;
        rollSize?: number;
        notes?: string;
        invoiceNotes?: string;
    };
}

@Injectable()
export class DirectPiCsvParserService {
    private readonly logger = new Logger(DirectPiCsvParserService.name);

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
        const itemIdentifier = this.normalizeValue(this.getValue(row, [
            'barCode', 'barcode', 'BarCode', 'Barcode', 'Bar Code', 'sku', 'SKU', 'Item Code', 'itemCode', 'itemId', 'Item'
        ]));
        const qty = this.normalizeValue(this.getValue(row, [
            'quantity', 'qty', 'Quantity', 'Qty', 'Units', 'quantityOrdered'
        ]));
        const invoiceNo = this.normalizeValue(this.getValue(row, [
            'invoiceNumber', 'invoiceNo', 'Invoice Number', 'Invoice No', 'Invoice#', 'Invoice'
        ]));
        return !itemIdentifier && !qty && !invoiceNo;
    }

    private mapColumns(row: any): DirectPiParsedRecord['data'] {
        const invoiceNumber = this.normalizeValue(this.getValue(row, [
            'invoiceNumber', 'invoiceNo', 'Invoice Number', 'Invoice No', 'Invoice#', 'Invoice', 'Inv No', 'Invoice Num'
        ])) ?? undefined;

        const invoiceDate = this.normalizeValue(this.getValue(row, [
            'invoiceDate', 'date', 'Invoice Date', 'Date', 'InvoiceDate', 'Bill Date', 'Doc Date'
        ])) ?? undefined;

        const dueDate = this.normalizeValue(this.getValue(row, [
            'dueDate', 'due_date', 'Due Date', 'DueDate', 'Payment Due Date'
        ])) ?? undefined;

        const supplier = this.normalizeValue(this.getValue(row, [
            'supplier', 'vendor', 'Supplier', 'Vendor', 'Supplier Name', 'Vendor Name', 'Supplier Code', 'Vendor Code', 'SupplierCode'
        ])) ?? undefined;

        const warehouse = this.normalizeValue(this.getValue(row, [
            'warehouse', 'Warehouse', 'Warehouse Name', 'Warehouse Code', 'Location', 'Store', 'Branch'
        ])) ?? undefined;

        const barCode = this.normalizeValue(this.getValue(row, [
            'barCode', 'barcode', 'BarCode', 'Barcode', 'Bar Code', 'Item Barcode', 'UPC', 'EAN'
        ])) ?? undefined;

        const sku = this.normalizeValue(this.getValue(row, [
            'sku', 'SKU', 'Item SKU', 'Item Code', 'itemCode', 'itemId', 'Item #'
        ])) ?? undefined;

        const description = this.normalizeValue(this.getValue(row, [
            'description', 'Description', 'Item Description', 'Item Name', 'Title', 'Product Name'
        ])) ?? undefined;

        const quantity = this.parseNumber(this.getValue(row, [
            'quantity', 'qty', 'Quantity', 'Qty', 'Units', 'PCS', 'Count', 'Qty Received'
        ])) ?? undefined;

        const unitPrice = this.parseNumber(this.getValue(row, [
            'unitCost', 'unit_cost', 'Unit Cost', 'UnitCost', 'Cost', 'unitPrice', 'unit_price', 'UnitPrice', 'Unit Price', 'Rate', 'Price', 'Purchase Rate'
        ])) ?? undefined;

        const taxRate = this.parseNumber(this.getValue(row, [
            'taxRate', 'tax_rate', 'Tax Rate', 'TaxRate', 'Tax %', 'Tax', 'VAT %', 'GST %', 'Sales Tax %'
        ])) ?? undefined;

        const discountRate = this.parseNumber(this.getValue(row, [
            'discountRate', 'discount_rate', 'Discount Rate', 'DiscountRate', 'Discount %', 'Discount', 'Disc %'
        ])) ?? undefined;

        const rollSize = this.parseNumber(this.getValue(row, [
            'rollSize', 'roll_size', 'Roll Size', 'RollSize', 'Roll'
        ])) ?? undefined;

        const notes = this.normalizeValue(this.getValue(row, [
            'notes', 'Notes', 'Item Notes', 'Item Remarks', 'Line Notes', 'Comment'
        ])) ?? undefined;

        const invoiceNotes = this.normalizeValue(this.getValue(row, [
            'invoiceNotes', 'invoice_notes', 'Invoice Notes', 'Invoice Remarks', 'Remarks', 'Memo'
        ])) ?? undefined;

        return {
            invoiceNumber,
            invoiceDate,
            dueDate,
            supplier,
            warehouse,
            barCode,
            sku,
            description,
            quantity,
            unitPrice,
            taxRate,
            discountRate,
            rollSize,
            notes,
            invoiceNotes,
        };
    }

    async parseCSVStreaming(
        fileBuffer: Buffer,
        onRecord: (record: DirectPiParsedRecord) => Promise<void>
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            let rowCount = 0;
            Papa.parse(fileBuffer.toString('utf-8'), {
                header: true,
                skipEmptyLines: 'greedy',
                chunkSize: 1024 * 1024 * 2,
                chunk: async (results, parser) => {
                    parser.pause();
                    for (const row of results.data) {
                        if (!this.isEmptyRow(row)) {
                            rowCount++;
                            await onRecord({
                                row: rowCount + 1, // +1 for header
                                data: this.mapColumns(row),
                            });
                        }
                    }
                    parser.resume();
                },
                complete: () => {
                    this.logger.log(`Parsed ${rowCount} Direct PI records from CSV`);
                    resolve();
                },
                error: (err) => reject(new Error(`CSV parse error: ${err.message}`)),
            });
        });
    }

    async parseExcelStreaming(
        fileBuffer: Buffer,
        onRecord: (record: DirectPiParsedRecord) => Promise<void>
    ): Promise<void> {
        const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) return;

        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        const headers: string[] = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
            headers.push(cell ? String(cell.v).trim() : `COL_${C}`);
        }

        let rowCount = 0;
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
            const rowObj: any = {};
            let hasData = false;

            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
                if (cell && cell.v !== null && cell.v !== undefined) {
                    if (cell.t === 'd' && cell.v instanceof Date) {
                        rowObj[headers[C]] = cell.v.toISOString().split('T')[0];
                    } else {
                        rowObj[headers[C]] = cell.v;
                    }
                    hasData = true;
                }
            }

            if (hasData && !this.isEmptyRow(rowObj)) {
                rowCount++;
                await onRecord({
                    row: R + 1,
                    sheetName,
                    data: this.mapColumns(rowObj),
                });
            }
        }
        this.logger.log(`Parsed ${rowCount} Direct PI records from Excel sheet "${sheetName}"`);
    }

    async parseFileStreaming(
        fileBuffer: Buffer,
        filename: string,
        onRecord: (record: DirectPiParsedRecord) => Promise<void>
    ): Promise<void> {
        const ext = filename.toLowerCase().split('.').pop();
        if (ext === 'csv') {
            return this.parseCSVStreaming(fileBuffer, onRecord);
        }
        if (['xlsx', 'xls'].includes(ext as string)) {
            return this.parseExcelStreaming(fileBuffer, onRecord);
        }
        throw new Error(`Unsupported file format: .${ext}. Allowed formats: .csv, .xlsx, .xls`);
    }
}
