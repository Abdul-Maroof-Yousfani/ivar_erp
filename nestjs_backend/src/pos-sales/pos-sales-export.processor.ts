import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../database/prisma.service';
import { PrismaMasterService } from '../database/prisma-master.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface PosSalesExportJobData {
  jobId: string;
  userId: string;
  tenantId: string;
  tenantDbUrl: string;
  startDate?: string;
  endDate?: string;
  locationId?: string;
  cashierUserId?: string;
  paymentMethod?: string;
  status?: string;
  search?: string;
}

// ── Colour palette ─────────────────────────────────────────────────────────────
const HEADER_BG = '1E3A5F';
const SUBHEADER_BG = '2C5282';
const SUBHEADER_FG = 'F1F5F9';
const ALT_ROW_BG   = 'F7FAFC';
const BORDER_COLOR = 'E2E8F0';

const GROUP_COLORS: Record<string, string> = {
  'Order Info':      '1E3A5F',
  'Article Info':    '2F855A',
  'Financial Info':  '9B2C2C',
};

const COLUMNS: {
  header: string;
  key: string;
  width: number;
  group: string;
  numFmt?: string;
  align?: ExcelJS.Alignment['horizontal'];
}[] = [
  // Order Info
  { header: 'Date & Time',        key: 'dateTime',       width: 20, group: 'Order Info',     align: 'center' },
  { header: 'Order Number',       key: 'orderNumber',    width: 18, group: 'Order Info',     align: 'center' },
  { header: 'Location / Outlet',  key: 'location',       width: 22, group: 'Order Info' },
  { header: 'Cashier',            key: 'cashierName',    width: 18, group: 'Order Info' },
  { header: 'Customer',           key: 'customerName',   width: 20, group: 'Order Info' },
  { header: 'Payment Method',     key: 'paymentMethod',  width: 16, group: 'Order Info',     align: 'center' },
  { header: 'Order Status',       key: 'orderStatus',    width: 15, group: 'Order Info',     align: 'center' },
  
  // Article Info
  { header: 'SKU',                key: 'sku',            width: 15, group: 'Article Info',   align: 'center' },
  { header: 'Barcode',            key: 'barcode',        width: 16, group: 'Article Info',   align: 'center' },
  { header: 'Description',        key: 'description',    width: 28, group: 'Article Info' },
  { header: 'Size',               key: 'size',           width: 10, group: 'Article Info',   align: 'center' },
  { header: 'Color',              key: 'color',          width: 12, group: 'Article Info',   align: 'center' },
  { header: 'Brand',              key: 'brand',          width: 15, group: 'Article Info' },
  
  // Financial Info
  { header: 'Trans. Type',        key: 'transType',      width: 15, group: 'Financial Info', align: 'center' },
  { header: 'Quantity',           key: 'quantity',       width: 10, group: 'Financial Info', numFmt: '#,##0', align: 'right' },
  { header: 'Unit Price',         key: 'unitPrice',      width: 14, group: 'Financial Info', numFmt: '#,##0.00', align: 'right' },
  { header: 'Discount',           key: 'discount',       width: 14, group: 'Financial Info', numFmt: '#,##0.00', align: 'right' },
  { header: 'Tax',                key: 'tax',            width: 14, group: 'Financial Info', numFmt: '#,##0.00', align: 'right' },
  { header: 'Net Total',          key: 'netTotal',       width: 16, group: 'Financial Info', numFmt: '#,##0.00', align: 'right' },
];

