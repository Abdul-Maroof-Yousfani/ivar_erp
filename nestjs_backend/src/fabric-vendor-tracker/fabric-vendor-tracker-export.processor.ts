import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FabricStatus } from '@prisma/client';

export interface FabricVendorTrackerExportJobData {
  jobId: string;
  userId: string;
  tenantId: string;
  tenantDbUrl: string;
  supplierId?: string;
  itemId?: string;
  status?: FabricStatus;
  search?: string;
}

// ── Colour palette ─────────────────────────────────────────────────────────────
const SUBHEADER_BG = '1E3A5F';
const SUBHEADER_FG = 'F1F5F9';
const ALT_ROW_BG   = 'F8FAFC';
const BORDER_COLOR = 'CBD5E1';
const PENDING_FG   = 'B45309'; // Warm Amber for PENDING
const COMPLETED_FG = '15803D'; // Emerald for COMPLETED

const GROUP_COLORS: Record<string, string> = {
  TrackerInfo:   '1E3A5F', // Dark Blue
  FabricDetails: '1E4D2B', // Dark Green
  VendorDetails: '4A1942', // Dark Purple
  StatusInfo:    '7C3A00', // Dark Brown
  AuditInfo:     '3D2B00', // Dark Gold
};

const COLUMNS: {
  header: string;
  key: string;
  width: number;
  group: string;
  numFmt?: string;
  align?: ExcelJS.Alignment['horizontal'];
}[] = [
  // Tracker Info
  { header: 'Tracker Ref',         key: 'trackerNumber',         width: 16, group: 'TrackerInfo',   align: 'center' },
  { header: 'Status',              key: 'status',                width: 14, group: 'TrackerInfo',   align: 'center' },
  { header: 'Notes/Remarks',       key: 'notes',                 width: 30, group: 'TrackerInfo' },
  // Fabric Details
  { header: 'Fabric SKU',          key: 'sku',                   width: 18, group: 'FabricDetails', align: 'center' },
  { header: 'Description',         key: 'description',           width: 30, group: 'FabricDetails' },
  { header: 'UOM',                 key: 'uom',                   width: 10, group: 'FabricDetails', align: 'center' },
  // Stock/Quantities Info
  { header: 'Warehouse Name',      key: 'warehouseName',         width: 20, group: 'FabricDetails' },
  { header: 'Current Wh Stock (m)',key: 'warehouseStock',        width: 24, group: 'FabricDetails', numFmt: '#,##0.00', align: 'right' },
  { header: 'Qty Issued (m)',      key: 'qtyIssued',             width: 16, group: 'FabricDetails', numFmt: '#,##0.00', align: 'right' },
  { header: 'Qty Used (m)',        key: 'qtyUsed',               width: 16, group: 'FabricDetails', numFmt: '#,##0.00', align: 'right' },
  { header: 'Qty Returned (m)',    key: 'qtyReturned',           width: 18, group: 'FabricDetails', numFmt: '#,##0.00', align: 'right' },
  { header: 'Qty Shortage (m)',    key: 'qtyShortage',           width: 18, group: 'FabricDetails', numFmt: '#,##0.00', align: 'right' },
  // Vendor Details
  { header: 'Vendor Code',         key: 'vendorCode',            width: 15, group: 'VendorDetails', align: 'center' },
  { header: 'Vendor Name',         key: 'vendorName',            width: 25, group: 'VendorDetails' },
  // Dates
  { header: 'Issue Date',          key: 'issueDate',             width: 16, group: 'StatusInfo',    numFmt: 'dd-mmm-yyyy', align: 'center' },
  { header: 'Consumption Date',    key: 'consumptionDate',       width: 18, group: 'StatusInfo',    numFmt: 'dd-mmm-yyyy', align: 'center' },
  // Audit Info
  { header: 'Created At',          key: 'createdAt',             width: 20, group: 'AuditInfo',     numFmt: 'dd-mmm-yyyy hh:mm', align: 'center' },
  { header: 'Updated At',          key: 'updatedAt',             width: 20, group: 'AuditInfo',     numFmt: 'dd-mmm-yyyy hh:mm', align: 'center' },
];

