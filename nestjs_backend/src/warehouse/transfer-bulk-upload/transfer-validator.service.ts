import { Injectable } from '@nestjs/common';
import { TransferParsedRecord } from './transfer-csv-parser.service';

export interface TransferValidationError {
    row: number;
    field: string;
    value: any;
    reason: string;
}

@Injectable()
export class TransferValidatorService {
    /** Validate individual row fields */
    validateRecord(record: TransferParsedRecord): TransferValidationError[] {
        const errors: TransferValidationError[] = [];
        const { row, data } = record;

        if (!data.barCode?.trim() && !data.sku?.trim()) {
            errors.push({ row, field: 'barCode', value: null, reason: 'Either Barcode or SKU is required.' });
        }

        if (data.quantity === undefined || data.quantity === null) {
            errors.push({ row, field: 'quantity', value: data.quantity, reason: 'Quantity is required.' });
        } else if (data.quantity <= 0) {
            errors.push({ row, field: 'quantity', value: data.quantity, reason: 'Quantity must be greater than 0.' });
        }

        return errors;
    }

    validateRecords(records: TransferParsedRecord[]): TransferValidationError[] {
        return records.flatMap(r => this.validateRecord(r));
    }
}