@Processor('pos-sales-export')
export class PosSalesExportProcessor {
  private readonly logger = new Logger(PosSalesExportProcessor.name);

  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Process()
  async handleExport(job: Job<PosSalesExportJobData>): Promise<void> {
    const {
      jobId,
      userId,
      tenantId,
      tenantDbUrl,
      startDate,
      endDate,
      locationId,
      cashierUserId,
      paymentMethod,
      status,
      search,
    } = job.data;

    this.logger.log(`[PosSalesExport ${jobId}] Starting for user ${userId}`);

    const prisma = new PrismaService({ tenantId, tenantDbUrl } as any);
    const prismaMaster = new PrismaMasterService();

    const exportDir = path.join(process.cwd(), 'uploads', 'exports');
    fs.mkdirSync(exportDir, { recursive: true });
    const filePath = path.join(exportDir, `export-${jobId}.xlsx`);

    try {
      await prismaMaster.onModuleInit();

      // ── Build WHERE ──────────────────────────────────────────────────────
      const where: any = {
        status: { in: ['completed', 'partially_returned', 'refunded', 'exchanged', 'voided'] },
      };

      if (locationId) where.locationId = locationId;
      if (cashierUserId) where.cashierUserId = cashierUserId;
      if (paymentMethod) where.paymentMethod = paymentMethod;
      if (status) where.status = status;
      if (search) {
        where.orderNumber = { contains: search, mode: 'insensitive' };
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }

      const total = await prisma.salesOrder.count({ where });
      this.logger.log(`[PosSalesExport ${jobId}] ${total} sales orders to process`);

      // Fetch Locations to resolve names in memory
      const locations = await prisma.location.findMany({
        select: { id: true, name: true },
      });
      const locationMap = new Map(locations.map((l) => [l.id, l.name]));

      // ── Streaming workbook writer ────────────────────────────────────────
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        filename: filePath,
        useStyles: true,
        useSharedStrings: false,
      });

