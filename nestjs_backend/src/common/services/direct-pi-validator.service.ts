import { Injectable } from '@nestjs/common';
import { DirectPiParsedRecord } from './direct-pi-csv-parser.service';

export interface DirectPiValidationError {
    row: number;
    field: string;
    value: any;
    reason: string;
}

@Injectable()
export class DirectPiValidatorService {
    /** Validate individual row fields */
    validateRecord(record: DirectPiParsedRecord, metadata?: { vendorId?: string; warehouseId?: string }): DirectPiValidationError[] {
        const errors: DirectPiValidationError[] = [];
        const { row, data } = record;

        // 1. Item identifier check (at least barcode or SKU must be provided)
        if (!data.barCode?.trim() && !data.sku?.trim()) {
            errors.push({
                row,
                field: 'barCode / sku',
                value: '',
                reason: 'Either BarCode or SKU is required to identify the item.',
            });
        }

        // 2. Quantity check
        if (data.quantity === undefined || data.quantity === null || isNaN(data.quantity)) {
            errors.push({
                row,
                field: 'quantity',
                value: data.quantity,
                reason: 'Quantity is required and must be a valid number.',
            });
        } else if (data.quantity <= 0) {
            errors.push({
                row,
                field: 'quantity',
                value: data.quantity,
                reason: 'Quantity must be greater than 0.',
            });
        }

        // 3. Unit Cost check (if provided, must be non-negative)
        if (data.unitPrice !== undefined && data.unitPrice !== null) {
            if (isNaN(data.unitPrice) || data.unitPrice < 0) {
                errors.push({
                    row,
                    field: 'unitCost',
                    value: data.unitPrice,
                    reason: 'Unit Cost must be a positive number or 0.',
                });
            }
        }

        // 4. Tax Rate check
        if (data.taxRate !== undefined && data.taxRate !== null) {
            if (isNaN(data.taxRate) || data.taxRate < 0 || data.taxRate > 100) {
                errors.push({
                    row,
                    field: 'taxRate',
                    value: data.taxRate,
                    reason: 'Tax Rate must be a percentage between 0 and 100.',
                });
            }
        }

        // 5. Discount Rate check
        if (data.discountRate !== undefined && data.discountRate !== null) {
            if (isNaN(data.discountRate) || data.discountRate < 0 || data.discountRate > 100) {
                errors.push({
                    row,
                    field: 'discountRate',
                    value: data.discountRate,
                    reason: 'Discount Rate must be a percentage between 0 and 100.',
                });
            }
        }

        // 6. Date validation helper
        const isValidDate = (dStr?: string) => {
            if (!dStr) return true;
            const parsed = new Date(dStr);
            return !isNaN(parsed.getTime());
        };

        if (data.invoiceDate && !isValidDate(data.invoiceDate)) {
            errors.push({
                row,
                field: 'invoiceDate',
                value: data.invoiceDate,
                reason: `Invalid invoice date format "${data.invoiceDate}". Use YYYY-MM-DD.`,
            });
        }

        if (data.dueDate && !isValidDate(data.dueDate)) {
            errors.push({
                row,
                field: 'dueDate',
                value: data.dueDate,
                reason: `Invalid due date format "${data.dueDate}". Use YYYY-MM-DD.`,
            });
        }

        // 7. Supplier presence check (if neither row nor metadata has supplier)
        if (!data.supplier?.trim() && !metadata?.vendorId?.trim()) {
            errors.push({
                row,
                field: 'supplier',
                value: '',
                reason: 'Supplier is required. Specify it in the Supplier column or select a Supplier in the upload modal.',
            });
        }

        return errors;
    }

    validateRecords(records: DirectPiParsedRecord[], metadata?: { vendorId?: string; warehouseId?: string }): DirectPiValidationError[] {
        return records.flatMap(r => this.validateRecord(r, metadata));
    }
}
