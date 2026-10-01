import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';

export interface StockByLocationExportOpts {
  locationId?: string;   // comma-separated location IDs (empty = all)
  warehouseId?: string;  // comma-separated warehouse IDs
  asOfDate?: string;
}

@Injectable()
export class AvailableStockByLocationExportService {
  private readonly logger = new Logger(AvailableStockByLocationExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async streamExcelByLocation(opts: StockByLocationExportOpts, res: any): Promise<void> {
    const { locationId, warehouseId, asOfDate } = opts;

    const targetDate = asOfDate ? new Date(asOfDate) : new Date();
    targetDate.setHours(23, 59, 59, 999);

    // ── 1. Resolve locations ──────────────────────────────────────────────────
    const locIds = locationId ? locationId.split(',').map(s => s.trim()).filter(Boolean) : [];

    let locations: { id: string; name: string; code: string | null }[];
    if (locIds.length > 0) {
      locations = await this.prisma.location.findMany({
        where: { id: { in: locIds }, isDeleted: false },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      });
    } else {
      locations = await this.prisma.location.findMany({
        where: { isStockLocation: true, isDeleted: false },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      });
    }

    if (locations.length === 0) {
      res.status(400).send({ status: false, message: 'No locations found.' });
      return;
    }

    const locationIds = locations.map(l => l.id);

    // ── 2. Fetch all items that have ever had stock in any of these locations ──
    const UNACCEPTED_TRANSFER_STATUSES = [
      'PENDING', 'PENDING_CHECKER', 'PENDING_AUTHORIZER', 'PENDING_APPROVER',
      'APPROVED', 'SOURCE_APPROVED', 'IN_TRANSIT', 'PARTIAL_RECEIVED',
    ];

    // unique item IDs from ledger + inventory + transit for these locations
    const [ledgerItems, invItems] = await Promise.all([
      this.prisma.stockLedger.findMany({
        where: { locationId: { in: locationIds }, createdAt: { lte: targetDate } },
        select: { itemId: true },
        distinct: ['itemId'],
      }),
      this.prisma.inventoryItem.findMany({
        where: { locationId: { in: locationIds }, status: 'AVAILABLE', createdAt: { lte: targetDate } },
        select: { itemId: true },
        distinct: ['itemId'],
      }),
    ]);

    const uniqueItemIds = [...new Set([
      ...ledgerItems.map(l => l.itemId),
      ...invItems.map(i => i.itemId),
    ])];

    if (uniqueItemIds.length === 0) {
      res.status(200).send({ status: false, message: 'No stock data found for the selected locations.' });
      return;
    }

    // ── 3. Fetch item master data ─────────────────────────────────────────────
    const items = await this.prisma.item.findMany({
      where: { OR: [{ id: { in: uniqueItemIds } }, { itemId: { in: uniqueItemIds } }] },
      include: { color: true, size: true, gender: true, category: true, division: true, brand: true, silhouette: true },
    });

    const itemMap = new Map(items.map(i => [i.id, i]));
    const allItemIds = items.map(i => i.id);

    // ── 4. Compute stock per item per location (via stockLedger) ──────────────
    const ledgerGroups = await this.prisma.stockLedger.groupBy({
      by: ['itemId', 'locationId'],
      where: {
        locationId: { in: locationIds },
        itemId: { in: allItemIds },
        createdAt: { lte: targetDate },
      },
      _sum: { qty: true },
    });

    // stockByLocMap[itemId][locationId] = qty
    const stockByLocMap = new Map<string, Map<string, number>>();
    for (const row of ledgerGroups) {
      if (!stockByLocMap.has(row.itemId)) stockByLocMap.set(row.itemId, new Map());
      stockByLocMap.get(row.itemId)!.set(row.locationId!, Number(row._sum.qty || 0));
    }

    // Fallback: inventoryItem AVAILABLE count for items without ledger
    const invGroups = await this.prisma.inventoryItem.groupBy({
      by: ['itemId', 'locationId'],
      where: {
        locationId: { in: locationIds },
        itemId: { in: allItemIds },
        status: 'AVAILABLE',
        createdAt: { lte: targetDate },
      },
      _sum: { quantity: true },
    });

    for (const row of invGroups) {
      if (!stockByLocMap.has(row.itemId)) stockByLocMap.set(row.itemId, new Map());
      const locMap = stockByLocMap.get(row.itemId)!;
      if (!locMap.has(row.locationId!)) {
        locMap.set(row.locationId!, Number(row._sum.quantity || 0));
      }
    }

    // ── 5. Build Excel ────────────────────────────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'IVAR ERP';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Stock By Location', { views: [{ state: 'frozen', ySplit: 3 }] });

    // Shortcodes for column headers (prefer code, else abbreviated name)
    const locShortcodes = locations.map(l => l.code?.trim() || l.name.slice(0, 8).toUpperCase());

    // ── Column definitions ───────────────────────────────────────────────────
    const fixedCols = [
      { header: 'Brand', key: 'brand', width: 16 },
      { header: 'Division', key: 'division', width: 14 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Gender', key: 'gender', width: 12 },
      { header: 'Silhouette', key: 'silhouette', width: 14 },
      { header: 'SKU', key: 'sku', width: 16 },
      { header: 'Article Name', key: 'articleName', width: 30 },
      { header: 'Color', key: 'color', width: 14 },
      { header: 'Size', key: 'size', width: 10 },
      { header: 'Barcode', key: 'barcode', width: 18 },
    ];

    const locColDefs = locShortcodes.map((code, i) => ({
      header: code,
      key: `loc_${i}`,
      width: Math.max(code.length + 2, 12),
    }));

    const summaryColDefs = [
      { header: 'TOTAL QTY', key: 'totalQty', width: 14 },
      { header: 'Selling Price', key: 'unitPrice', width: 16 },
      { header: 'Value (Rs.)', key: 'value', width: 18 },
    ];

    sheet.columns = [...fixedCols, ...locColDefs, ...summaryColDefs].map(col => ({
      key: col.key,
      width: col.width,
    }));

    const totalCols = fixedCols.length + locColDefs.length + summaryColDefs.length;

    // ── Row 1: Report title ───────────────────────────────────────────────────
    const titleRow = sheet.addRow(['Available Stock Summary — By Location']);
    titleRow.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleRow.height = 24;
    titleRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    });
    sheet.mergeCells(1, 1, 1, totalCols);

    // ── Row 2: Subtitle ───────────────────────────────────────────────────────
    const asOfLabel = `As of: ${targetDate.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    const subtitleRow = sheet.addRow([asOfLabel]);
    subtitleRow.font = { italic: true, size: 10, color: { argb: 'FF374151' } };
    subtitleRow.height = 16;
    sheet.mergeCells(2, 1, 2, totalCols);

    // ── Row 3: Column headers ─────────────────────────────────────────────────
    const allHeaders = [
      ...fixedCols.map(c => c.header),
      ...locShortcodes,
      ...summaryColDefs.map(c => c.header),
    ];
    const headerRow = sheet.addRow(allHeaders);
    headerRow.height = 22;
    headerRow.eachCell((cell, colNum) => {
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.alignment = { vertical: 'middle', horizontal: colNum > fixedCols.length ? 'center' : 'left', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } },
      };
    });

    // ── Data rows ─────────────────────────────────────────────────────────────
    // Group by Brand for visual separation
    const brandGroups = new Map<string, typeof items>();
    for (const item of items) {
      const brand = item.brand?.name || 'No Brand';
      if (!brandGroups.has(brand)) brandGroups.set(brand, []);
      brandGroups.get(brand)!.push(item);
    }

    const BORDER_THIN: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };

    // brand totals per location
    const grandLocTotals = new Array(locations.length).fill(0);
    let grandTotal = 0;
    let grandValue = 0;

    for (const [brandName, brandItems] of brandGroups) {
      // Brand header row
      const brandRow = sheet.addRow([brandName]);
      brandRow.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      brandRow.height = 20;
      brandRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      });
      sheet.mergeCells(brandRow.number, 1, brandRow.number, totalCols);

      const brandLocTotals = new Array(locations.length).fill(0);
      let brandTotalQty = 0;
      let brandTotalValue = 0;

      // Sort brand items by sku
      brandItems.sort((a, b) => (a.sku || '').localeCompare(b.sku || ''));

      let rowIndex = 0;
      for (const item of brandItems) {
        const locStockMap = stockByLocMap.get(item.id);
        const locQtys = locations.map(loc => {
          const q = locStockMap?.get(loc.id) ?? 0;
          return q;
        });

        const totalQty = locQtys.reduce((s, q) => s + q, 0);
        if (totalQty === 0) continue; // skip zero-stock items

        const unitPrice = item.unitPrice || 0;
        const totalValue = totalQty * unitPrice;

        const rowData = [
          item.brand?.name || '',
          item.division?.name || '',
          item.category?.name || '',
          item.gender?.name || '',
          item.silhouette?.name || '',
          item.sku || '',
          item.description || '',
          item.color?.name || '',
          item.size?.name || '',
          item.barCode || '',
          ...locQtys,
          totalQty,
          unitPrice,
          totalValue,
        ];

        const dataRow = sheet.addRow(rowData);
        dataRow.height = 18;

        const isEven = rowIndex % 2 === 0;
        dataRow.eachCell((cell, colNum) => {
          cell.border = BORDER_THIN;
          cell.font = { size: 9 };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' },
          };

          // Numeric columns — right-align
          if (colNum > fixedCols.length) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            if (typeof cell.value === 'number' && cell.value === 0) {
              cell.value = '-';
              cell.font = { ...cell.font, color: { argb: 'FFCBD5E1' } };
            }
          }

          // Selling price / value — currency
          if (colNum === fixedCols.length + locColDefs.length + 2) {
            cell.numFmt = '#,##0.00';
          }
          if (colNum === fixedCols.length + locColDefs.length + 3) {
            cell.numFmt = '#,##0.00';
          }
        });

        // Accumulate totals
        locQtys.forEach((q, i) => {
          brandLocTotals[i] += q;
          grandLocTotals[i] += q;
        });
        brandTotalQty += totalQty;
        brandTotalValue += totalValue;
        grandTotal += totalQty;
        grandValue += totalValue;
        rowIndex++;
      }

      // Brand subtotal row
      const subtotalData = [
        `${brandName} — SUBTOTAL`, '', '', '', '', '', '', '', '', '',
        ...brandLocTotals,
        brandTotalQty,
        '',
        brandTotalValue,
      ];
      const subtotalRow = sheet.addRow(subtotalData);
      subtotalRow.height = 18;
      subtotalRow.eachCell((cell, colNum) => {
        cell.font = { bold: true, size: 9, color: { argb: 'FF1E3A5F' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.border = BORDER_THIN;
        if (colNum > fixedCols.length) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        if (colNum === fixedCols.length + locColDefs.length + 3) {
          cell.numFmt = '#,##0.00';
        }
      });

      // Blank separator
      sheet.addRow([]);
    }

    // ── Grand total row ───────────────────────────────────────────────────────
    const grandData = [
      'GRAND TOTAL', '', '', '', '', '', '', '', '', '',
      ...grandLocTotals,
      grandTotal,
      '',
      grandValue,
    ];
    const grandRow = sheet.addRow(grandData);
    grandRow.height = 22;
    grandRow.eachCell((cell, colNum) => {
      cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.border = BORDER_THIN;
      if (colNum > fixedCols.length) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (colNum === fixedCols.length + locColDefs.length + 3) {
        cell.numFmt = '#,##0.00';
      }
    });

    // ── Stream response ───────────────────────────────────────────────────────
    const dateTag = targetDate.toISOString().slice(0, 10);
    const fileName = `available-stock-by-location-${dateTag}.xlsx`;

    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', `attachment; filename="${fileName}"`);
    res.header('Cache-Control', 'no-cache');

    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);

    this.logger.log(`[StockByLocation] Exported ${items.length} items across ${locations.length} locations`);
  }
}
