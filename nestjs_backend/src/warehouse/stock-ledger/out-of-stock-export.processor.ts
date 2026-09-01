import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ExportHistoryService } from '../export-history/export-history.service';
import { OutOfStockReportService } from './out-of-stock-report.service';

export interface OutOfStockExportJobData {
  jobId: string;
  userId: string;
  tenantId: string;
  tenantDbUrl: string;
  locationId?: string;
  warehouseId?: string;
  brandIds?: string[];
  categoryIds?: string[];
  divisionIds?: string[];
  genderIds?: string[];
  seasonIds?: string[];
  search?: string;
  threshold?: 'zero' | 'negative' | 'low_stock' | 'all';
  minThreshold?: number;
  format: 'xlsx' | 'pdf';
  sortBy?: any;
  sortOrder?: any;
}

// ── Color styling ────────────────────────────────────────────────────────────
const SUBHEADER_BG = '1E3A5F';
const SUBHEADER_FG = 'F1F5F9';
const ALT_ROW_BG   = 'F8FAFC';
const BORDER_COLOR = 'CBD5E1';

const GROUP_COLORS: Record<string, string> = {
  'Product Details': '0F172A',
  'Location': '1E293B',
  'Pricing': '581C87',
  'Stock Balances': '991B1B',
  'Replenishment Source': '065F46',
  'Demand Velocity': '1E3A8A',
};

const COLUMNS: {
  header: string;
  key: string;
  width: number;
  group: string;
  numFmt?: string;
  align?: ExcelJS.Alignment['horizontal'];
}[] = [
  // ── 1. Product Details ──
  { header: 'SKU', key: 'sku', width: 16, group: 'Product Details', align: 'center' },
  { header: 'Barcode', key: 'barCode', width: 16, group: 'Product Details', align: 'center' },
  { header: 'Description', key: 'description', width: 32, group: 'Product Details' },
  { header: 'Brand', key: 'brand', width: 16, group: 'Product Details' },
  { header: 'Category', key: 'category', width: 16, group: 'Product Details' },
  { header: 'Division', key: 'division', width: 14, group: 'Product Details' },
  { header: 'Gender', key: 'gender', width: 12, group: 'Product Details', align: 'center' },
  { header: 'Size', key: 'size', width: 10, group: 'Product Details', align: 'center' },
  { header: 'Color', key: 'color', width: 10, group: 'Product Details', align: 'center' },
  { header: 'Season', key: 'season', width: 12, group: 'Product Details', align: 'center' },

  // ── 2. Location ──
  { header: 'Location / Warehouse Name', key: 'locationName', width: 26, group: 'Location' },
  { header: 'Code', key: 'locationCode', width: 12, group: 'Location', align: 'center' },

  // ── 3. Pricing ──
  { header: 'Retail Price (PKR)', key: 'unitPrice', width: 16, group: 'Pricing', align: 'right', numFmt: '#,##0.00' },
  { header: 'Cost Price (PKR)', key: 'unitCost', width: 16, group: 'Pricing', align: 'right', numFmt: '#,##0.00' },

  // ── 4. Stock Balances ──
  { header: 'On-Hand Qty', key: 'onHandQty', width: 14, group: 'Stock Balances', align: 'right', numFmt: '#,##0' },
  { header: 'Reserved Qty', key: 'reservedQty', width: 14, group: 'Stock Balances', align: 'right', numFmt: '#,##0' },
  { header: 'Available Qty', key: 'availableQty', width: 14, group: 'Stock Balances', align: 'right', numFmt: '#,##0' },
  { header: 'In-Transit Qty', key: 'inTransitQty', width: 14, group: 'Stock Balances', align: 'right', numFmt: '#,##0' },
  { header: 'Stock Deficit', key: 'deficitQty', width: 14, group: 'Stock Balances', align: 'right', numFmt: '#,##0' },

  // ── 5. Replenishment Source ──
  { header: 'Central Warehouse Stock', key: 'centralWarehouseQty', width: 22, group: 'Replenishment Source', align: 'right', numFmt: '#,##0' },
  { header: 'Other Outlets Stock', key: 'otherOutletsQty', width: 18, group: 'Replenishment Source', align: 'right', numFmt: '#,##0' },
  { header: 'Replenishment Action', key: 'replenishmentStatus', width: 24, group: 'Replenishment Source', align: 'center' },

  // ── 6. Demand Velocity ──
  { header: 'Last 30 Days Sales (Qty)', key: 'salesLast30Days', width: 22, group: 'Demand Velocity', align: 'right', numFmt: '#,##0' },
  { header: 'Last Sale Date', key: 'lastSaleDate', width: 18, group: 'Demand Velocity', numFmt: 'dd-mmm-yyyy', align: 'center' },
];

