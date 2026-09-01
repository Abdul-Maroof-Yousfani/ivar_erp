import * as fs from 'fs';
import * as path from 'path';

function findFile(dir: string, filename: string): string | null {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file === 'node_modules' || file === '.next') continue;
            const res = findFile(fullPath, filename);
            if (res) return res;
        } else if (file.toLowerCase().includes(filename.toLowerCase())) {
            return fullPath;
        }
    }
    return null;
}

const found = findFile(process.cwd(), 'coa');
console.log('Found path:', found);
