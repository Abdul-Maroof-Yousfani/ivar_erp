import * as XLSX from 'xlsx';
import * as path from 'path';

function main() {
  const filePath = path.join(__dirname, '../IMPORT MIS.xls');
  console.log('Reading:', filePath);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);
  console.log('Total raw rows:', rawRows.length);
  console.log('Headers:', Object.keys(rawRows[0] || {}));
  console.log('First 10 rows:', JSON.stringify(rawRows.slice(0, 10), null, 2));
}

main();
