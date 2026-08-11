import * as fs from 'fs';
import * as path from 'path';
import { SalesHistoryCsvParserService } from '../src/common/services/sales-history-csv-parser.service';
import { SalesHistoryValidatorService } from '../src/common/services/sales-history-validator.service';

async function test() {
    const parser = new SalesHistoryCsvParserService();
    const validator = new SalesHistoryValidatorService();

    const filePath = path.join(__dirname, '../Sale History Pos 1 July to 10 Aug.xlsx');
    const buffer = fs.readFileSync(filePath);

    const records: any[] = [];
    console.log('Parsing streaming file...');
    await parser.parseFileStreaming(buffer, 'Sale History Pos 1 July to 10 Aug.xlsx', async (record) => {
        records.push(record);
    });

    console.log(`Parsed total records: ${records.length}`);

    // Group by documentNumber
    const orderMap = new Map<string, any[]>();
    for (const r of records) {
        const docNum = r.data.documentNumber || `__row_${r.row}`;
        if (!orderMap.has(docNum)) orderMap.set(docNum, []);
        orderMap.get(docNum)!.push(r);
    }
    console.log(`Total unique orders (DocumentNumbers): ${orderMap.size}`);

    // Validate records
    const errors = validator.validateRecords(records);
    console.log(`Validation errors count: ${errors.length}`);
    if (errors.length > 0) {
        console.log('Sample validation errors (first 5):', errors.slice(0, 5));
    }

    // Inspect sample parsed order
    const firstDocNum = orderMap.keys().next().value;
    console.log(`\nSample parsed order "${firstDocNum}":`);
    console.log(JSON.stringify(orderMap.get(firstDocNum), null, 2));
}

test().catch(console.error);
