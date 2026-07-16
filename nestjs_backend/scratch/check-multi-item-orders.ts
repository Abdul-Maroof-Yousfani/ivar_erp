import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

function main() {
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

  // Group rows by SUB (DocumentNumber)
  const orderGroups = new Map<string, any[]>();
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    const subCell = worksheet[XLSX.utils.encode_cell({ r: R, c: headers.indexOf('SUB') })];
    if (subCell && subCell.v) {
      const docNum = String(subCell.v);
      if (!orderGroups.has(docNum)) orderGroups.set(docNum, []);
      const rowObj: any = { _rowNum: R + 1 };
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell && cell.v !== null && cell.v !== undefined) {
          rowObj[headers[C]] = cell.w !== undefined ? cell.w : cell.v;
        }
      }
      orderGroups.get(docNum)!.push(rowObj);
    }
  }

  // Find multi-item orders
  let count = 0;
  for (const [docNum, rows] of orderGroups.entries()) {
    if (rows.length > 1) {
      console.log(`\nOrder: ${docNum}, Rows count: ${rows.length}`);
      for (const row of rows) {
        console.log(`  Row ${row._rowNum}: ItemCode=${row.ItemCode}, Quantity=${row.Quantity}, UnitPrice=${row.UnitPrice}, ValueInclSalesTax=${row['Value Incl Sales Tax']}, CashSale=${row.CashSale}`);
      }
      count++;
      if (count >= 5) break;
    }
  }
}

main();
