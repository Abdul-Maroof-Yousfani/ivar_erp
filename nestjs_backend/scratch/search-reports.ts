import * as fs from 'fs';
import * as path from 'path';

function run() {
    const filePath = path.join(__dirname, '..', 'src', 'finance', 'accounting', 'reports.service.ts');
    if (!fs.existsSync(filePath)) {
        console.log('No reports.service.ts found');
        return;
    }
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    lines.forEach((line, idx) => {
        if (line.includes('tagAccountId')) {
            console.log(`${idx + 1}: ${line}`);
        }
    });
}
run();
