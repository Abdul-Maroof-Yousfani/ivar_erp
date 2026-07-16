import * as path from 'path';
import * as XLSX from 'xlsx';

function main() {
  const filePath = path.join(__dirname, '../IMPORT MIS.xls');
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

  const headers: string[] = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
    headers.push(cell ? String(cell.v).trim() : `COL_${C}`);
  }

  console.log('IMPORT MIS.xls headers:', headers);
  console.log('Total rows:', range.e.r - range.s.r);

  // Search for DHAZ-260707-00010
  const subIdx = headers.indexOf('SUB');
  if (subIdx !== -1) {
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: subIdx })];
      if (cell && String(cell.v) === 'DHAZ-260707-00010') {
        const rowObj: any = { _rowNum: R + 1 };
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const c = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
          if (c && c.v !== null && c.v !== undefined) {
            rowObj[headers[C]] = c.w !== undefined ? c.w : c.v;
          }
        }
        console.log('Found row:', rowObj);
      }
    }
  }
}

main();
