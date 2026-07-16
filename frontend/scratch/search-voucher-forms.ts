import * as fs from 'fs';
import * as path from 'path';

function searchFile(filePath: string) {
    if (!fs.existsSync(filePath)) {
        console.log('No file:', filePath);
        return;
    }
    console.log('===', path.basename(filePath), '===');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        if (line.includes('rowChildren') || line.includes('tagAccountId') || line.includes('getSharedTree')) {
            console.log(`${idx + 1}: ${line}`);
        }
    });
}

function run() {
    searchFile(path.join(process.cwd(), 'app', 'erp', 'finance', 'payment-voucher', 'components', 'payment-voucher-form.tsx'));
    searchFile(path.join(process.cwd(), 'app', 'erp', 'finance', 'receipt-voucher', 'components', 'receipt-voucher-form.tsx'));
}
run();
