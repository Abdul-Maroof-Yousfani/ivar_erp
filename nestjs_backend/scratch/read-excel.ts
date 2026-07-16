import * as fs from 'fs';
import * as path from 'path';
import { SalesHistoryCsvParserService } from '../src/common/services/sales-history-csv-parser.service';

async function main() {
  const filePath = path.join(__dirname, '../IMPORT MIS.xls');
  const buffer = fs.readFileSync(filePath);
  const parser = new SalesHistoryCsvParserService();

  const records: any[] = [];
  await parser.parseExcelStreaming(buffer, async (record) => {
    records.push(record);
  });

  console.log('Parsed records count:', records.length);
  console.log('First 10 records:', JSON.stringify(records.slice(0, 10), null, 2));
}

main().catch(console.error);
