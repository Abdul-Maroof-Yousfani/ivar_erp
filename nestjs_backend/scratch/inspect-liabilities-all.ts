import * as fs from 'fs';
import * as path from 'path';

function run() {
    const filePath = path.join(__dirname, '..', 'artifacts', 'coa_dump.json');
    if (!fs.existsSync(filePath)) {
        console.log('No coa_dump.json found');
        return;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const filtered = data.filter((row: any) => {
        return row.rowNum >= 70 && row.rowNum <= 130;
    });
    console.log(JSON.stringify(filtered, null, 2));
}
run();
