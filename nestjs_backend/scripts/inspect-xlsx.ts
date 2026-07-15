import * as XLSX from 'xlsx';
import * as path from 'path';

function inspect() {
    const filePath = path.join(__dirname, '..', 'CHART OF ACCOUNTS.xlsx');
    console.log('Reading file:', filePath);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
        console.log('No worksheet found');
        return;
    }
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    console.log('Range:', range);
    
    const uniqueMainHeads = new Set<string>();
    const subHeadsByMainHead: { [key: string]: Set<string> } = {};
    
    let currentMainHead = '';
    let currentSubHead = '';

    for (let r = 2; r <= range.e.r; r++) {
        const getCell = (col: number) => {
            const cellRef = XLSX.utils.encode_cell({ r, c: col });
            const cell = worksheet[cellRef];
            return cell ? String(cell.v).trim() : '';
        };

        const sr = getCell(0);
        const mainHead = getCell(1);
        const subHead = getCell(2);
        const accountName = getCell(3);
        const col4 = getCell(4);

        if (mainHead) {
            currentMainHead = mainHead;
            uniqueMainHeads.add(mainHead);
        }
        if (subHead) {
            currentSubHead = subHead;
            if (!subHeadsByMainHead[currentMainHead]) {
                subHeadsByMainHead[currentMainHead] = new Set();
            }
            subHeadsByMainHead[currentMainHead].add(subHead);
        }

        if (r <= 60 || mainHead || subHead) {
            console.log(`Row ${r + 1} (Sr# ${sr}): MainHead: "${mainHead}" (Curr: "${currentMainHead}") | SubHead: "${subHead}" (Curr: "${currentSubHead}") | AccountName: "${accountName}" | Col4: "${col4}"`);
        }
    }

    console.log('\n--- Summary of Main Heads and Sub Heads ---');
    for (const main of uniqueMainHeads) {
        console.log(`Main Head: "${main}"`);
        const subs = subHeadsByMainHead[main] || new Set();
        console.log(`  Sub Heads:`, Array.from(subs));
    }
}

inspect();
