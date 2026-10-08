import 'dotenv/config';
import { Pool } from 'pg';
import * as crypto from 'crypto';

function decrypt(encryptedText: string, masterKeyString: string): string {
    if (!masterKeyString || masterKeyString.length < 32) {
        throw new Error('MASTER_ENCRYPTION_KEY must be at least 32 characters');
    }
    const masterKey = Buffer.from(masterKeyString.slice(0, 32), 'utf-8');
    const algorithm = 'aes-256-gcm';

    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv(algorithm, masterKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

interface CoaAccount {
    id: string;
    code: string;
    name: string;
    type: string;
    isGroup: boolean;
    parentId: string | null;
}

interface ExistingSupplier {
    id: string;
    code: string;
    name: string;
    nature: string | null;
    type: string | null;
    brand: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    contactNo: string | null;
}

// Clean name for fuzzy comparison
function normalizeName(s: string): string {
    return s.toUpperCase()
        .replace(/PAYBLE|PAYABLE|PAYEBLE/g, '')
        .replace(/CMT SERVICES|CMT|SERVICES/g, '')
        .replace(/FABRIC PURCHASED \(ON CASH\)|FABRIC|ON CASH|CASH/g, '')
        .replace(/FINISHED GOODS|ACCESSORIES|FRAGNANCE|TEXTILE TRADING|TEXTILE MILLS|TEXTILE|PACKAGES|SOLOUTION|SOLUTION/g, '')
        .replace(/[^A-Z0-9]/g, '')
        .trim();
}

async function main() {
    console.log("🚀 Starting Supplier & Chart of Accounts Synchronization...");

    const managementUrl = process.env.DATABASE_URL_MANAGEMENT || process.env.DATABASE_URL!;
    const masterKey = process.env.MASTER_ENCRYPTION_KEY!;

    const mPool = new Pool({ connectionString: managementUrl });
    const compRes = await mPool.query('SELECT * FROM "Company" WHERE status = \'active\'');
    await mPool.end();

    if (compRes.rows.length === 0) {
        console.error("❌ No active company found in management DB.");
        process.exit(1);
    }

    for (const company of compRes.rows) {
        console.log(`\n🏢 Processing Company: ${company.name} (${company.dbName})`);

        let connectionString = company.dbUrl;
        if (company.dbPassword) {
            const decPassword = decrypt(company.dbPassword, masterKey);
            connectionString = `postgresql://${encodeURIComponent(company.dbUser || '')}:${encodeURIComponent(decPassword)}@${company.dbHost || 'localhost'}:${company.dbPort || 5432}/${company.dbName}?schema=public`;
        }

        const tenantPool = new Pool({ connectionString });

        try {
            await tenantPool.query('BEGIN');

            // 1. Fetch parent payable account (code = '2001' or '20')
            let parentRes = await tenantPool.query('SELECT * FROM "ChartOfAccount" WHERE code = \'2001\' LIMIT 1');
            let parentAccount = parentRes.rows[0];
            if (!parentAccount) {
                console.log("Creating parent 2001 account...");
                const parent20Res = await tenantPool.query('SELECT * FROM "ChartOfAccount" WHERE code = \'20\' LIMIT 1');
                const parent20Id = parent20Res.rows[0]?.id || null;
                const newParent = await tenantPool.query(`
                    INSERT INTO "ChartOfAccount" ("id", "code", "name", "type", "isGroup", "parentId", "isActive", "balance", "createdAt", "updatedAt")
                    VALUES (gen_random_uuid()::text, '2001', 'Payables (Creditors)', 'LIABILITY', true, $1, true, 0, NOW(), NOW())
                    RETURNING *
                `, [parent20Id]);
                parentAccount = newParent.rows[0];
            }

            // 2. Fetch all existing COA under 2001
            const coaAccounts: CoaAccount[] = (await tenantPool.query(`
                SELECT id, code, name, type, "isGroup", "parentId" 
                FROM "ChartOfAccount" 
                WHERE code LIKE '2001%'
                ORDER BY code ASC
            `)).rows;

            // 3. Fetch all current suppliers
            const existingSuppliers: ExistingSupplier[] = (await tenantPool.query(`
                SELECT id, code, name, nature, type, brand, address, city, country, "contactNo"
                FROM "Supplier"
                ORDER BY code ASC
            `)).rows;

            console.log(`Found ${coaAccounts.length} COA accounts under 2001 and ${existingSuppliers.length} current suppliers in DB.`);

            // List of system accounts under 2001 that are NOT suppliers
            const systemAccountCodes = new Set([
                '2001', // parent group
                '20010010', // CLAIM REMAINING BALANCE
                '20010050', // EXCHANGE VOUCHERS PAYABLE
                '20010051', // CLAIM VOUCHERS PAYABLE
                '20010052', // GIFT VOUCHERS PAYABLE
                '20010053', // CREDIT VOUCHERS PAYABLE
                '20010054', // REFUND VOUCHERS PAYABLE
                '20010055', // POS INTEGRATION FEE PAYABLE
            ]);

            // Clear temporary code clashes by prefixing existing supplier codes temporarily
            await tenantPool.query(`UPDATE "Supplier" SET "code" = 'TMP_' || "code"`);

            // Track which suppliers have been mapped
            const usedSupplierIds = new Set<string>();
            const coaToSupplierMap: { coaId: string; supplierId: string; code: string; name: string }[] = [];

            // A. First pass: Map COA Payables 20010001..20010049 to existing suppliers or create them
            for (const coa of coaAccounts) {
                if (systemAccountCodes.has(coa.code)) continue;

                const coaNorm = normalizeName(coa.name);
                
                // Find matching existing supplier
                let matchedSupp = existingSuppliers.find(s => {
                    if (usedSupplierIds.has(s.id)) return false;
                    const sNorm = normalizeName(s.name);
                    return sNorm === coaNorm;
                });

                if (!matchedSupp) {
                    // Fuzzy match: partial match or word match
                    matchedSupp = existingSuppliers.find(s => {
                        if (usedSupplierIds.has(s.id)) return false;
                        const sNorm = normalizeName(s.name);
                        return sNorm.length > 3 && coaNorm.length > 3 && (sNorm.includes(coaNorm) || coaNorm.includes(sNorm));
                    });
                }

                if (matchedSupp) {
                    usedSupplierIds.add(matchedSupp.id);
                    // Update supplier code and ensure consistent details
                    await tenantPool.query(`
                        UPDATE "Supplier"
                        SET "code" = $1, "updatedAt" = NOW()
                        WHERE "id" = $2
                    `, [coa.code, matchedSupp.id]);

                    coaToSupplierMap.push({
                        coaId: coa.id,
                        supplierId: matchedSupp.id,
                        code: coa.code,
                        name: matchedSupp.name,
                    });
                    console.log(`  [Matched] COA ${coa.code} "${coa.name}" <==> Supplier "${matchedSupp.name}" (ID: ${matchedSupp.id})`);
                } else {
                    // Create new supplier for this COA account!
                    const suppName = coa.name.replace(/\s*PAYBLE|\s*PAYABLE|\s*PAYEBLE/gi, '').trim();
                    let nature = 'GOODS';
                    if (coa.name.toUpperCase().includes('CMT') || coa.name.toUpperCase().includes('PRINTING') || coa.name.toUpperCase().includes('SERVICE') || coa.name.toUpperCase().includes('CONTRACTOR')) {
                        nature = 'SERVICES';
                    } else if (coa.name.toUpperCase().includes('FABRIC')) {
                        nature = 'GOODS';
                    }

                    const newSuppRes = await tenantPool.query(`
                        INSERT INTO "Supplier" (
                            "id", "code", "brand", "name", "nature", "type", "address", "city", "country",
                            "contactNo", "openingBalance", "currentBalance", "advanceBalance", "isActive", "createdAt", "updatedAt"
                        ) VALUES (
                            gen_random_uuid()::text, $1, 'IVAR', $2, $3, 'LOCAL', 'KARACHI', 'KARACHI', 'Pakistan',
                            NULL, 0.00, 0.00, 0.00, true, NOW(), NOW()
                        ) RETURNING id
                    `, [coa.code, suppName, nature]);

                    const newId = newSuppRes.rows[0].id;
                    usedSupplierIds.add(newId);

                    coaToSupplierMap.push({
                        coaId: coa.id,
                        supplierId: newId,
                        code: coa.code,
                        name: suppName,
                    });
                    console.log(`  [Created Supplier] COA ${coa.code} "${coa.name}" ==> New Supplier "${suppName}" (ID: ${newId})`);
                }
            }

            // B. Second pass: Remaining suppliers that had no COA account in 20010001..20010049
            // Assign sequential codes starting from 20010056!
            const remainingSuppliers = existingSuppliers.filter(s => !usedSupplierIds.has(s.id));
            let nextSeq = 56;

            for (const supp of remainingSuppliers) {
                const newCode = `2001${String(nextSeq).padStart(4, '0')}`;
                nextSeq++;

                // Update supplier code
                await tenantPool.query(`
                    UPDATE "Supplier"
                    SET "code" = $1, "updatedAt" = NOW()
                    WHERE "id" = $2
                `, [newCode, supp.id]);

                // Create or find matching COA account
                let coaRes = await tenantPool.query('SELECT * FROM "ChartOfAccount" WHERE code = $1', [newCode]);
                let coaId: string;

                if (coaRes.rows.length > 0) {
                    coaId = coaRes.rows[0].id;
                    await tenantPool.query(`
                        UPDATE "ChartOfAccount"
                        SET "name" = $1, "parentId" = $2, "updatedAt" = NOW()
                        WHERE "id" = $3
                    `, [`${supp.name} PAYABLE`, parentAccount.id, coaId]);
                } else {
                    const newCoa = await tenantPool.query(`
                        INSERT INTO "ChartOfAccount" (
                            "id", "code", "name", "type", "isGroup", "parentId", "isActive", "balance", "createdAt", "updatedAt"
                        ) VALUES (
                            gen_random_uuid()::text, $1, $2, 'LIABILITY', false, $3, true, 0.00, NOW(), NOW()
                        ) RETURNING id
                    `, [newCode, `${supp.name} PAYABLE`, parentAccount.id]);
                    coaId = newCoa.rows[0].id;
                }

                usedSupplierIds.add(supp.id);
                coaToSupplierMap.push({
                    coaId,
                    supplierId: supp.id,
                    code: newCode,
                    name: supp.name,
                });
                console.log(`  [Created COA & Assigned Code] Supplier "${supp.name}" ==> Code ${newCode} & COA "${supp.name} PAYABLE"`);
            }

            // C. Link all suppliers to their respective Chart of Accounts in `_ChartOfAccountToSupplier`
            // Table structure: _ChartOfAccountToSupplier ("A" = ChartOfAccount.id, "B" = Supplier.id)
            await tenantPool.query('DELETE FROM "_ChartOfAccountToSupplier"');

            for (const pair of coaToSupplierMap) {
                await tenantPool.query(`
                    INSERT INTO "_ChartOfAccountToSupplier" ("A", "B")
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                `, [pair.coaId, pair.supplierId]);
            }

            await tenantPool.query('COMMIT');
            console.log(`\n✅ Successfully synced and linked ${coaToSupplierMap.length} Suppliers with Chart of Accounts!`);
            console.log(`Next available vendor sequential code is: 2001${String(nextSeq).padStart(4, '0')}`);

        } catch (err: any) {
            await tenantPool.query('ROLLBACK');
            console.error(`❌ Sync error for company ${company.name}:`, err);
            throw err;
        } finally {
            await tenantPool.end();
        }
    }
}

main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
