import 'dotenv/config';
import { Client } from 'pg';
import * as crypto from 'crypto';

function decrypt(encryptedText: string, masterKeyString: string): string {
  const masterKey = Buffer.from(masterKeyString.slice(0, 32), 'utf-8');
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted text format');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(parts[2], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function main() {
  const managementConnectionString = process.env.DATABASE_URL_MANAGEMENT || process.env.DATABASE_URL;
  const masterKey = process.env.MASTER_ENCRYPTION_KEY;
  if (!managementConnectionString || !masterKey) {
    console.error('DATABASE_URL_MANAGEMENT and MASTER_ENCRYPTION_KEY required in .env');
    return;
  }

  const managementClient = new Client({ connectionString: managementConnectionString });
  await managementClient.connect();

  try {
    const res = await managementClient.query('SELECT id, name, code, "dbName", "dbPassword", "dbUser" FROM "Company";');
    for (const company of res.rows) {
      if (company.dbPassword) {
        const password = decrypt(company.dbPassword, masterKey);
        console.log(`Company: ${company.name}, User: ${company.dbUser}, Password: ${password}`);
      }
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await managementClient.end();
  }
}

main().catch(console.error);