@Processor('out-of-stock-export')
export class OutOfStockExportProcessor {
  private readonly logger = new Logger(OutOfStockExportProcessor.name);

  constructor(
    private readonly reportService: OutOfStockReportService,
    private readonly notificationsService: NotificationsService,
    private readonly exportHistoryService: ExportHistoryService,
  ) {}

  @Process()
  async handleExport(job: Job<OutOfStockExportJobData>): Promise<void> {
    const { jobId, userId, tenantId, tenantDbUrl } = job.data;
    this.logger.log(`[OutOfStockExport ${jobId}] Starting Out-of-Stock export for user ${userId}`);

    const prisma = new PrismaService({ tenantId, tenantDbUrl } as any);
    const exportDir = path.join(process.cwd(), 'uploads', 'exports');
    fs.mkdirSync(exportDir, { recursive: true });
    const filePath = path.join(exportDir, `export-${jobId}.xlsx`);

    try {
      await job.progress(10);

      // Fetch all out-of-stock data without pagination for full export
      const reportResult = await this.reportService.getOutOfStockReport({
        ...job.data,
        page: 1,
        limit: 100000, // Export all matching items
      });

      const { data: records, summary } = reportResult;
      await job.progress(30);

      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        filename: filePath,
        useStyles: true,
        useSharedStrings: false,
      });

      const ws = workbook.addWorksheet('Out-of-Stock Items', {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
        views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
      });

