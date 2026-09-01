import * as fs from 'fs';
import * as path from 'path';

function run() {
    const filePath = path.join(process.cwd(), 'components', 'finance', 'coa-bulk-upload-modal.tsx');
    if (!fs.existsSync(filePath)) {
        console.log('No file found');
        return;
    }
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    lines.forEach((line, idx) => {
        if (line.includes('onSuccess')) {
            console.log(`${idx + 1}: ${line}`);
        }
    });
}
run();
