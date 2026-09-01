import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

function main() {
  const uploadDir = path.join(__dirname, '../uploads/bulk/sales-history');
  const files = fs.readdirSync(uploadDir).filter(f => f.endsWith('.xlsx'));
  console.log('Searching files:', files);

  for (const file of files) {
    const filePath = path.join(uploadDir, file);
    console.log('Checking:', file);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const headers: string[] = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
      headers.push(cell ? String(cell.v).trim() : `COL_${C}`);
    }

    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const subCell = worksheet[XLSX.utils.encode_cell({ r: R, c: headers.indexOf('SUB') })];
      if (subCell && String(subCell.v) === 'DHAZ-260707-00010') {
        const rowObj: any = { _file: file, _rowNum: R + 1 };
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
          if (cell && cell.v !== null && cell.v !== undefined) {
            rowObj[headers[C]] = cell.w !== undefined ? cell.w : cell.v;
          }
        }
        console.log('Found match:', JSON.stringify(rowObj, null, 2));
      }
    }
  }
}

main();
