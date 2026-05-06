
const fs = require('fs');
const path = require('path');

const ACTIONS_DIR = path.resolve('d:/projects/speed-limit/frontend/lib/actions');

async function cleanupFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    content = content.replace(/;import/g, ';\nimport');
    content = content.replace(/;export/g, ';\nexport');
    content = content.replace(/";import/g, '";\nimport');
    content = content.replace(/';import/g, "';\nimport");
    
    // Fix imports glued to previous lines
    content = content.replace(/([a-z0-9"']);import/gi, '$1;\nimport');
    content = content.replace(/([a-z0-9"']);export/gi, '$1;\nexport');

    // Fix imports glued to "use server"
    content = content.replace(/"use server";import/g, '"use server";\n\nimport');
    content = content.replace(/'use server';import/g, "'use server';\n\nimport");

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Cleaned: ${path.basename(filePath)}`);
    }
}

async function run() {
    const files = fs.readdirSync(ACTIONS_DIR).filter(f => f.endsWith('.ts'));
    for (const file of files) {
        if (file === 'department.ts') continue;
        await cleanupFile(path.join(ACTIONS_DIR, file));
    }
}

run();
