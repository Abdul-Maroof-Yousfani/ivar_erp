const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../Sale History Pos 1 July to 10 Aug.xlsx');
const workbook = XLSX.readFile(filePath);

for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const json = XLSX.utils.sheet_to_json(sheet);
    console.log(`\nSheet "${name}": ${json.length} rows`);
    if (json.length > 0) {
        const allKeys = new Set();
        json.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
        console.log('All Headers:', Array.from(allKeys));
        console.log('Sample rows (first 3):');
        console.log(json.slice(0, 3));
    }
}
