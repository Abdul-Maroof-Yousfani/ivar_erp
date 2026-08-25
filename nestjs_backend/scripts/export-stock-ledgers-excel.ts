import 'dotenv/config';
import { PrismaClient as ManagementClient } from '@prisma/management-client';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as crypto from 'crypto';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

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

async function getPrismaClient(): Promise<PrismaClient> {
  const explicitTenantUrl = process.env.DATABASE_URL_TENANT;
  if (explicitTenantUrl && !explicitTenantUrl.includes('ivar_managements')) {
    console.log('🔗 Connecting using explicit DATABASE_URL_TENANT...');
    const pool = new Pool({ connectionString: explicitTenantUrl });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter } as any);
  }

  const managementUrl = process.env.DATABASE_URL_MANAGEMENT || process.env.DATABASE_URL;
  const masterKey = process.env.MASTER_ENCRYPTION_KEY;

  if (managementUrl && masterKey) {
    console.log('🔍 Locating active tenant database from Management DB...');
    const mPool = new Pool({ connectionString: managementUrl });
    const mAdapter = new PrismaPg(mPool);
    const mClient = new ManagementClient({ adapter: mAdapter } as any);

    try {
      await mClient.$connect();
      const company = await mClient.company.findFirst({
        where: { status: 'active' },
      });

      if (company) {
        let connectionString = company.dbUrl;
        if (company.dbPassword) {
          try {
            const decPassword = decrypt(company.dbPassword, masterKey);
            const encUser = encodeURIComponent(company.dbUser || '');
            const encPassword = encodeURIComponent(decPassword);
            connectionString = `postgresql://${encUser}:${encPassword}@${company.dbHost || 'localhost'}:${company.dbPort || 5432}/${company.dbName}?schema=public`;
          } catch (e) {
            console.warn('⚠️ Password decryption failed, using company.dbUrl fallback');
          }
        }

        if (connectionString) {
          console.log(`✅ Connected to active tenant: ${company.name} (${company.dbName})`);
          await mClient.$disconnect();
          await mPool.end();

          const tPool = new Pool({ connectionString });
          const tAdapter = new PrismaPg(tPool);
          return new PrismaClient({ adapter: tAdapter } as any);
        }
      }
    } catch (err: any) {
      console.warn(`⚠️ Management DB lookup error: ${err.message}`);
    } finally {
      await mClient.$disconnect().catch(() => {});
      await mPool.end().catch(() => {});
    }
  }

  const defaultUrl = process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/ivar_erp?schema=public';
  console.log(`ℹ️ Falling back to default database URL...`);
  const fallbackPool = new Pool({ connectionString: defaultUrl });
  const fallbackAdapter = new PrismaPg(fallbackPool);
  return new PrismaClient({ adapter: fallbackAdapter } as any);
}

