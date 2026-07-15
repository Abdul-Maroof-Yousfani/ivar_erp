import * as fs from 'fs';
import * as path from 'path';

function run() {
    const csvDir = path.join(__dirname, '..', 'uploads', 'bulk', 'coa');
    if (!fs.existsSync(csvDir)) {
        console.log('No bulk upload dir found');
        return;
    }
    const files = fs.readdirSync(csvDir).filter(f => f.endsWith('.csv'));
    if (files.length === 0) {
        console.log('No CSV files found');
        return;
    }
    const filePath = path.join(csvDir, files[0]);
    console.log('Reading from', filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
        if (line.toUpperCase().includes('DRAWING') || line.toUpperCase().includes('CAPITAL') || line.toUpperCase().includes('EQUITY')) {
            console.log(line);
        }
    }
}
run();
