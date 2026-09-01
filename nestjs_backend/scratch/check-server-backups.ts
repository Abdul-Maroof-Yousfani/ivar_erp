import * as fs from 'fs';
import * as path from 'path';

function findFiles(dir: string, ext: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(findFiles(filePath, ext));
    } else if (file.endsWith(ext)) {
      results.push(filePath);
    }
  }
  return results;
}

function main() {
  const searchDirs = [
    '/var/www/ivar_erp',
    '/var/www/ivar_erp/backup',
    '/var/www/ivar_erp/nestjs_backend',
    '/var/backups',
    '/tmp'
  ];

  console.log('Searching for backup files on the server...');
  for (const dir of searchDirs) {
    try {
      const sqlFiles = findFiles(dir, '.sql');
      const dumpFiles = findFiles(dir, '.dump');
      const gzFiles = findFiles(dir, '.gz');
      const allFiles = [...sqlFiles, ...dumpFiles, ...gzFiles];
      
      if (allFiles.length > 0) {
        console.log(`\n📁 Found backups in: ${dir}`);
        for (const file of allFiles) {
          const stat = fs.statSync(file);
          console.log(`  - ${path.basename(file)} | Size: ${(stat.size / 1024 / 1024).toFixed(2)} MB | Modified: ${stat.mtime}`);
        }
      }
    } catch (e: any) {
      // ignore
    }
  }
}

main();
