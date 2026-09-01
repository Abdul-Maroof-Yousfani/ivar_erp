import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

async function main() {
  const filePath = path.join(__dirname, '../uploads/bulk/sales-history/sales-history-upload-33cfeaaf-9c48-43d1-bcfc-5c6b34a6f03a.xlsx');
  console.log('Reading file:', filePath);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const headers: string[] = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
    headers.push(cell ? String(cell.v).trim() : `COL_${C}`);
  }

  console.log('HEADERS:', headers);

  // We want rows 30520, 30521, 30522 (which are 0-indexed index 30519, 30520, 30521)
  // Let's print rows from R = 30515 to 30525
  const rawRows: any[] = [];
  for (let R = 30515; R <= Math.min(30525, range.e.r); ++R) {
    const rowObj: any = { _rowNum: R + 1 };
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v !== null && cell.v !== undefined) {
        rowObj[headers[C]] = cell.w !== undefined ? cell.w : cell.v;
      }
    }
    rawRows.push(rowObj);
  }

  console.log('RAW ROWS AROUND THE TARGET:', JSON.stringify(rawRows, null, 2));
}

main().catch(console.error);
