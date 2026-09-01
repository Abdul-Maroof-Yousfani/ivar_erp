import * as fs from 'fs';
import * as path from 'path';

function run() {
    const filePath = path.join(__dirname, '..', 'artifacts', 'coa_dump.json');
    if (!fs.existsSync(filePath)) {
        console.log('No coa_dump.json found');
        return;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const mainHeads = new Map<string, Set<string>>();
    for (const row of data) {
        if (row.mainHead) {
            if (!mainHeads.has(row.mainHead)) {
                mainHeads.set(row.mainHead, new Set());
            }
        }
    }
    
    // Fill them
    let currentMainHead = '';
    for (const row of data) {
        if (row.mainHead) currentMainHead = row.mainHead;
        if (row.subHead && currentMainHead) {
            mainHeads.get(currentMainHead)?.add(row.subHead);
        }
    }

    for (const [mh, shs] of mainHeads.entries()) {
        console.log(`Main Head: "${mh}" has ${shs.size} subheads:`, Array.from(shs));
    }
}
run();