      const ws = workbook.addWorksheet('POS Sales & Returns', {
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

      while (true) {
        const chunk = await prisma.salesOrder.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: CHUNK,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          include: {
            items: {
              include: {
                item: {
                  include: {
                    size: { select: { name: true } },
                    color: { select: { name: true } },
                    brand: { select: { name: true } },
                  },
                },
              },
            },
            customer: { select: { name: true } },
          },
        });

        if (!chunk.length) break;

        // Fetch Cashier user names for this chunk
        const cashierIds = [...new Set(chunk.map((o) => o.cashierUserId).filter(Boolean))] as string[];
        const cashierUsers = cashierIds.length
          ? await prismaMaster.user.findMany({
              where: { id: { in: cashierIds } },
              select: { id: true, firstName: true, lastName: true },
            })
          : [];
        const cashierMap = new Map(cashierUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

        // Fetch StockLedger entries (for returns/exchanges/voids) for this chunk
        const orderIds = chunk.map((o) => o.id);
        const ledgerEntries = await prisma.stockLedger.findMany({
          where: {
            referenceId: { in: orderIds },
            referenceType: { in: ['POS_RETURN', 'POS_REFUND', 'POS_VOID', 'POS_EXCHANGE_IN', 'POS_EXCHANGE_OUT'] },
          },
          include: {
            item: {
              include: {
                size: { select: { name: true } },
                color: { select: { name: true } },
                brand: { select: { name: true } },
              },
            },
          },
        });

        // Group ledger entries by referenceId (order ID)
        const ledgerMap = new Map<string, typeof ledgerEntries>();
        for (const entry of ledgerEntries) {
          if (!ledgerMap.has(entry.referenceId)) {
            ledgerMap.set(entry.referenceId, []);
          }
          ledgerMap.get(entry.referenceId)!.push(entry);
        }

        for (const order of chunk) {
          const locationName = locationMap.get(order.locationId || '') || '-';
          const cashierName = cashierMap.get(order.cashierUserId || '') || '-';
          const customerName = order.customer?.name || 'Walk-in';

          // 1. Output original items (Sales)
          for (const item of order.items) {
            const isAlt = rowIdx % 2 === 1;
            const dataRow = ws.getRow(rowIdx + 3);

            const rowData: Record<string, any> = {
              dateTime:      new Date(order.createdAt),
              orderNumber:   order.orderNumber,
              location:      locationName,
              cashierName:   cashierName,
              customerName:  customerName,
              paymentMethod: order.paymentMethod || '-',
              orderStatus:   order.status,
              sku:           item.item.sku,
              barcode:       item.item.barCode || '-',
              description:   item.item.description || '-',
              size:          item.item.size?.name || '-',
              color:         item.item.color?.name || '-',
              brand:         item.item.brand?.name || '-',
              transType:     'Sale',
              quantity:      item.quantity,
              unitPrice:     Number(item.unitPrice),
              discount:      Number(item.discountAmount),
              tax:           Number(item.taxAmount),
              netTotal:      Number(item.lineTotal),
            };

            COLUMNS.forEach((col, colIdx) => {
              const cell = dataRow.getCell(colIdx + 1);
              cell.value = rowData[col.key] ?? null;
              if (col.numFmt) cell.numFmt = col.numFmt;
              cell.alignment = { horizontal: col.align ?? 'left', vertical: 'middle' };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${isAlt ? ALT_ROW_BG : 'FFFFFF'}` } };
              cell.font = { size: 9 };
              cell.border = {
                top:    { style: 'hair', color: { argb: `FF${BORDER_COLOR}` } },
                left:   { style: 'hair', color: { argb: `FF${BORDER_COLOR}` } },
                bottom: { style: 'hair', color: { argb: `FF${BORDER_COLOR}` } },
                right:  { style: 'hair', color: { argb: `FF${BORDER_COLOR}` } },
              };
            });

            dataRow.height = 18;
            dataRow.commit();
            rowIdx++;
          }

          // 2. Output returns/refunds/exchanges/voids from StockLedger
          const orderLedgers = ledgerMap.get(order.id) || [];
          for (const ledger of orderLedgers) {
            const isAlt = rowIdx % 2 === 1;
            const dataRow = ws.getRow(rowIdx + 3);

            // Find matching sales order item to extract original pricing/tax/discount
            const matchingSoItem = order.items.find((oi) => oi.itemId === ledger.itemId);

            let transType = '';
            let qtyMultiplier = 1;
            
            if (ledger.referenceType === 'POS_EXCHANGE_OUT') {
              transType = 'Exchange Out'; // Customer gets new item (sale)
              qtyMultiplier = -1; // ledger.qty is negative, so make quantity positive for sale
            } else if (ledger.referenceType === 'POS_EXCHANGE_IN') {
              transType = 'Exchange In'; // Customer returns old item
              qtyMultiplier = -1; // ledger.qty is positive, so make quantity negative for return
            } else if (ledger.referenceType === 'POS_RETURN') {
              transType = 'Return';
              qtyMultiplier = -1; // ledger.qty is positive, so make quantity negative
            } else if (ledger.referenceType === 'POS_REFUND') {
              transType = 'Refund';
              qtyMultiplier = -1; // ledger.qty is positive, so make quantity negative
            } else if (ledger.referenceType === 'POS_VOID') {
              transType = 'Void';
              qtyMultiplier = -1; // ledger.qty is positive, so make quantity negative
            }

            const transQty = Number(ledger.qty) * qtyMultiplier;
            const unitPrice = matchingSoItem ? Number(matchingSoItem.unitPrice) : Number(ledger.item.unitPrice || 0);

            let discount = 0;
            let tax = 0;
            let netTotal = 0;

            if (matchingSoItem) {
              const fraction = Math.abs(transQty) / Number(matchingSoItem.quantity);
              discount = Number(matchingSoItem.discountAmount) * fraction * (transQty < 0 ? -1 : 1);
              tax = Number(matchingSoItem.taxAmount) * fraction * (transQty < 0 ? -1 : 1);
              netTotal = Number(matchingSoItem.lineTotal) * fraction * (transQty < 0 ? -1 : 1);
            } else {
              netTotal = unitPrice * transQty;
            }

            const rowData: Record<string, any> = {
              dateTime:      new Date(ledger.createdAt),
              orderNumber:   order.orderNumber,
              location:      locationName,
              cashierName:   cashierName,
              customerName:  customerName,
              paymentMethod: order.paymentMethod || '-',
              orderStatus:   order.status,
              sku:           ledger.item.sku,
              barcode:       ledger.item.barCode || '-',
              description:   ledger.item.description || '-',
              size:          ledger.item.size?.name || '-',
              color:         ledger.item.color?.name || '-',
              brand:         ledger.item.brand?.name || '-',
              transType:     transType,
              quantity:      transQty,
              unitPrice:     unitPrice,
              discount:      discount,
              tax:           tax,
              netTotal:      netTotal,
            };

            COLUMNS.forEach((col, colIdx) => {
              const cell = dataRow.getCell(colIdx + 1);
              cell.value = rowData[col.key] ?? null;
              if (col.numFmt) cell.numFmt = col.numFmt;
              cell.alignment = { horizontal: col.align ?? 'left', vertical: 'middle' };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${isAlt ? ALT_ROW_BG : 'FFFFFF'}` } };
              cell.font = { size: 9, italic: true };
              cell.border = {
                top:    { style: 'hair', color: { argb: `FF${BORDER_COLOR}` } },
                left:   { style: 'hair', color: { argb: `FF${BORDER_COLOR}` } },
                bottom: { style: 'hair', color: { argb: `FF${BORDER_COLOR}` } },
                right:  { style: 'hair', color: { argb: `FF${BORDER_COLOR}` } },
              };
            });

            dataRow.height = 18;
            dataRow.commit();
            rowIdx++;
          }
        }

