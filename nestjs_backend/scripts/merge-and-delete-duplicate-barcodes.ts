import 'dotenv/config';
import { PrismaClient as ManagementClient } from '@prisma/management-client';
import { Pool, PoolClient } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as crypto from 'crypto';

function decrypt(encryptedText: string, masterKeyString: string): string {
  const masterKey = Buffer.from(masterKeyString.slice(0, 32), 'utf-8');
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}

async function getTenantPool(): Promise<Pool> {
  const managementUrl = process.env.DATABASE_URL_MANAGEMENT || process.env.DATABASE_URL;
  const masterKey = process.env.MASTER_ENCRYPTION_KEY;
  const mPool = new Pool({ connectionString: managementUrl });
  const mClient = new ManagementClient({ adapter: new PrismaPg(mPool) } as any);
  await mClient.$connect();
  const company = await mClient.company.findFirst({ where: { status: 'active' } });
  const decPassword = decrypt(company!.dbPassword!, masterKey!);
  const encUser = encodeURIComponent(company!.dbUser || '');
  const encPassword = encodeURIComponent(decPassword);
  const connectionString = `postgresql://${encUser}:${encPassword}@${company!.dbHost || 'localhost'}:${company!.dbPort || 5432}/${company!.dbName}?schema=public`;
  await mClient.$disconnect();
  await mPool.end();

  return new Pool({ connectionString });
}

interface TransferStats {
  stockLedgersTransferred: number;
  inventoryItemsTransferred: number;
  inventoryItemsMerged: number;
  transferRequestItemsTransferred: number;
  transferRequestItemsMerged: number;
  stockAdjustmentItemsTransferred: number;
  stockAdjustmentSwapItemsTransferred: number;
  salesOrderItemsTransferred: number;
  posClaimItemsTransferred: number;
  erpSalesOrderItemsTransferred: number;
  erpSalesInvoiceItemsTransferred: number;
  deliveryChallanItemsTransferred: number;
  goodsReceiptNoteItemsTransferred: number;
  landedCostItemsTransferred: number;
  purchaseInvoiceItemsTransferred: number;
  purchaseOrderItemsTransferred: number;
  purchaseRequisitionItemsTransferred: number;
  purchaseReturnItemsTransferred: number;
  vendorQuotationItemsTransferred: number;
  discountCampaignItemsTransferred: number;
  discountCampaignItemsDeleted: number;
  fabricVendorTrackersTransferred: number;
  inventoryTransactionsTransferred: number;
  stockMovementsTransferred: number;
  stockReservesTransferred: number;
  tenantItemSettingsTransferred: number;
  tenantItemSettingsDeleted: number;
  itemsDeleted: number;
}

