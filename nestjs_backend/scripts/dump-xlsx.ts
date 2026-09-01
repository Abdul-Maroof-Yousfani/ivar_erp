import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

function dump() {
    const filePath = path.join(__dirname, '..', 'CHART OF ACCOUNTS.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return;
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    const rows: any[] = [];
    
    for (let r = 2; r <= 256; r++) { // Row 3 to 257 (1-indexed index 2 to 256)
        const getCell = (col: number) => {
            const cellRef = XLSX.utils.encode_cell({ r, c: col });
            const cell = worksheet[cellRef];
            return cell ? String(cell.v).trim() : '';
        };

        const sr = getCell(0);
        const mainHead = getCell(1);
        const subHead = getCell(2);
        const accountName = getCell(3);
        const balance = getCell(4); // Let's check what is in column 4 or other columns

        rows.push({
            rowNum: r + 1,
            sr,
            mainHead,
            subHead,
            accountName,
            balance
        });
    }

    const outDir = path.join(__dirname, '..', 'artifacts');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
    fs.writeFileSync(path.join(outDir, 'coa_dump.json'), JSON.stringify(rows, null, 2));
    console.log('Dumped to artifacts/coa_dump.json');
}

dump();
