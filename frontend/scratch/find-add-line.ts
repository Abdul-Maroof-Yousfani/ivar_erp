import * as fs from 'fs';
import * as path from 'path';

function findText(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file === 'node_modules' || file === '.next' || file === '.git') continue;
            findText(fullPath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.toLowerCase().includes('add transaction line') || content.toLowerCase().includes('add line') || content.toLowerCase().includes('exempt')) {
                console.log('Match found in:', fullPath);
            }
        }
    }
}

findText(process.cwd());
