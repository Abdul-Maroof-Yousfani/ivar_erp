// @ts-nocheck
import 'dotenv/config';
import { PrismaClient as ManagementClient } from '@prisma/management-client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import { PERMISSIONS } from '../src/config/permissions';

function parseUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: parsed.pathname.slice(1),
      username: parsed.username,
      password: parsed.password,
    };
  } catch (e) {
    return null;
  }
}

function encrypt(text: string, masterKeyString: string): string {
  if (!masterKeyString || masterKeyString.length < 32) {
    throw new Error('MASTER_ENCRYPTION_KEY must be at least 32 characters');
  }
  const masterKey = Buffer.from(masterKeyString.slice(0, 32), 'utf-8');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

async function main() {
  console.log('🚀 Starting IVAR Initial Setup & Seeding...');

  const managementUrl =
    process.env.DATABASE_URL_MANAGEMENT || process.env.DATABASE_URL;
  const masterKey = process.env.MASTER_ENCRYPTION_KEY;

  if (!managementUrl) {
    console.error('❌ DATABASE_URL_MANAGEMENT not found in .env');
    process.exit(1);
  }

  if (!masterKey) {
    console.error('❌ MASTER_ENCRYPTION_KEY not found in .env');
    process.exit(1);
  }

  const config = parseUrl(managementUrl);
  if (!config) {
    console.error('❌ Could not parse connection URL');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: managementUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new ManagementClient({ adapter } as any);

  try {
    // 1. Ensure Tenant Record Exists
    console.log('🏢 Setting up Tenant: IVAR...');
    const tenant = await prisma.tenant.upsert({
      where: { code: 'ivar' },
      update: { name: 'IVAR', isActive: true },
      create: { code: 'ivar', name: 'IVAR', isActive: true },
    });
    console.log(`   ✅ Tenant ready: ${tenant.name} (${tenant.id})`);

    // 2. Ensure Physical Database for Tenant exists
    const tenantDbName = 'tenant_ivar';
    console.log(`🗄️ Checking tenant database '${tenantDbName}'...`);
    const maintenancePool = new Pool({
      user: config.username,
      password: config.password,
      host: config.host,
      port: parseInt(config.port),
      database: 'postgres',
    });

    try {
      const checkRes = await maintenancePool.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [tenantDbName]
      );
      if (checkRes.rowCount === 0) {
        console.log(`   ✨ Creating database '${tenantDbName}'...`);
        await maintenancePool.query(`CREATE DATABASE "${tenantDbName}"`);
        console.log(`   ✅ Database '${tenantDbName}' created.`);
      } else {
        console.log(`   ℹ️ Database '${tenantDbName}' already exists.`);
      }
    } finally {
      await maintenancePool.end();
    }

    // 3. Ensure Company Record Exists
    console.log('🏢 Setting up Company: IVAR...');
    const encryptedPassword = encrypt(config.password, masterKey);
    const tenantDbUrl = `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${tenantDbName}?schema=public`;

    const company = await prisma.company.upsert({
      where: { code: 'ivar' },
      update: {
        name: 'IVAR',
        status: 'active',
        dbName: tenantDbName,
        dbUrl: tenantDbUrl,
        dbHost: config.host,
        dbPort: parseInt(config.port),
        dbUser: config.username,
        dbPassword: encryptedPassword,
        tenantId: tenant.id,
      },
      create: {
        name: 'IVAR',
        code: 'ivar',
        status: 'active',
        dbName: tenantDbName,
        dbUrl: tenantDbUrl,
        dbHost: config.host,
        dbPort: parseInt(config.port),
        dbUser: config.username,
        dbPassword: encryptedPassword,
        tenantId: tenant.id,
      },
    });
    console.log(`   ✅ Company ready: ${company.name} (${company.code})`);

    // 4. Push Schema to Tenant Database
    console.log(`🛠️ Pushing schema to '${tenantDbName}'...`);
    execSync('bunx prisma db push --schema prisma/schema', {
      env: { ...process.env, DATABASE_URL: tenantDbUrl },
      stdio: 'inherit',
      shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
    });
    console.log('   ✅ Tenant schema pushed.');

    // 5. Seed Permissions in Master DB
    console.log('🔐 Syncing permissions...');
    const permissionsData = PERMISSIONS.map((p) => ({
      name: p.name,
      module: p.module || p.name.split('.').slice(0, -1).join('.'),
      action: p.action || p.name.split('.').pop() || 'manage',
      description: p.description,
    }));

    await prisma.permission.createMany({
      data: permissionsData,
      skipDuplicates: true,
    });
    const permCount = await prisma.permission.count();
    console.log(`   ✅ Permissions total: ${permCount}`);

    // 6. Ensure Roles
    console.log('👥 Setting up roles...');
    const rolesToCreate = [
      { name: 'admin', description: 'System Administrator', isSystem: true },
      { name: 'super-admin', description: 'Super Administrator', isSystem: true },
      { name: 'hr', description: 'Human Resource Manager', isSystem: false },
      { name: 'employee', description: 'Standard Employee', isSystem: false },
    ];

    const roleMap: Record<string, any> = {};
    for (const r of rolesToCreate) {
      let role = await prisma.role.findFirst({
        where: { name: { equals: r.name, mode: 'insensitive' } },
      });
      if (!role) {
        role = await prisma.role.create({ data: r });
      }
      roleMap[r.name] = role;
    }
    console.log('   ✅ Roles verified (admin, super-admin, hr, employee)');

    // 7. Assign Permissions to admin
    console.log('🛡️ Assigning permissions to Admin role...');
    const allPerms = await prisma.permission.findMany({ select: { id: true } });
    await prisma.rolePermission.createMany({
      data: allPerms.map((p) => ({
        roleId: roleMap['admin'].id,
        permissionId: p.id,
      })),
      skipDuplicates: true,
    });
    console.log(`   ✅ Assigned all permissions to Admin role.`);

    // 8. Create Admin User: admin@ivar.com / admin@123
    console.log('👤 Creating/Updating admin user: admin@ivar.com...');
    const hashedPassword = await bcrypt.hash('admin@123', 10);
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@ivar.com' },
      update: {
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'IVAR',
        status: 'active',
        roleId: roleMap['admin'].id,
        tenantId: tenant.id,
        isFirstPassword: false,
        mustChangePassword: false,
      },
      create: {
        email: 'admin@ivar.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'IVAR',
        status: 'active',
        roleId: roleMap['admin'].id,
        tenantId: tenant.id,
        isFirstPassword: false,
        mustChangePassword: false,
      },
    });
    console.log(`   ✅ User ready: ${adminUser.email} (Password: admin@123)`);

    // 9. Seed Chart of Accounts for Tenant
    console.log('📊 Seeding Chart of Accounts for tenant...');
    try {
      execSync('bun ./scripts/chart-of-account.ts', {
        stdio: 'inherit',
        shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
      });
      console.log('   ✅ Chart of Accounts seeded.');
    } catch (e: any) {
      console.warn('   ⚠️ Chart of accounts warning:', e.message);
    }

    console.log('\n🎉 Setup completed successfully!');
    console.log('----------------------------------------------------');
    console.log('Company:   IVAR (code: ivar)');
    console.log('Tenant DB: tenant_ivar');
    console.log('Email:     admin@ivar.com');
    console.log('Password:  admin@123');
    console.log('----------------------------------------------------');
  } catch (error: any) {
    console.error('❌ Error during setup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