async function mergeDuplicateBarcodes(isExecute: boolean) {
  const pool = await getTenantPool();
  const client: PoolClient = await pool.connect();

  const stats: TransferStats = {
    stockLedgersTransferred: 0,
    inventoryItemsTransferred: 0,
    inventoryItemsMerged: 0,
    transferRequestItemsTransferred: 0,
    transferRequestItemsMerged: 0,
    stockAdjustmentItemsTransferred: 0,
    stockAdjustmentSwapItemsTransferred: 0,
    salesOrderItemsTransferred: 0,
    posClaimItemsTransferred: 0,
    erpSalesOrderItemsTransferred: 0,
    erpSalesInvoiceItemsTransferred: 0,
    deliveryChallanItemsTransferred: 0,
    goodsReceiptNoteItemsTransferred: 0,
    landedCostItemsTransferred: 0,
    purchaseInvoiceItemsTransferred: 0,
    purchaseOrderItemsTransferred: 0,
    purchaseRequisitionItemsTransferred: 0,
    purchaseReturnItemsTransferred: 0,
    vendorQuotationItemsTransferred: 0,
    discountCampaignItemsTransferred: 0,
    discountCampaignItemsDeleted: 0,
    fabricVendorTrackersTransferred: 0,
    inventoryTransactionsTransferred: 0,
    stockMovementsTransferred: 0,
    stockReservesTransferred: 0,
    tenantItemSettingsTransferred: 0,
    tenantItemSettingsDeleted: 0,
    itemsDeleted: 0,
  };

  try {
    console.log(`\n===============================================================`);
    console.log(`  MERGE AND DELETE DUPLICATE BARCODE ITEMS SCRIPT`);
    console.log(`  Mode: ${isExecute ? '*** EXECUTE (APPLYING PERMANENT CHANGES) ***' : '--- DRY-RUN (SIMULATION ONLY) ---'}`);
    console.log(`===============================================================\n`);

    await client.query('BEGIN');

    // 1. Fetch all distinct barcodes that have duplicates
    const duplicateGroupsRes = await client.query(`
      SELECT "barCode", COUNT(*) as cnt
      FROM "Item"
      WHERE "barCode" IS NOT NULL AND TRIM("barCode") != ''
      GROUP BY "barCode"
      HAVING COUNT(*) > 1
      ORDER BY "barCode" ASC;
    `);

    const groups = duplicateGroupsRes.rows;
    console.log(`Found ${groups.length} distinct barcodes with multiple items.\n`);

    if (groups.length === 0) {
      console.log('No duplicate barcodes found! Database is already clean.');
      await client.query('ROLLBACK');
      return;
    }

    let processedBarcodes = 0;

    for (const g of groups) {
      const barCode = g.barCode;

      // Fetch all items for this barcode ordered by updatedAt DESC, createdAt DESC, id DESC
      const itemsRes = await client.query(`
        SELECT id, "itemId", sku, "barCode", description,
               "sizeId", "colorId", "brandId", "divisionId",
               "silhouetteId", "categoryId", "subCategoryId",
               "genderId", "seasonId", "updatedAt", "createdAt"
        FROM "Item"
        WHERE "barCode" = $1
        ORDER BY "updatedAt" DESC, "createdAt" DESC, id DESC;
      `, [barCode]);

      const items = itemsRes.rows;
      const targetItem = items[0]; // Latest updated item (to KEEP)
      const obsoleteItems = items.slice(1); // Items to MERGE and DELETE
      const targetId = targetItem.id;

      for (const obs of obsoleteItems) {
        const obsId = obs.id;

        // Enrich target item if it lacks any attributes that obsolete item possessed
        await client.query(`
          UPDATE "Item"
          SET
            "sizeId" = COALESCE("sizeId", $1),
            "colorId" = COALESCE("colorId", $2),
            "brandId" = COALESCE("brandId", $3),
            "divisionId" = COALESCE("divisionId", $4),
            "silhouetteId" = COALESCE("silhouetteId", $5),
            "categoryId" = COALESCE("categoryId", $6),
            "subCategoryId" = COALESCE("subCategoryId", $7),
            "genderId" = COALESCE("genderId", $8),
            "seasonId" = COALESCE("seasonId", $9),
            description = COALESCE(NULLIF(description, ''), $10)
          WHERE id = $11;
        `, [
          obs.sizeId, obs.colorId, obs.brandId, obs.divisionId,
          obs.silhouetteId, obs.categoryId, obs.subCategoryId,
          obs.genderId, obs.seasonId, obs.description,
          targetId
        ]);

        // -------------------------------------------------------------
        // A. stock_ledgers
        // -------------------------------------------------------------
        const slRes = await client.query(`
          UPDATE stock_ledgers
          SET item_id = $1
          WHERE item_id = $2;
        `, [targetId, obsId]);
        stats.stockLedgersTransferred += slRes.rowCount || 0;

        // -------------------------------------------------------------
        // B. InventoryItem (handles unique constraint on [locationId, itemId, batchNumber, serialNumber, status])
        // -------------------------------------------------------------
        const obsInvItems = await client.query(`
          SELECT id, "locationId", "batchNumber", "serialNumber", "status", quantity
          FROM "InventoryItem"
          WHERE "itemId" = $1;
        `, [obsId]);

        for (const obsInv of obsInvItems.rows) {
          // Check if matching row already exists for target item
          const targetInv = await client.query(`
            SELECT id, quantity
            FROM "InventoryItem"
            WHERE "locationId" = $1
              AND "itemId" = $2
              AND "status" = $3
              AND ("batchNumber" IS NOT DISTINCT FROM $4)
              AND ("serialNumber" IS NOT DISTINCT FROM $5)
            LIMIT 1;
          `, [obsInv.locationId, targetId, obsInv.status, obsInv.batchNumber, obsInv.serialNumber]);

          if (targetInv.rows.length > 0) {
            // Merge quantity into existing target row and delete obsolete row
            await client.query(`
              UPDATE "InventoryItem"
              SET quantity = quantity + $1
              WHERE id = $2;
            `, [obsInv.quantity, targetInv.rows[0].id]);

            await client.query(`
              DELETE FROM "InventoryItem"
              WHERE id = $1;
            `, [obsInv.id]);

            stats.inventoryItemsMerged += 1;
          } else {
            // Update itemId to targetId directly
            await client.query(`
              UPDATE "InventoryItem"
              SET "itemId" = $1
              WHERE id = $2;
            `, [targetId, obsInv.id]);

            stats.inventoryItemsTransferred += 1;
          }
        }

        // -------------------------------------------------------------
        // C. TransferRequestItem (handles unique constraint on [transferRequestId, itemId, batchNumber])
        // -------------------------------------------------------------
        const obsTrItems = await client.query(`
          SELECT id, "transferRequestId", "batchNumber", quantity, "fulfilledQty"
          FROM "TransferRequestItem"
          WHERE "itemId" = $1;
        `, [obsId]);

        for (const obsTr of obsTrItems.rows) {
          const targetTr = await client.query(`
            SELECT id, quantity, "fulfilledQty"
            FROM "TransferRequestItem"
            WHERE "transferRequestId" = $1
              AND "itemId" = $2
              AND ("batchNumber" IS NOT DISTINCT FROM $3)
            LIMIT 1;
          `, [obsTr.transferRequestId, targetId, obsTr.batchNumber]);

          if (targetTr.rows.length > 0) {
            await client.query(`
              UPDATE "TransferRequestItem"
              SET quantity = quantity + $1,
                  "fulfilledQty" = "fulfilledQty" + $2
              WHERE id = $3;
            `, [obsTr.quantity, obsTr.fulfilledQty || 0, targetTr.rows[0].id]);

            await client.query(`
              DELETE FROM "TransferRequestItem"
              WHERE id = $1;
            `, [obsTr.id]);

            stats.transferRequestItemsMerged += 1;
          } else {
            await client.query(`
              UPDATE "TransferRequestItem"
              SET "itemId" = $1
              WHERE id = $2;
            `, [targetId, obsTr.id]);

            stats.transferRequestItemsTransferred += 1;
          }
        }

        // -------------------------------------------------------------
        // D. stock_adjustment_items (item_id & swap_item_id)
        // -------------------------------------------------------------
        const saiRes = await client.query(`
          UPDATE stock_adjustment_items
          SET item_id = $1
          WHERE item_id = $2;
        `, [targetId, obsId]);
        stats.stockAdjustmentItemsTransferred += saiRes.rowCount || 0;

        const swapRes = await client.query(`
          UPDATE stock_adjustment_items
          SET swap_item_id = $1
          WHERE swap_item_id = $2;
        `, [targetId, obsId]);
        stats.stockAdjustmentSwapItemsTransferred += swapRes.rowCount || 0;

        // -------------------------------------------------------------
        // E. sales_order_items
        // -------------------------------------------------------------
        const soiRes = await client.query(`
          UPDATE sales_order_items
          SET item_id = $1
          WHERE item_id = $2;
        `, [targetId, obsId]);
        stats.salesOrderItemsTransferred += soiRes.rowCount || 0;

        // -------------------------------------------------------------
        // F. pos_claim_items
        // -------------------------------------------------------------
        const pciRes = await client.query(`
          UPDATE pos_claim_items
          SET item_id = $1
          WHERE item_id = $2;
        `, [targetId, obsId]);
        stats.posClaimItemsTransferred += pciRes.rowCount || 0;

        // -------------------------------------------------------------
        // G. erp_sales_order_items, erp_sales_invoice_items, delivery_challan_items
        // -------------------------------------------------------------
        const erpSoRes = await client.query(`
          UPDATE erp_sales_order_items
          SET "itemId" = $1
          WHERE "itemId" = $2;
        `, [targetId, obsId]);
        stats.erpSalesOrderItemsTransferred += erpSoRes.rowCount || 0;

        const erpSiRes = await client.query(`
          UPDATE erp_sales_invoice_items
          SET "itemId" = $1
          WHERE "itemId" = $2;
        `, [targetId, obsId]);
        stats.erpSalesInvoiceItemsTransferred += erpSiRes.rowCount || 0;

        const dcRes = await client.query(`
          UPDATE delivery_challan_items
          SET "itemId" = $1
          WHERE "itemId" = $2;
        `, [targetId, obsId]);
        stats.deliveryChallanItemsTransferred += dcRes.rowCount || 0;

        // -------------------------------------------------------------
        // H. purchase tables: goods_receipt_note_items, landed_cost_items,
        //    purchase_invoice_items, purchase_order_items, purchase_requisition_items,
        //    purchase_return_items, vendor_quotation_items
        // -------------------------------------------------------------
        const grnRes = await client.query(`
          UPDATE goods_receipt_note_items
          SET item_id = $1
          WHERE item_id = $2;
        `, [targetId, obsId]);
        stats.goodsReceiptNoteItemsTransferred += grnRes.rowCount || 0;

        const lcRes = await client.query(`
          UPDATE landed_cost_items
          SET item_id = $1
          WHERE item_id = $2;
        `, [targetId, obsId]);
        stats.landedCostItemsTransferred += lcRes.rowCount || 0;

        const piRes = await client.query(`
          UPDATE purchase_invoice_items
          SET item_id = $1
          WHERE item_id = $2;
        `, [targetId, obsId]);
        stats.purchaseInvoiceItemsTransferred += piRes.rowCount || 0;

        const poRes = await client.query(`
          UPDATE purchase_order_items
          SET item_id = $1
          WHERE item_id = $2;
        `, [targetId, obsId]);
        stats.purchaseOrderItemsTransferred += poRes.rowCount || 0;

        const prqRes = await client.query(`
          UPDATE purchase_requisition_items
          SET item_id = $1
          WHERE item_id = $2;
        `, [targetId, obsId]);
        stats.purchaseRequisitionItemsTransferred += prqRes.rowCount || 0;

        const prtRes = await client.query(`
          UPDATE purchase_return_items
          SET item_id = $1
          WHERE item_id = $2;
        `, [targetId, obsId]);
        stats.purchaseReturnItemsTransferred += prtRes.rowCount || 0;

        const vqRes = await client.query(`
          UPDATE vendor_quotation_items
          SET "itemId" = $1
          WHERE "itemId" = $2;
        `, [targetId, obsId]);
        stats.vendorQuotationItemsTransferred += vqRes.rowCount || 0;

        // -------------------------------------------------------------
        // I. discount_campaign_items (unique on [campaign_id, item_id])
        // -------------------------------------------------------------
        const dciObs = await client.query(`
          SELECT id, campaign_id
          FROM discount_campaign_items
          WHERE item_id = $1;
        `, [obsId]);

        for (const d of dciObs.rows) {
          const match = await client.query(`
            SELECT id FROM discount_campaign_items
            WHERE campaign_id = $1 AND item_id = $2;
          `, [d.campaign_id, targetId]);

          if (match.rows.length > 0) {
            await client.query(`DELETE FROM discount_campaign_items WHERE id = $1;`, [d.id]);
            stats.discountCampaignItemsDeleted += 1;
          } else {
            await client.query(`UPDATE discount_campaign_items SET item_id = $1 WHERE id = $2;`, [targetId, d.id]);
            stats.discountCampaignItemsTransferred += 1;
          }
        }

        // -------------------------------------------------------------
        // J. fabric_vendor_trackers
        // -------------------------------------------------------------
        const fvtRes = await client.query(`
          UPDATE fabric_vendor_trackers
          SET item_id = $1
          WHERE item_id = $2;
        `, [targetId, obsId]);
        stats.fabricVendorTrackersTransferred += fvtRes.rowCount || 0;

        // -------------------------------------------------------------
        // K. InventoryTransaction, StockMovement, StockReserve
        // -------------------------------------------------------------
        try {
          const itRes = await client.query(`
            UPDATE "InventoryTransaction"
            SET "itemId" = $1
            WHERE "itemId" = $2;
          `, [targetId, obsId]);
          stats.inventoryTransactionsTransferred += itRes.rowCount || 0;
        } catch (_) {}

        try {
          const smRes = await client.query(`
            UPDATE "StockMovement"
            SET "itemId" = $1
            WHERE "itemId" = $2;
          `, [targetId, obsId]);
          stats.stockMovementsTransferred += smRes.rowCount || 0;
        } catch (_) {}

        try {
          const srRes = await client.query(`
            UPDATE "StockReserve"
            SET "itemId" = $1
            WHERE "itemId" = $2;
          `, [targetId, obsId]);
          stats.stockReservesTransferred += srRes.rowCount || 0;
        } catch (_) {}

        // -------------------------------------------------------------
        // L. TenantItemSetting (unique on [itemId])
        // -------------------------------------------------------------
        try {
          const tisObs = await client.query(`
            SELECT id FROM "TenantItemSetting" WHERE "itemId" = $1;
          `, [obsId]);

          if (tisObs.rows.length > 0) {
            const tisTarget = await client.query(`
              SELECT id FROM "TenantItemSetting" WHERE "itemId" = $1;
            `, [targetId]);

            if (tisTarget.rows.length > 0) {
              await client.query(`DELETE FROM "TenantItemSetting" WHERE "itemId" = $1;`, [obsId]);
              stats.tenantItemSettingsDeleted += 1;
            } else {
              await client.query(`UPDATE "TenantItemSetting" SET "itemId" = $1 WHERE "itemId" = $2;`, [targetId, obsId]);
              stats.tenantItemSettingsTransferred += 1;
            }
          }
        } catch (_) {}

        // -------------------------------------------------------------
        // M. DELETE the obsolete Item record!
        // -------------------------------------------------------------
        const delRes = await client.query(`
          DELETE FROM "Item"
          WHERE id = $1;
        `, [obsId]);
        stats.itemsDeleted += delRes.rowCount || 0;
      }

      processedBarcodes++;
      if (processedBarcodes % 50 === 0 || processedBarcodes === groups.length) {
        console.log(`Processed ${processedBarcodes} / ${groups.length} barcodes...`);
      }
    }

    console.log(`\n---------------------------------------------------------------`);
    console.log(`  MERGE AND CLEANUP SUMMARY:`);
    console.log(`---------------------------------------------------------------`);
    console.log(`  Barcodes processed:                  ${processedBarcodes}`);
    console.log(`  Obsolete Items deleted:              ${stats.itemsDeleted}`);
    console.log(`  Stock Ledgers transferred:           ${stats.stockLedgersTransferred}`);
    console.log(`  Inventory Items transferred:         ${stats.inventoryItemsTransferred}`);
    console.log(`  Inventory Items merged (qty added):  ${stats.inventoryItemsMerged}`);
    console.log(`  Transfer Request Items transferred:  ${stats.transferRequestItemsTransferred}`);
    console.log(`  Transfer Request Items merged:       ${stats.transferRequestItemsMerged}`);
    console.log(`  Stock Adjustment Items transferred:  ${stats.stockAdjustmentItemsTransferred}`);
    console.log(`  Stock Adjustment Swap Items transferred: ${stats.stockAdjustmentSwapItemsTransferred}`);
    console.log(`  Sales Order Items transferred:       ${stats.salesOrderItemsTransferred}`);
    console.log(`  POS Claim Items transferred:         ${stats.posClaimItemsTransferred}`);
    console.log(`  ERP Sales Order Items transferred:   ${stats.erpSalesOrderItemsTransferred}`);
    console.log(`  ERP Sales Invoice Items transferred: ${stats.erpSalesInvoiceItemsTransferred}`);
    console.log(`  Delivery Challan Items transferred:  ${stats.deliveryChallanItemsTransferred}`);
    console.log(`  GRN Items transferred:               ${stats.goodsReceiptNoteItemsTransferred}`);
    console.log(`  Landed Cost Items transferred:       ${stats.landedCostItemsTransferred}`);
    console.log(`  Purchase Invoice Items transferred:  ${stats.purchaseInvoiceItemsTransferred}`);
    console.log(`  Purchase Order Items transferred:    ${stats.purchaseOrderItemsTransferred}`);
    console.log(`  Purchase Req Items transferred:      ${stats.purchaseRequisitionItemsTransferred}`);
    console.log(`  Purchase Return Items transferred:   ${stats.purchaseReturnItemsTransferred}`);
    console.log(`  Vendor Quotation Items transferred:  ${stats.vendorQuotationItemsTransferred}`);
    console.log(`  Discount Campaign Items transferred: ${stats.discountCampaignItemsTransferred}`);
    console.log(`  Discount Campaign Items deleted:     ${stats.discountCampaignItemsDeleted}`);
    console.log(`  Fabric Vendor Trackers transferred:  ${stats.fabricVendorTrackersTransferred}`);
    console.log(`  Inventory Transactions transferred:  ${stats.inventoryTransactionsTransferred}`);
    console.log(`  Stock Movements transferred:         ${stats.stockMovementsTransferred}`);
    console.log(`  Stock Reserves transferred:          ${stats.stockReservesTransferred}`);
    console.log(`  Tenant Item Settings transferred:    ${stats.tenantItemSettingsTransferred}`);
    console.log(`  Tenant Item Settings deleted:        ${stats.tenantItemSettingsDeleted}`);
    console.log(`---------------------------------------------------------------\n`);

    // Verify remaining duplicates inside the transaction
    const remainingCheck = await client.query(`
      SELECT "barCode", COUNT(*) as cnt
      FROM "Item"
      WHERE "barCode" IS NOT NULL AND TRIM("barCode") != ''
      GROUP BY "barCode"
      HAVING COUNT(*) > 1;
    `);

    console.log(`Verification: duplicate barcodes remaining = ${remainingCheck.rows.length}`);

    if (isExecute) {
      await client.query('COMMIT');
      console.log(`\n>>> TRANSACTION COMMITTED SUCCESSFULLY! All duplicate items merged and deleted. <<<\n`);
    } else {
      await client.query('ROLLBACK');
      console.log(`\n>>> DRY-RUN COMPLETE. Transaction rolled back. No database changes were made. <<<\n`);
      console.log(`To apply these changes permanently, run with: bun run scripts/merge-and-delete-duplicate-barcodes.ts --execute\n`);
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nERROR during merge execution! Transaction was rolled back:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

const isExecute = process.argv.includes('--execute') || process.argv.includes('--apply');
mergeDuplicateBarcodes(isExecute).catch(console.error);
