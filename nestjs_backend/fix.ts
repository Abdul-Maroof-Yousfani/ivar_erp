import { Client } from 'pg';

async function run() {
  const client = new Client({
    connectionString: "postgresql://ivar:ivar123@localhost:5432/tenant_deepak_mp178tz6"
  });
  await client.connect();
  
  try {
     await client.query('ALTER TABLE "SocialSecurityContribution" OWNER TO ivar');
     console.log("Success SocialSecurityContribution");
  } catch (e) {
     console.error(e);
  }
  
  try {
     await client.query('ALTER TABLE "SocialSecurityEmployerRegistration" OWNER TO ivar');
  } catch(e) {}
  
  try {
     await client.query('ALTER TABLE "SocialSecurityEmployeeRegistration" OWNER TO ivar');
  } catch(e) {}
  
  await client.end();
}
run();
