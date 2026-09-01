import { Injectable, Logger } from '@nestjs/common';
import { OnlineSalesParsedRecord } from './online-sales-csv-parser.service';

export interface OnlineSalesValidationError {
    row: number;
    field: string;
    value: any;
    reason: string;
}

@Injectable()
export class OnlineSalesValidatorService {
    private readonly logger = new Logger(OnlineSalesValidatorService.name);

    validateRecord(record: OnlineSalesParsedRecord): OnlineSalesValidationError[] {
        const errors: OnlineSalesValidationError[] = [];
        const { row, data } = record;

        // Order identity check
        if (!data.orderId || data.orderId.trim() === '') {
            errors.push({
                row,
                field: 'orderId',
                value: data.orderId,
                reason: 'Order ID / Invoice reference is required',
            });
        }

        // Product SKU / barcode check
        if (!data.sku && !data.barCode) {
            errors.push({
                row,
                field: 'sku',
                value: null,
                reason: 'SKU or Barcode is required to match item in IVAR ERP',
            });
        }

        // Quantity check
        if (data.quantity !== undefined && data.quantity !== null) {
            if (!Number.isFinite(data.quantity) || data.quantity <= 0) {
                errors.push({
                    row,
                    field: 'quantity',
                    value: data.quantity,
                    reason: 'Quantity must be a positive number',
                });
            }
        }

        // Price check
        if (data.unitPrice !== undefined && data.unitPrice !== null) {
            if (!Number.isFinite(data.unitPrice) || data.unitPrice < 0) {
                errors.push({
                    row,
                    field: 'unitPrice',
                    value: data.unitPrice,
                    reason: 'Unit price must be non-negative',
                });
            }
        }

        // Discount check
        if (data.discountTotal !== undefined && data.discountTotal !== null) {
            if (!Number.isFinite(data.discountTotal) || data.discountTotal < 0) {
                errors.push({
                    row,
                    field: 'discountTotal',
                    value: data.discountTotal,
                    reason: 'Discount total must be non-negative',
                });
            }
        }

        return errors;
    }

    validateRecords(records: OnlineSalesParsedRecord[]): OnlineSalesValidationError[] {
        const allErrors: OnlineSalesValidationError[] = [];
        for (const record of records) {
            allErrors.push(...this.validateRecord(record));
        }
        return allErrors;
    }
}