@Processor('fabric-vendor-tracker-export')
export class FabricVendorTrackerExportProcessor {
  private readonly logger = new Logger(FabricVendorTrackerExportProcessor.name);

  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Process()
  async handleExport(job: Job<FabricVendorTrackerExportJobData>): Promise<void> {
    const { jobId, userId, tenantId, tenantDbUrl, supplierId, itemId, status, search } = job.data;

    this.logger.log(`[FabricVendorTrackerExport ${jobId}] Starting for user ${userId}`);

    const prisma = new PrismaService({ tenantId, tenantDbUrl } as any);

    const exportDir = path.join(process.cwd(), 'uploads', 'exports');
    fs.mkdirSync(exportDir, { recursive: true });
    const filePath = path.join(exportDir, `export-${jobId}.xlsx`);

    try {
      // ── Build WHERE ──────────────────────────────────────────────────────
      const andClauses: any[] = [];
      if (supplierId) andClauses.push({ supplierId });
      if (itemId)     andClauses.push({ itemId });
      if (status)     andClauses.push({ status });

      if (search) {
        const t = search.trim();
        andClauses.push({
          OR: [
            { trackerNumber: { contains: t, mode: 'insensitive' } },
            { notes:         { contains: t, mode: 'insensitive' } },
            { supplier:      { name: { contains: t, mode: 'insensitive' } } },
            { item:          { sku: { contains: t, mode: 'insensitive' } } },
            { item:          { description: { contains: t, mode: 'insensitive' } } },
          ],
        });
      }
      const where: any = andClauses.length ? { AND: andClauses } : {};

      const total = await prisma.fabricVendorTracker.count({ where });
      this.logger.log(`[FabricVendorTrackerExport ${jobId}] ${total} rows to export`);

      // ── Streaming workbook writer ────────────────────────────────────────
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        filename: filePath,
        useStyles: true,
        useSharedStrings: false,
      });

      const ws = workbook.addWorksheet('Fabric Trackers', {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
        views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
      });