      ws.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width }));

      // ── Row 1: Group headers ──
      const groups: Record<string, { start: number; end: number }> = {};
      COLUMNS.forEach((col, idx) => {
        const n = idx + 1;
        if (!groups[col.group]) groups[col.group] = { start: n, end: n };
        else groups[col.group].end = n;
      });

      const groupRow = ws.getRow(1);
      COLUMNS.forEach((col, idx) => {
        const cell = groupRow.getCell(idx + 1);
        const { start } = groups[col.group];
        if (idx + 1 === start) cell.value = col.group.toUpperCase();
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${GROUP_COLORS[col.group] ?? '1E293B'}` } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: `FF${BORDER_COLOR}` } },
          left: { style: 'thin', color: { argb: `FF${BORDER_COLOR}` } },
          bottom: { style: 'thin', color: { argb: `FF${BORDER_COLOR}` } },
          right: { style: 'thin', color: { argb: `FF${BORDER_COLOR}` } },
        };
      });
      groupRow.height = 24;
      groupRow.commit();

      // ── Row 2: Column Subheaders ──
      const headerRow = ws.getRow(2);
      COLUMNS.forEach((col, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = col.header;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${SUBHEADER_BG}` } };
        cell.font = { bold: true, color: { argb: `FF${SUBHEADER_FG}` }, size: 9 };
        cell.alignment = { horizontal: col.align ?? 'left', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: `FF${BORDER_COLOR}` } },
          left: { style: 'thin', color: { argb: `FF${BORDER_COLOR}` } },
          bottom: { style: 'medium', color: { argb: `FF${BORDER_COLOR}` } },
          right: { style: 'thin', color: { argb: `FF${BORDER_COLOR}` } },
        };
      });
      headerRow.height = 22;
      headerRow.commit();

      // ── Data Rows ──
      let rowIdx = 0;
      for (const rec of records) {
        const isAlt = rowIdx % 2 === 1;
        const dataRow = ws.getRow(rowIdx + 3);

        const replenishmentLabel =
          rec.replenishmentStatus === 'WAREHOUSE_AVAILABLE'
            ? 'WH Replenishment Available'
            : rec.replenishmentStatus === 'INTER_STORE_AVAILABLE'
            ? 'Inter-Store Transfer'
            : 'Enterprise Depleted';

        const rowData: Record<string, any> = {
          sku: rec.sku,
          barCode: rec.barCode || '',
          description: rec.description,
          brand: rec.brand,
          category: rec.category,
          division: rec.division,
          gender: rec.gender,
          size: rec.size,
          color: rec.color,
          season: rec.season,

          locationName: rec.locationName,
          locationCode: rec.locationCode,

          unitPrice: rec.unitPrice,
          unitCost: rec.unitCost,

          onHandQty: rec.onHandQty,
          reservedQty: rec.reservedQty,
          availableQty: rec.availableQty,
          inTransitQty: rec.inTransitQty,
          deficitQty: rec.deficitQty,

          centralWarehouseQty: rec.centralWarehouseQty,
          otherOutletsQty: rec.otherOutletsQty,
          replenishmentStatus: replenishmentLabel,

          salesLast30Days: rec.salesLast30Days,
          lastSaleDate: rec.lastSaleDate ? new Date(rec.lastSaleDate) : null,
        };

        COLUMNS.forEach((col, colIdx) => {
          const cell = dataRow.getCell(colIdx + 1);
          cell.value = rowData[col.key] ?? null;
          if (col.numFmt) cell.numFmt = col.numFmt;
          cell.alignment = { horizontal: col.align ?? 'left', vertical: 'middle' };

          // Highlight available quantity cell in soft red if <= 0
          if (col.key === 'availableQty' && rec.availableQty <= 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Light red
            cell.font = { bold: true, color: { argb: 'FF991B1B' }, size: 9 };
          } else if (col.key === 'replenishmentStatus') {
            const isWh = rec.replenishmentStatus === 'WAREHOUSE_AVAILABLE';
            const isInter = rec.replenishmentStatus === 'INTER_STORE_AVAILABLE';
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: isWh ? 'FFDCFCE7' : isInter ? 'FFDBEAFE' : 'FFF3F4F6' },
            };
            cell.font = {
              bold: true,
              color: { argb: isWh ? 'FF166534' : isInter ? 'FF1E40AF' : 'FF4B5563' },
              size: 9,
            };
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${isAlt ? ALT_ROW_BG : 'FFFFFF'}` } };
            cell.font = { size: 9 };
          }

          cell.border = {
            top: { style: 'hair', color: { argb: `FF${BORDER_COLOR}` } },
            left: { style: 'hair', color: { argb: `FF${BORDER_COLOR}` } },
            bottom: { style: 'hair', color: { argb: `FF${BORDER_COLOR}` } },
            right: { style: 'hair', color: { argb: `FF${BORDER_COLOR}` } },
          };
        });

        dataRow.height = 18;
        dataRow.commit();
        rowIdx++;
      }

      await job.progress(80);

      // ── Summary Tab ──
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.columns = [{ key: 'label', width: 34 }, { key: 'value', width: 36 }];

      const titleRow = summarySheet.getRow(1);
      titleRow.getCell(1).value = 'Out-of-Stock Items Report Summary';
      titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
      titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.height = 28;
      titleRow.commit();

      const summaryRows = [
        ['Export Timestamp', new Date().toLocaleString('en-PK')],
        ['Total Depleted SKUs Identified', summary.totalOutOfStockItems],
        ['Negative Stock SKUs', summary.totalNegativeStockItems],
        ['Low Stock SKUs (<= Threshold)', summary.totalLowStockItems],
        ['Replenishable from Central Warehouse', summary.replenishableFromWarehouseCount],
        ['Available in Other Outlets (Inter-Store)', summary.interStoreTransferableCount],
        ['Company-Wide Completely Depleted', summary.companyWideDepletedCount],
        ['Estimated Potential Lost Revenue (PKR)', summary.totalPotentialLostSalesValue.toLocaleString('en-PK')],
        ['Search Filter', job.data.search || '(none)'],
        ['Stock Threshold Filter', job.data.threshold || 'zero (<= 0)'],
      ];

      summaryRows.forEach(([label, value], idx) => {
        const r = summarySheet.getRow(idx + 2);
        r.getCell(1).value = label;
        r.getCell(1).font = { bold: true, size: 10 };
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF' } };
        r.getCell(2).value = value;
        r.getCell(2).font = { size: 10 };
        r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF' } };
        r.height = 18;
        r.commit();
      });

      await workbook.commit();

      // Upload and complete
      await this.exportHistoryService.completeAndUploadExport(
        prisma,
        jobId,
        filePath,
        `out-of-stock-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      await job.progress(100);
      this.logger.log(`[OutOfStockExport ${jobId}] Finished successfully (${rowIdx} items exported)`);

      await this.notificationsService.create({
        userId,
        title: 'Out-of-Stock Report Ready',
        message: `Your Out-of-Stock report with ${rowIdx.toLocaleString()} items is ready to download.`,
        category: 'export',
        priority: 'high',
        actionType: 'out-of-stock-export.ready',
        actionPayload: JSON.stringify({ jobId }),
        entityType: 'out-of-stock-export',
        entityId: jobId,
        channels: ['inApp'],
      });
    } catch (error: any) {
      this.logger.error(`[OutOfStockExport ${jobId}] FAILED: ${error.message}`, error.stack);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {}
      }

      await this.exportHistoryService.failExport(prisma, jobId);

      await this.notificationsService.create({
        userId,
        title: 'Out-of-Stock Export Failed',
        message: `Export could not be completed: ${error.message}`,
        category: 'export',
        priority: 'urgent',
        channels: ['inApp'],
      });
    } finally {
      await prisma.$disconnect();
    }
  }
}
