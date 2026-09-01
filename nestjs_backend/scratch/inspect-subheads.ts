import * as fs from 'fs';
import * as path from 'path';

function run() {
    const filePath = path.join(__dirname, '..', 'artifacts', 'coa_dump.json');
    if (!fs.existsSync(filePath)) {
        console.log('No coa_dump.json found');
        return;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const subHeads = new Map<string, string[]>();
    
    let currentSubHead = '';
    for (const row of data) {
        if (row.subHead) currentSubHead = row.subHead;
        if (row.accountName && currentSubHead) {
            if (!subHeads.has(currentSubHead)) {
                subHeads.set(currentSubHead, []);
            }
            subHeads.get(currentSubHead)?.push(row.accountName);
        }
    }

    for (const [sh, names] of subHeads.entries()) {
        console.log(`Sub Head: "${sh}" has ${names.length} accounts:`, names.slice(0, 10), names.length > 10 ? `...and ${names.length - 10} more` : '');
    }
}
run();
