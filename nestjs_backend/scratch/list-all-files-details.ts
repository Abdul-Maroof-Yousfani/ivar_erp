import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

function main() {
  const uploadDir = path.join(__dirname, '../uploads/bulk/sales-history');
  const files = fs.readdirSync(uploadDir).filter(f => f.endsWith('.xlsx'));
  console.log('ALL FILES IN DIRECTORY:', files);

  for (const file of files) {
    const filePath = path.join(uploadDir, file);
    const stats = fs.statSync(filePath);
    console.log(`\nFILE: ${file} (Size: ${stats.size} bytes)`);

    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      
      const headers: string[] = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
        headers.push(cell ? String(cell.v).trim() : `COL_${C}`);
      }
      
      console.log(`Headers (${headers.length}):`, headers.slice(0, 10).join(', ') + '...');
      console.log(`Total rows: ${range.e.r - range.s.r}`);
    } catch (err: any) {
      console.error(`Error reading ${file}:`, err.message);
    }
  }
}

main();
