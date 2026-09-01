import * as XLSX from 'xlsx';
import * as path from 'path';

function main() {
  const filePath = path.join(__dirname, '../uploads/bulk/sales-history/sales-history-upload-33cfeaaf-9c48-43d1-bcfc-5c6b34a6f03a.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const headers: string[] = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
    headers.push(cell ? String(cell.v).trim() : `COL_${C}`);
  }

  const R = 30515; // row 30516
  console.log(`ALL COLUMNS FOR ROW ${R + 1}:`);
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
    const val = cell ? (cell.w !== undefined ? cell.w : cell.v) : null;
    console.log(`Col ${C} (${headers[C]}): ${val}`);
  }
}

main();
