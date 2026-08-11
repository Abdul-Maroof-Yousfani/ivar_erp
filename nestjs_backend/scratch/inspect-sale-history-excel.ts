import * as XLSX from 'xlsx';
import * as path from 'path';

function inspect() {
    const filePath = path.join(__dirname, '../Sale History Pos 1 July to 10 Aug.xlsx');
    console.log('Reading Excel file:', filePath);
    const workbook = XLSX.readFile(filePath);
    console.log('Sheet Names:', workbook.SheetNames);

    for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);
        console.log(`\n--- Sheet: "${sheetName}" (${rawRows.length} rows) ---`);
        if (rawRows.length > 0) {
            console.log('Columns:', Object.keys(rawRows[0]));
            console.log('Sample Row 1:', JSON.stringify(rawRows[0], null, 2));
            if (rawRows.length > 1) {
                console.log('Sample Row 2:', JSON.stringify(rawRows[1], null, 2));
            }
        }
    }
}

inspect();