      ws.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width }));

      // ── Row 1: Group header bands ────────────────────────────────────────
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
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${GROUP_COLORS[col.group] ?? '1E293B'}` } };
        cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border    = {
          top:    { style: 'thin', color: { argb: `FF${BORDER_COLOR}` } },
          left:   { style: 'thin', color: { argb: `FF${BORDER_COLOR}` } },
          bottom: { style: 'thin', color: { argb: `FF${BORDER_COLOR}` } },
          right:  { style: 'thin', color: { argb: `FF${BORDER_COLOR}` } },
        };
      });
      groupRow.height = 22;
      groupRow.commit();

      // ── Row 2: Column headers ────────────────────────────────────────────
      const headerRow = ws.getRow(2);
      COLUMNS.forEach((col, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value     = col.header;
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${SUBHEADER_BG}` } };
        cell.font      = { bold: true, color: { argb: `FF${SUBHEADER_FG}` }, size: 9 };
        cell.alignment = { horizontal: col.align ?? 'left', vertical: 'middle' };
        cell.border    = {
          top:    { style: 'thin',   color: { argb: `FF${BORDER_COLOR}` } },
          left:   { style: 'thin',   color: { argb: `FF${BORDER_COLOR}` } },
          bottom: { style: 'medium', color: { argb: `FF${BORDER_COLOR}` } },
          right:  { style: 'thin',   color: { argb: `FF${BORDER_COLOR}` } },
        };
      });
      headerRow.height = 20;
      headerRow.commit();

      // ── Data rows — cursor-paginated in chunks of 500 ────────────────────
      const CHUNK = 500;
      let cursor: string | undefined;
      let rowIdx = 0;
      let processed = 0;

      // Cache warehouse stocks to avoid repeated duplicate ledger queries
      const stockCache = new Map<string, number>();

      while (true) {
        const chunk = await prisma.fabricVendorTracker.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: CHUNK,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          include: {
            supplier: {
              select: { code: true, name: true },
            },
            item: {
              select: { sku: true, description: true, uom: true },
            },
            warehouse: {
              select: { name: true },
            },
          },
        });

        if (!chunk.length) break;

        for (const tracker of chunk) {
          const isAlt = rowIdx % 2 === 1;

          // Fetch or resolve warehouse stock level from cache/ledger
          const cacheKey = `${tracker.itemId}_${tracker.warehouseId}`;
          let currentWarehouseStock = stockCache.get(cacheKey);
          if (currentWarehouseStock === undefined) {
            const ledgerSum = await prisma.stockLedger.aggregate({
              where: {
                itemId: tracker.itemId,
                warehouseId: tracker.warehouseId,
                locationId: null,
              },
              _sum: {
                qty: true,
              },
            });
            currentWarehouseStock = Number(ledgerSum._sum?.qty || 0);
            stockCache.set(cacheKey, currentWarehouseStock);
          }

          const rowData: Record<string, any> = {
            trackerNumber:   tracker.trackerNumber,
            status:          tracker.status,
            notes:           tracker.notes ?? '',
            sku:             tracker.item?.sku ?? '',
            description:     tracker.item?.description ?? '',
            uom:             tracker.item?.uom ?? '',
            warehouseName:   tracker.warehouse?.name ?? '',
            warehouseStock:  currentWarehouseStock,
            qtyIssued:       Number(tracker.qtyIssued),
            qtyUsed:         Number(tracker.qtyUsed),
            qtyReturned:     Number(tracker.qtyReturned),
            qtyShortage:     Number(tracker.qtyShortage),
            vendorCode:      tracker.supplier?.code ?? '',
            vendorName:      tracker.supplier?.name ?? '',
            issueDate:       tracker.issueDate ? new Date(tracker.issueDate) : null,
            consumptionDate: tracker.consumptionDate ? new Date(tracker.consumptionDate) : null,
            createdAt:       new Date(tracker.createdAt),
            updatedAt:       new Date(tracker.updatedAt),
          };

          const dataRow = ws.getRow(rowIdx + 3);
          COLUMNS.forEach((col, colIdx) => {
            const cell = dataRow.getCell(colIdx + 1);
            cell.value     = rowData[col.key] ?? null;
            if (col.numFmt) cell.numFmt = col.numFmt;
            cell.alignment = { horizontal: col.align ?? 'left', vertical: 'middle' };
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${isAlt ? ALT_ROW_BG : 'FFFFFF'}` } };

            if (col.key === 'status') {
              const isPending = tracker.status === FabricStatus.PENDING;
              cell.font = { bold: true, size: 9, color: { argb: isPending ? `FF${PENDING_FG}` : `FF${COMPLETED_FG}` } };
            } else {
              cell.font = { size: 9 };
            }

            cell.border = {
              top:    { style: 'hair', color: { argb: `FF${BORDER_COLOR}` } },
              left:   { style: 'hair', color: { argb: `FF${BORDER_COLOR}` } },
              bottom: { style: 'hair', color: { argb: `FF${BORDER_COLOR}` } },
              right:  { style: 'hair', color: { argb: `FF${BORDER_COLOR}` } },
            };
          });
          dataRow.height = 16;
          dataRow.commit();
          rowIdx++;
        }

        processed += chunk.length;
        cursor = chunk[chunk.length - 1].id;

        const pct = total > 0 ? Math.round((processed / total) * 95) : 50;
        await job.progress(pct);
        await new Promise((r) => setImmediate(r));

        if (chunk.length < CHUNK) break;
      }

      // ── Summary sheet ────────────────────────────────────────────────────
      const summary = workbook.addWorksheet('Summary');
      summary.columns = [{ key: 'label', width: 28 }, { key: 'value', width: 22 }];

      const titleRow = summary.getRow(1);
      titleRow.getCell(1).value     = 'Fabric Vendor Tracker Export Summary';
      titleRow.getCell(1).font      = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
      titleRow.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.height = 28;
      titleRow.commit();

      const summaryRows = [
        ['Export Date',     new Date().toLocaleString('en-PK')],
        ['Total Records',   rowIdx],
        ['Search Filter',   search ?? '(none)'],
        ['Status Filter',   status ?? '(all)'],
      ];
      summaryRows.forEach(([label, value], idx) => {
        const r = summary.getRow(idx + 2);
        r.getCell(1).value = label;
        r.getCell(1).font  = { bold: true, size: 10 };
        r.getCell(1).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF' } };
        r.getCell(2).value = value;
        r.getCell(2).font  = { size: 10 };
        r.getCell(2).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF' } };
        r.height = 18;
        r.commit();
      });

      await workbook.commit();
      await job.progress(100);

      this.logger.log(`[FabricVendorTrackerExport ${jobId}] File written (${rowIdx} rows)`);

      await this.notificationsService.create({
        userId,
        title: 'Fabric Tracker Export Ready',
        message: `Your export of ${rowIdx.toLocaleString()} fabric tracker record${rowIdx !== 1 ? 's' : ''} is ready to download.`,
        category: 'export',
        priority: 'high',
        actionType: 'fabric-vendor-tracker-export.ready',
        actionPayload: { jobId },
        entityType: 'fabric-vendor-tracker-export',
        entityId: jobId,
        channels: ['inApp'],
      });

    } catch (error: any) {
      this.logger.error(`[FabricVendorTrackerExport ${jobId}] FAILED: ${error.message}`, error.stack);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      await this.notificationsService.create({
        userId,
        title: 'Fabric Tracker Export Failed',
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
