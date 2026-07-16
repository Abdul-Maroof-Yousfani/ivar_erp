import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { SalesHistoryCsvParserService } from '../src/common/services/sales-history-csv-parser.service';

async function main() {
  const uploadDir = path.join(__dirname, '../uploads/bulk/sales-history');
  const files = fs.readdirSync(uploadDir);
  console.log('Files in upload dir:', files);

  // Find the file we want (e.g. sales-history-upload-33cfeaaf-9c48-43d1-bcfc-5c6b34a6f03a.xlsx)
  const targetFile = files.find(f => f.includes('33cfeaaf'));
  if (!targetFile) {
    console.error('Target file not found');
    return;
  }

  const filePath = path.join(uploadDir, targetFile);
  console.log('Reading file:', filePath);
  const buffer = fs.readFileSync(filePath);

  const parser = new SalesHistoryCsvParserService();
  const matchedRecords: any[] = [];

  await parser.parseExcelStreaming(buffer, async (record) => {
    if (record.data.documentNumber === 'DHAZ-260707-00010') {
      matchedRecords.push(record);
    }
  });

  console.log('Matched records for DHAZ-260707-00010:');
  console.log(JSON.stringify(matchedRecords, null, 2));
}

main().catch(console.error);
