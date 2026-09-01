import * as path from 'path';
import * as XLSX from 'xlsx';

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

  const docNumIdx = headers.indexOf('DocumentNumber');
  console.log(`Searching for rows with DocumentNumber = 18590...`);

  if (docNumIdx !== -1) {
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: docNumIdx })];
      if (cell && String(cell.v).trim() === '18590') {
        const rowObj: any = { _rowNum: R + 1 };
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const c = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
          if (c && c.v !== null && c.v !== undefined) {
            rowObj[headers[C]] = c.w !== undefined ? c.w : c.v;
          }
        }
        console.log(`Row ${R + 1}:`, {
          DocumentNumber: rowObj['DocumentNumber'],
          DocumentDate: rowObj['DocumentDate'],
          FromDate: rowObj['FromDate'],
          SKU: rowObj['SKU'],
          BarCode: rowObj['BarCode'],
          Quantity: rowObj['Quantity'],
          UnitPrice: rowObj['UnitPrice'],
          ValueInclSalesTax: rowObj['Value Incl Sales Tax'],
          CardSale: rowObj['CardSale'],
          CashSale: rowObj['CashSale']
        });
      }
    }
  } else {
    console.error('DocumentNumber column not found');
  }
}

main();