        processed += chunk.length;
        cursor = chunk[chunk.length - 1].id;

        const pct = total > 0 ? Math.round((processed / total) * 95) : 50;
        await job.progress(pct);
        await new Promise((r) => setImmediate(r));

        if (chunk.length < CHUNK) break;
      }

      // ── Summary Sheet ─────────────────────────────────────────────────────
      const summary = workbook.addWorksheet('Summary');
      summary.columns = [{ key: 'label', width: 28 }, { key: 'value', width: 22 }];

      const titleRow = summary.getRow(1);
      titleRow.getCell(1).value = 'POS Sales Export Summary';
      titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
      titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.height = 28;
      titleRow.commit();

      const summaryRows = [
        ['Export Date', new Date().toLocaleString('en-PK')],
        ['Total Orders Processed', total],
        ['Total Rows Exported', rowIdx],
        ['Start Date Filter', startDate ?? '(none)'],
        ['End Date Filter', endDate ?? '(none)'],
        ['Location Filter', locationId ? (locationMap.get(locationId) ?? locationId) : '(all)'],
        ['Cashier Filter', cashierUserId ?? '(all)'],
        ['Payment Method Filter', paymentMethod ?? '(all)'],
        ['Status Filter', status ?? '(all)'],
        ['Search Filter', search ?? '(none)'],
      ];

      summaryRows.forEach(([label, value], idx) => {
        const r = summary.getRow(idx + 2);
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
      await job.progress(100);

      this.logger.log(`[PosSalesExport ${jobId}] File written (${rowIdx} rows)`);

      await this.notificationsService.create({
        userId,
        title: 'POS Sales Export Ready',
        message: `Your POS detailed sales export of ${rowIdx.toLocaleString()} items is ready to download.`,
        category: 'export',
        priority: 'high',
        actionType: 'pos-sales-export.ready',
        actionPayload: { jobId },
        entityType: 'pos-sales-export',
        entityId: jobId,
        channels: ['inApp'],
      });

    } catch (error: any) {
      this.logger.error(`[PosSalesExport ${jobId}] FAILED: ${error.message}`, error.stack);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      await this.notificationsService.create({
        userId,
        title: 'POS Sales Export Failed',
        message: `Export could not be completed: ${error.message}`,
        category: 'export',
        priority: 'urgent',
        channels: ['inApp'],
      });
    } finally {
      await prisma.$disconnect();
      await prismaMaster.onModuleDestroy();
    }
  }
}
