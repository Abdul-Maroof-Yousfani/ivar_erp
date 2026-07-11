import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

function main() {
  console.log('--- SYSTEM BACKUP AND CRON CHECK ---');
  
  // 1. Check crontabs for pg_dump/backup scripts
  try {
    const cronJobs = execSync('crontab -l', { encoding: 'utf-8' });
    console.log('\n📅 User Crontab:');
    console.log(cronJobs || 'None');
  } catch (e) {
    console.log('\n📅 User Crontab: Could not read or none exists');
  }

  try {
    const systemCron = fs.readdirSync('/etc/cron.daily');
    console.log('\n📅 /etc/cron.daily jobs:');
    console.log(systemCron.join('\n'));
  } catch (e) {}

  // 2. Search for pg_dump/backup files in standard Linux locations
  const standardPaths = [
    '/var/backups',
    '/var/lib/postgresql/backups',
    '/var/lib/postgresql',
    '/home/postgres',
    '/root',
    '/var/www/backups',
    '/opt/backups'
  ];

  console.log('\n🔍 Scanning standard paths for database dumps (.sql, .dump, .tar, .backup, .gz)...');
  for (const dir of standardPaths) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      const backupFiles = files.filter(f => 
        f.endsWith('.sql') || 
        f.endsWith('.dump') || 
        f.endsWith('.tar') || 
        f.endsWith('.backup') || 
        f.endsWith('.gz')
      );
      if (backupFiles.length > 0) {
        console.log(`\n📁 Found backups in: ${dir}`);
        for (const file of backupFiles) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          console.log(`  - ${file} | Size: ${(stat.size / 1024 / 1024).toFixed(2)} MB | Modified: ${stat.mtime}`);
        }
      }
    } catch (e) {}
  }

  // 3. Check docker volumes or other PostgreSQL folders
  try {
    const pgData = execSync('find /var/lib/postgresql -name "*.sql" -o -name "*.dump" -o -name "*.backup" 2>/dev/null', { encoding: 'utf-8' });
    if (pgData) {
      console.log('\n📁 Found backup files inside /var/lib/postgresql:');
      console.log(pgData);
    }
  } catch (e) {}
}

main();