async function exportStockLedgersToExcel() {
  const args = process.argv.slice(2);
  let locationId = args[0] || '21460d83-983d-4c93-8d55-a70c56bf18fe';
  let asOfDateStr = args[1] || new Date().toISOString().slice(0, 10);
  let outputPath = args[2] || `stock-ledger-available-summary-${asOfDateStr}.xlsx`;

  if (locationId === '--all' || locationId === 'all') {
    locationId = '';
  }

  const targetDate = new Date(asOfDateStr);
  targetDate.setHours(23, 59, 59, 999);

  console.log(`========================================================================`);
  console.log(`📊 DETAILED STOCK LEDGER EXCEL GENERATOR (BARCODE / SKU / COLOR / SIZE)`);
  console.log(`========================================================================`);
  console.log(`📍 Location / Warehouse ID: ${locationId || 'All Locations & Warehouses'}`);
  console.log(`📅 Cut-off Date (As of):    ${targetDate.toISOString()}`);
  console.log(`------------------------------------------------------------------------\n`);

  const prisma = await getPrismaClient();

  try {
    let locationName = 'All Locations & Warehouses';
    if (locationId) {
      const loc = await prisma.location.findUnique({
        where: { id: locationId },
        select: { name: true, code: true },
      });
      if (loc) {
        locationName = `${loc.name} (${loc.code || 'N/A'})`;
      } else {
        const wh = await prisma.warehouse.findUnique({
          where: { id: locationId },
          select: { name: true },
        });
        if (wh) {
          locationName = `Warehouse: ${wh.name}`;
        }
      }
    }

    console.log(`🏢 Scope: ${locationName}\n`);

    // 1. Where clause for stock ledgers
    const ledgerWhere: any = { createdAt: { lte: targetDate } };
    if (locationId) {
      ledgerWhere.OR = [
        { locationId: locationId },
        { warehouseId: locationId },
      ];
    }

    // 2. Query all stock ledger entries
    console.log('🔄 Querying Stock Ledger transactions...');
    const ledgers = await prisma.stockLedger.findMany({
      where: ledgerWhere,
      include: {
        item: {
          include: {
            color: true,
            size: true,
            brand: true,
            category: true,
            division: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`✅ Found ${ledgers.length} total ledger records.\n`);

    // 3. Summarize stock per Item ID
    const summaryMap = new Map<string, {
      itemId: string;
      barCode: string;
      sku: string;
      description: string;
      color: string;
      size: string;
      brand: string;
      category: string;
      unitPrice: number;
      unitCost: number;
      totalIn: number;
      totalOut: number;
      availableQty: number;
      transitQty: number;
      reservedQty: number;
    }>();

    for (const ledger of ledgers) {
      const item = ledger.item;
      if (!item) continue;

      let row = summaryMap.get(ledger.itemId);
      if (!row) {
        row = {
          itemId: ledger.itemId,
          barCode: item.barCode || item.sku || 'N/A',
          sku: item.sku,
          description: item.description || '',
          color: item.color?.name || 'N/A',
          size: item.size?.name || 'N/A',
          brand: item.brand?.name || 'N/A',
          category: item.category?.name || 'N/A',
          unitPrice: Number(item.unitPrice || 0),
          unitCost: Number(item.unitCost || 0),
          totalIn: 0,
          totalOut: 0,
          availableQty: 0,
          transitQty: 0,
          reservedQty: 0,
        };
        summaryMap.set(ledger.itemId, row);
      }

      const qty = Number(ledger.qty || 0);
      if (qty > 0) {
        row.totalIn += qty;
      } else {
        row.totalOut += Math.abs(qty);
      }
      row.availableQty += qty;
    }

    const matchedItemIds = [...summaryMap.keys()];

    // 4. Query In-Transit stock
    console.log('🔄 Querying In-Transit Transfers...');
    const transitWhere: any = {
      createdAt: { lte: targetDate },
      status: { in: ['PENDING', 'SOURCE_APPROVED'] },
    };
    if (locationId) {
      transitWhere.OR = [
        { toLocationId: locationId },
        { toWarehouseId: locationId },
      ];
    }

    const transitItems = await prisma.transferRequestItem.findMany({
      where: {
        itemId: { in: matchedItemIds.length > 0 ? matchedItemIds : undefined },
        transferRequest: transitWhere,
      },
      select: { itemId: true, quantity: true },
    });

    for (const t of transitItems) {
      const row = summaryMap.get(t.itemId);
      if (row) {
        row.transitQty += Number(t.quantity || 0);
      }
    }

    // 5. Query Reserved Stock
    console.log('🔄 Querying Stock Reserves...');
    const reserveWhere: any = {
      createdAt: { lte: targetDate },
      OR: [{ expiresAt: null }, { expiresAt: { gte: targetDate } }],
    };
    if (locationId) {
      reserveWhere.warehouseId = locationId;
    }

    const reserveGroup = await prisma.stockReserve.groupBy({
      by: ['itemId'],
      where: {
        itemId: { in: matchedItemIds.length > 0 ? matchedItemIds : undefined },
        ...reserveWhere,
      },
      _sum: { quantity: true },
    });

    for (const r of reserveGroup) {
      const row = summaryMap.get(r.itemId);
      if (row) {
        row.reservedQty += Number(r._sum.quantity || 0);
      }
    }

    // 6. Build Excel Workbook
    console.log('📝 Generating Excel workbook...');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'IVAR ERP System';
    workbook.lastModifiedBy = 'IVAR ERP';
    workbook.created = new Date();

    // ─── TAB 1: AVAILABLE STOCK SUMMARY ──────────────────────────────────────
    const summarySheet = workbook.addWorksheet('Stock Ledger Available Summary', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
      views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }],
    });

    // Title Section
    summarySheet.mergeCells('A1:Q1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = 'IVAR ERP - Detailed Stock Ledger & Available Summary';
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 32;

    summarySheet.mergeCells('A2:Q2');
    const subtitleCell = summarySheet.getCell('A2');
    subtitleCell.value = `Scope: ${locationName}  |  As of Date: ${asOfDateStr}  |  Generated: ${new Date().toLocaleString()}`;
    subtitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(2).height = 20;

    summarySheet.addRow([]); // Blank row 3

    // Columns Configuration
    const columns = [
      { header: 'Barcode', key: 'barCode', width: 20, align: 'left' },
      { header: 'SKU / Item ID', key: 'sku', width: 24, align: 'left' },
      { header: 'Article Description', key: 'description', width: 35, align: 'left' },
      { header: 'Brand', key: 'brand', width: 18, align: 'left' },
      { header: 'Category', key: 'category', width: 18, align: 'left' },
      { header: 'Color', key: 'color', width: 16, align: 'center' },
      { header: 'Size', key: 'size', width: 12, align: 'center' },
      { header: 'Ledger IN', key: 'totalIn', width: 14, align: 'right', format: '#,##0' },
      { header: 'Ledger OUT', key: 'totalOut', width: 14, align: 'right', format: '#,##0' },
      { header: 'Available Qty', key: 'availableQty', width: 15, align: 'right', format: '#,##0' },
      { header: 'In-Transit', key: 'transitQty', width: 14, align: 'right', format: '#,##0' },
      { header: 'Stock Reserved', key: 'reservedQty', width: 15, align: 'right', format: '#,##0' },
      { header: 'Total Stock', key: 'totalStock', width: 15, align: 'right', format: '#,##0' },
      { header: 'Selling Price (Rs.)', key: 'unitPrice', width: 18, align: 'right', format: '#,##0.00' },
      { header: 'Selling Value (Rs.)', key: 'sellingValue', width: 20, align: 'right', format: '#,##0.00' },
      { header: 'Cost Price (Rs.)', key: 'unitCost', width: 18, align: 'right', format: '#,##0.00' },
      { header: 'Costing Value (Rs.)', key: 'costingValue', width: 20, align: 'right', format: '#,##0.00' },
    ];

    // Header Row 4
    const headerRow = summarySheet.getRow(4);
    columns.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = col.header;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { horizontal: col.align as any, vertical: 'middle' };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F172A' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FF475569' } },
        right: { style: 'thin', color: { argb: 'FF475569' } },
      };
    });
    headerRow.height = 24;

    // Populate Rows
    const borderThin = {
      top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    };

    let startDataRow = 5;
    let currentRowIdx = startDataRow;

    const summaryList = Array.from(summaryMap.values()).sort((a, b) => a.sku.localeCompare(b.sku));

    for (const item of summaryList) {
      const totalStock = item.availableQty + item.transitQty + item.reservedQty;
      const sellingValue = totalStock * item.unitPrice;
      const costingValue = totalStock * item.unitCost;

      const row = summarySheet.getRow(currentRowIdx);
      const isEven = (currentRowIdx % 2) === 0;
      const bgHex = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

      row.getCell(1).value = item.barCode;
      row.getCell(2).value = item.sku;
      row.getCell(3).value = item.description;
      row.getCell(4).value = item.brand;
      row.getCell(5).value = item.category;
      row.getCell(6).value = item.color;
      row.getCell(7).value = item.size;
      row.getCell(8).value = item.totalIn;
      row.getCell(9).value = item.totalOut;
      row.getCell(10).value = item.availableQty;
      row.getCell(11).value = item.transitQty;
      row.getCell(12).value = item.reservedQty;
      row.getCell(13).value = totalStock;
      row.getCell(14).value = item.unitPrice;
      row.getCell(15).value = sellingValue;
      row.getCell(16).value = item.unitCost;
      row.getCell(17).value = costingValue;

      columns.forEach((col, idx) => {
        const cell = row.getCell(idx + 1);
        cell.font = { name: 'Calibri', size: 9.5 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgHex } };
        cell.alignment = { horizontal: col.align as any, vertical: 'middle' };
        cell.border = borderThin;
        if (col.format) {
          cell.numFmt = col.format;
        }
      });

      row.height = 20;
      currentRowIdx++;
    }

    // Grand Totals Row
    const endDataRow = currentRowIdx - 1;
    const totalRow = summarySheet.getRow(currentRowIdx);

    totalRow.getCell(1).value = 'GRAND TOTALS';
    summarySheet.mergeCells(`A${currentRowIdx}:G${currentRowIdx}`);

    const totalsCols = [
      { col: 8, formula: `SUM(H${startDataRow}:H${endDataRow})`, format: '#,##0' },
      { col: 9, formula: `SUM(I${startDataRow}:I${endDataRow})`, format: '#,##0' },
      { col: 10, formula: `SUM(J${startDataRow}:J${endDataRow})`, format: '#,##0' },
      { col: 11, formula: `SUM(K${startDataRow}:K${endDataRow})`, format: '#,##0' },
      { col: 12, formula: `SUM(L${startDataRow}:L${endDataRow})`, format: '#,##0' },
      { col: 13, formula: `SUM(M${startDataRow}:M${endDataRow})`, format: '#,##0' },
      { col: 15, formula: `SUM(O${startDataRow}:O${endDataRow})`, format: '#,##0.00' },
      { col: 17, formula: `SUM(Q${startDataRow}:Q${endDataRow})`, format: '#,##0.00' },
    ];

    totalsCols.forEach(t => {
      const cell = totalRow.getCell(t.col);
      cell.value = { formula: t.formula };
      cell.numFmt = t.format;
    });

    for (let c = 1; c <= 17; c++) {
      const cell = totalRow.getCell(c);
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.alignment = { horizontal: c >= 8 ? 'right' : 'left', vertical: 'middle' };
      cell.border = {
        top: { style: 'double', color: { argb: 'FF0F172A' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    }
    totalRow.height = 24;

    // Auto-fit Column Widths
    columns.forEach((col, idx) => {
      summarySheet.getColumn(idx + 1).width = col.width;
    });

    // ─── TAB 2: DETAILED STOCK LEDGERS LOG ──────────────────────────────────
    const ledgerSheet = workbook.addWorksheet('All Stock Ledger Logs', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
      views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    });

    const ledgerCols = [
      { header: 'Ledger ID', key: 'id', width: 36, align: 'left' },
      { header: 'Date & Time', key: 'createdAt', width: 22, align: 'center' },
      { header: 'Movement Type', key: 'movementType', width: 16, align: 'center' },
      { header: 'Reference Type', key: 'referenceType', width: 20, align: 'left' },
      { header: 'Reference ID', key: 'referenceId', width: 30, align: 'left' },
      { header: 'Barcode', key: 'barCode', width: 20, align: 'left' },
      { header: 'SKU / Item ID', key: 'sku', width: 24, align: 'left' },
      { header: 'Article Description', key: 'description', width: 35, align: 'left' },
      { header: 'Color', key: 'color', width: 16, align: 'center' },
      { header: 'Size', key: 'size', width: 12, align: 'center' },
      { header: 'Quantity (+/-)', key: 'qty', width: 14, align: 'right', format: '#,##0' },
      { header: 'Unit Price (Rs.)', key: 'unitPrice', width: 18, align: 'right', format: '#,##0.00' },
      { header: 'Total Value (Rs.)', key: 'totalValue', width: 20, align: 'right', format: '#,##0.00' },
    ];

    const lHeaderRow = ledgerSheet.getRow(1);
    ledgerCols.forEach((col, idx) => {
      const cell = lHeaderRow.getCell(idx + 1);
      cell.value = col.header;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.alignment = { horizontal: col.align as any, vertical: 'middle' };
    });
    lHeaderRow.height = 24;

    let lRowIdx = 2;
    for (const entry of ledgers) {
      const item = entry.item;
      const qty = Number(entry.qty || 0);
      const unitPrice = Number(item?.unitPrice || 0);
      const totalVal = qty * unitPrice;

      const row = ledgerSheet.getRow(lRowIdx);
      row.getCell(1).value = entry.id;
      row.getCell(2).value = new Date(entry.createdAt).toLocaleString();
      row.getCell(3).value = entry.movementType;
      row.getCell(4).value = entry.referenceType;
      row.getCell(5).value = entry.referenceId;
      row.getCell(6).value = item?.barCode || item?.sku || 'N/A';
      row.getCell(7).value = item?.sku || entry.itemId;
      row.getCell(8).value = item?.description || '';
      row.getCell(9).value = item?.color?.name || 'N/A';
      row.getCell(10).value = item?.size?.name || 'N/A';
      row.getCell(11).value = qty;
      row.getCell(12).value = unitPrice;
      row.getCell(13).value = totalVal;

      ledgerCols.forEach((col, idx) => {
        const cell = row.getCell(idx + 1);
        cell.font = { name: 'Calibri', size: 9 };
        cell.alignment = { horizontal: col.align as any, vertical: 'middle' };
        if (col.format) cell.numFmt = col.format;
      });

      row.height = 18;
      lRowIdx++;
    }

    ledgerCols.forEach((col, idx) => {
      ledgerSheet.getColumn(idx + 1).width = col.width;
    });

    // Write file to disk
    const absoluteOutputPath = path.resolve(process.cwd(), outputPath);
    await workbook.xlsx.writeFile(absoluteOutputPath);

    console.log(`\n========================================================================`);
    console.log(`✨ EXCEL EXPORT GENERATED SUCCESSFULLY!`);
    console.log(`📁 File Saved At: ${absoluteOutputPath}`);
    console.log(`📊 Total Items Summarized: ${summaryList.length}`);
    console.log(`📑 Total Ledger Log Rows:  ${ledgers.length}`);
    console.log(`========================================================================\n`);

  } catch (error) {
    console.error('❌ Error generating stock ledger Excel export:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportStockLedgersToExcel();
