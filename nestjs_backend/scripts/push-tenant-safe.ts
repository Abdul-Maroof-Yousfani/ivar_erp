import 'dotenv/config';
import { execSync } from 'child_process';

const tenantUrl = 'postgresql://postgres:admin@localhost:5432/tenant_ivar?schema=public';
console.log('Running safe prisma db push on tenant_ivar...');

const env = { ...process.env, DATABASE_URL: tenantUrl };
try {
  execSync('bunx prisma db push --schema prisma/schema', {
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
  });
  console.log('✅ Tenant schema successfully synced!');
} catch (e: any) {
  console.error('❌ Failed:', e.message);
  process.exit(1);
}

