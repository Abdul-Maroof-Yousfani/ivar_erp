import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../database/prisma.service';
import { PrismaMasterService } from '../database/prisma-master.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ExportHistoryService } from '../warehouse/export-history/export-history.service';

export interface PosSalesActivityExportJobData {
  jobId: string;
  userId: string;
  tenantId: string;
  tenantDbUrl: string;
  posId?: string;
  activityType?: string;
  filters?: { 
    startDate?: string; 
    endDate?: string; 
    search?: string;
    merchantId?: string;
    paymentMethod?: string;
  };
  locationId?: string;
  merchantId?: string;
  paymentMethod?: string;
}

// ── Color palette & Group Colors ─────────────────────────────────────────────
const SUBHEADER_BG = '1E3A5F';
const SUBHEADER_FG = 'F1F5F9';
const ALT_ROW_BG   = 'F8FAFC';
const BORDER_COLOR = 'CBD5E1';

const GROUP_COLORS: Record<string, string> = {
  'Outlet & POS': '1E293B',
  'Activity Info': '0F172A',
  'Customer': '065F46',
  'Item Details': '0F766E',
  'Pricing & WOST': '581C87',
  'Discounts & Promotions': '9A3412',
  'Alliance Discount': '1D4ED8',
  'Tenders & Payment': '1E3A8A',
  'Merchant Commission': '831843',
  'Vouchers & Claims': '155E75',
  'FBR Compliance': '374151',
};

const COLUMNS: {
  header: string;
  key: string;
  width: number;
  group: string;
  numFmt?: string;
  align?: ExcelJS.Alignment['horizontal'];
}[] = [
  // ── 1. Outlet & POS ──
  { header: 'Outlet Name', key: 'outletName', width: 24, group: 'Outlet & POS' },
  { header: 'Outlet Code', key: 'outletCode', width: 14, group: 'Outlet & POS', align: 'center' },
  { header: 'POS ID / Terminal', key: 'posId', width: 15, group: 'Outlet & POS', align: 'center' },
  { header: 'Cashier / User', key: 'cashierName', width: 22, group: 'Outlet & POS' },

  // ── 2. Activity Info ──
  { header: 'Activity Date & Time', key: 'activityDate', width: 20, group: 'Activity Info', numFmt: 'dd-mmm-yyyy hh:mm', align: 'center' },
  { header: 'Activity Type', key: 'activityType', width: 14, group: 'Activity Info', align: 'center' },
  { header: 'Activity Ref / Number', key: 'activityNumber', width: 22, group: 'Activity Info', align: 'center' },
  { header: 'Parent Order #', key: 'parentOrderNumber', width: 20, group: 'Activity Info', align: 'center' },
  { header: 'Order Status', key: 'orderStatus', width: 14, group: 'Activity Info', align: 'center' },

  // ── 3. Customer ──
  { header: 'Customer Name', key: 'customerName', width: 24, group: 'Customer' },
  { header: 'Customer Contact', key: 'customerContact', width: 16, group: 'Customer', align: 'center' },

  // ── 4. Item Details ──
  { header: 'SKU', key: 'itemSku', width: 16, group: 'Item Details', align: 'center' },
  { header: 'Barcode / UPC', key: 'itemBarcode', width: 16, group: 'Item Details', align: 'center' },
  { header: 'Item Description', key: 'itemDescription', width: 30, group: 'Item Details' },
  { header: 'Brand', key: 'itemBrand', width: 16, group: 'Item Details' },
  { header: 'Category', key: 'itemCategory', width: 16, group: 'Item Details' },
  { header: 'Size', key: 'itemSize', width: 10, group: 'Item Details', align: 'center' },
  { header: 'Color', key: 'itemColor', width: 10, group: 'Item Details', align: 'center' },
  { header: 'Quantity', key: 'quantity', width: 10, group: 'Item Details', align: 'right', numFmt: '#,##0' },

  // ── 5. Pricing & WOST Breakdown ──
  { header: 'Unit Price (Gross)', key: 'unitPrice', width: 16, group: 'Pricing & WOST', align: 'right', numFmt: '#,##0.00' },
  { header: 'Unit Price WOST', key: 'unitPriceWost', width: 16, group: 'Pricing & WOST', align: 'right', numFmt: '#,##0.00' },
  { header: 'Gross Total WOST', key: 'grossLineTotalWost', width: 18, group: 'Pricing & WOST', align: 'right', numFmt: '#,##0.00' },
  { header: 'Tax Rate %', key: 'taxPercent', width: 12, group: 'Pricing & WOST', align: 'right', numFmt: '0.0%' },
  { header: 'Tax Amount', key: 'taxAmount', width: 14, group: 'Pricing & WOST', align: 'right', numFmt: '#,##0.00' },
  { header: 'Net Line Total (Gross)', key: 'lineTotal', width: 18, group: 'Pricing & WOST', align: 'right', numFmt: '#,##0.00' },
  { header: 'Net Line Total WOST', key: 'lineTotalWost', width: 18, group: 'Pricing & WOST', align: 'right', numFmt: '#,##0.00' },

  // ── 6. Discounts & Promotions ──
  { header: 'Item Discount %', key: 'itemDiscountPercent', width: 14, group: 'Discounts & Promotions', align: 'right', numFmt: '0.0%' },
  { header: 'Item Discount Amount', key: 'itemDiscountAmount', width: 16, group: 'Discounts & Promotions', align: 'right', numFmt: '#,##0.00' },
  { header: 'Item Discount WOST', key: 'itemDiscountWost', width: 16, group: 'Discounts & Promotions', align: 'right', numFmt: '#,##0.00' },
  { header: 'Manual Discount Applied', key: 'manualDiscountApplied', width: 18, group: 'Discounts & Promotions', align: 'center' },
  { header: 'Manual Discount Note', key: 'manualDiscountNote', width: 24, group: 'Discounts & Promotions' },
  { header: 'Global Order Discount %', key: 'globalDiscountPercent', width: 16, group: 'Discounts & Promotions', align: 'right', numFmt: '0.0%' },
  { header: 'Global Order Discount Amount', key: 'globalDiscountAmount', width: 18, group: 'Discounts & Promotions', align: 'right', numFmt: '#,##0.00' },
  { header: 'Promo Code', key: 'promoCode', width: 14, group: 'Discounts & Promotions', align: 'center' },
  { header: 'Promo Campaign Name', key: 'promoName', width: 22, group: 'Discounts & Promotions' },
  { header: 'Coupon Code', key: 'couponCode', width: 14, group: 'Discounts & Promotions', align: 'center' },

  // ── 7. Alliance Discount ──
  { header: 'Alliance Partner Name', key: 'allianceName', width: 22, group: 'Alliance Discount' },
  { header: 'Alliance Code', key: 'allianceCode', width: 14, group: 'Alliance Discount', align: 'center' },
  { header: 'Alliance Discount %', key: 'allianceDiscountPercent', width: 14, group: 'Alliance Discount', align: 'right', numFmt: '0.0%' },
  { header: 'Alliance Max Discount', key: 'allianceMaxDiscount', width: 16, group: 'Alliance Discount', align: 'right', numFmt: '#,##0.00' },
  { header: 'Selected BIN Numbers', key: 'allianceBinNumbers', width: 25, group: 'Alliance Discount' },

  // ── 8. Tenders & Payment Breakdown ──
  { header: 'Tender Type / Method', key: 'paymentMethodType', width: 18, group: 'Tenders & Payment', align: 'center' },
  { header: 'Cash Amount', key: 'cashAmount', width: 16, group: 'Tenders & Payment', align: 'right', numFmt: '#,##0.00' },
  { header: 'Card Amount', key: 'cardAmount', width: 16, group: 'Tenders & Payment', align: 'right', numFmt: '#,##0.00' },
  { header: 'Bank Transfer Amount', key: 'bankTransferAmount', width: 16, group: 'Tenders & Payment', align: 'right', numFmt: '#,##0.00' },
  { header: 'Voucher Redeemed Amount', key: 'voucherRedeemedAmount', width: 18, group: 'Tenders & Payment', align: 'right', numFmt: '#,##0.00' },
  { header: 'Redeemed Voucher Codes', key: 'voucherRedeemedCodes', width: 25, group: 'Tenders & Payment' },
  { header: 'Change / Return Amount', key: 'changeAmount', width: 16, group: 'Tenders & Payment', align: 'right', numFmt: '#,##0.00' },

  // ── 9. Merchant Commission ──
  { header: 'Merchant / Bank Name', key: 'merchantBankName', width: 22, group: 'Merchant Commission' },
  { header: 'Merchant Cost Centre Tag', key: 'merchantTag', width: 20, group: 'Merchant Commission' },
  { header: 'Merchant Tag ID', key: 'merchantTagId', width: 14, group: 'Merchant Commission', align: 'center' },
  { header: 'Merchant Commission Rate', key: 'merchantCommissionPercent', width: 18, group: 'Merchant Commission', align: 'right', numFmt: '0.00%' },
  { header: 'Merchant Commission Expense', key: 'merchantCommissionAmount', width: 20, group: 'Merchant Commission', align: 'right', numFmt: '#,##0.00' },
  { header: 'Bank GL Code', key: 'merchantBankGlCode', width: 14, group: 'Merchant Commission', align: 'center' },

  // ── 10. Vouchers & Claims ──
  { header: 'Issued Voucher Codes (Type & Code)', key: 'issuedVoucherCodes', width: 30, group: 'Vouchers & Claims' },
  { header: 'Issued Voucher Amount', key: 'issuedVoucherAmount', width: 18, group: 'Vouchers & Claims', align: 'right', numFmt: '#,##0.00' },
  { header: 'Claim Status', key: 'claimStatus', width: 14, group: 'Vouchers & Claims', align: 'center' },
  { header: 'Reason / Customer Notes', key: 'reasonNotes', width: 25, group: 'Vouchers & Claims' },
  { header: 'Reviewer / Approval Notes', key: 'reviewNotes', width: 25, group: 'Vouchers & Claims' },

  // ── 11. FBR Compliance ──
  { header: 'FBR Invoice #', key: 'fbrInvoiceNumber', width: 24, group: 'FBR Compliance', align: 'center' },
  { header: 'FBR Status', key: 'fbrStatus', width: 14, group: 'FBR Compliance', align: 'center' },
];

@Processor('pos-sales-activity-export')
export class PosSalesActivityExportProcessor {
  private readonly logger = new Logger(PosSalesActivityExportProcessor.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly exportHistoryService: ExportHistoryService,
  ) {}

  @Process()
  async handleExport(job: Job<PosSalesActivityExportJobData>): Promise<void> {
    const { jobId, userId, tenantId, tenantDbUrl, posId, activityType, filters, locationId, merchantId, paymentMethod } = job.data;
    const effectiveMerchantId = merchantId || filters?.merchantId;
    const effectivePaymentMethod = paymentMethod || filters?.paymentMethod;

    this.logger.log(`[PosSalesActivityExport ${jobId}] Starting detailed sales activity export for user ${userId}`);

    const prisma = new PrismaService({ tenantId, tenantDbUrl } as any);
    const prismaMaster = new PrismaMasterService();

    const exportDir = path.join(process.cwd(), 'uploads', 'exports');
    fs.mkdirSync(exportDir, { recursive: true });
    const filePath = path.join(exportDir, `export-${jobId}.xlsx`);

    try {
      await job.progress(5);

      const where: any = {};
      if (posId && posId !== 'all') {
        if (posId.length > 20) {
          where.terminalId = posId;
        } else {
          where.posId = posId;
        }
      }
      if (locationId && locationId !== 'all') where.locationId = locationId;
      if (effectiveMerchantId && effectiveMerchantId !== 'all') where.merchantId = effectiveMerchantId;
      if (effectivePaymentMethod && effectivePaymentMethod !== 'all') {
        if (effectivePaymentMethod.toLowerCase() === 'split') {
          where.tenderType = 'split';
        } else {
          where.paymentMethod = { equals: effectivePaymentMethod, mode: 'insensitive' };
        }
      }

      // Exclude hold, hold_expired, and hold_cancelled orders
      where.status = { notIn: ['hold', 'hold_expired', 'hold_cancelled'] };

      // ── Determine Date Range ──
      let start: Date | undefined = undefined;
      let end: Date | undefined = undefined;

      if (filters?.startDate) {
        start = new Date(filters.startDate);
      } else if (!filters?.search) {
        start = new Date();
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
      }

      if (filters?.endDate) {
        end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
      } else if (!filters?.search) {
        end = new Date();
        end.setHours(23, 59, 59, 999);
      }

      // ── Gather all matching Order IDs by Activity Date ──
      const targetOrderIds = new Set<string>();
      const filterByDate = start || end;

      if (filterByDate) {
        // 1. Sale Activity in range
        const saleRangeQuery: any = {};
        if (start) saleRangeQuery.gte = start;
        if (end) saleRangeQuery.lte = end;

        const salesInRange = await prisma.salesOrder.findMany({
          where: {
            ...where,
            createdAt: saleRangeQuery,
          },
          select: { id: true },
        });
        salesInRange.forEach(o => targetOrderIds.add(o.id));

        // 2. Return/Refund Activity in range (from stock ledgers)
        const ledgerRangeQuery: any = {};
        if (start) ledgerRangeQuery.gte = start;
        if (end) ledgerRangeQuery.lte = end;

        const ledgersInRange = await prisma.stockLedger.findMany({
          where: {
            referenceType: { in: ['POS_RETURN', 'POS_REFUND'] },
            createdAt: ledgerRangeQuery,
          },
          select: { referenceId: true },
        });
        ledgersInRange.forEach(l => targetOrderIds.add(l.referenceId));

        // 3. Claim Activity in range (from claims)
        const claimRangeQuery: any = {};
        if (start) claimRangeQuery.gte = start;
        if (end) claimRangeQuery.lte = end;

        const claimsInRange = await prisma.posClaim.findMany({
          where: { submittedAt: claimRangeQuery },
          select: { salesOrderId: true },
        });
        claimsInRange.forEach(c => targetOrderIds.add(c.salesOrderId));
      }

      // ── Search Filters ──
      if (filters?.search) {
        const searchTerm = filters.search.trim();

        const searchWhere: any = {
          OR: [
            { orderNumber: { contains: searchTerm, mode: 'insensitive' } },
            { returnNumber: { contains: searchTerm, mode: 'insensitive' } },
            { refundNumber: { contains: searchTerm, mode: 'insensitive' } },
          ],
        };

        const matchedOrders = await prisma.salesOrder.findMany({
          where: {
            ...where,
            ...searchWhere,
          },
          select: { id: true },
        });
        const searchOrderIds = new Set(matchedOrders.map(o => o.id));

        const matchedClaims = await prisma.posClaim.findMany({
          where: { claimNumber: { contains: searchTerm, mode: 'insensitive' } },
          select: { salesOrderId: true },
        });
        matchedClaims.forEach(c => searchOrderIds.add(c.salesOrderId));

        const matchedIssuedVouchers = await prisma.voucher.findMany({
          where: { code: { contains: searchTerm, mode: 'insensitive' }, sourceOrderId: { not: null } },
          select: { sourceOrderId: true },
        });
        matchedIssuedVouchers.forEach(v => searchOrderIds.add(v.sourceOrderId as string));

        const matchedRedemptions = await prisma.voucherRedemption.findMany({
          where: { voucher: { code: { contains: searchTerm, mode: 'insensitive' } } },
          select: { orderId: true },
        });
        matchedRedemptions.forEach(r => searchOrderIds.add(r.orderId));

        if (filterByDate) {
          const intersectIds = Array.from(targetOrderIds).filter(id => searchOrderIds.has(id));
          targetOrderIds.clear();
          intersectIds.forEach(id => targetOrderIds.add(id));
        } else {
          searchOrderIds.forEach(id => targetOrderIds.add(id));
        }
      }

      // Apply final resolved order IDs filter
      where.id = { in: Array.from(targetOrderIds) };

      const totalOrders = await prisma.salesOrder.count({ where });
      this.logger.log(`[PosSalesActivityExport ${jobId}] Resolved ${totalOrders} parent orders matching activity filters.`);

      await job.progress(15);

      // ── Streaming workbook writer ────────────────────────────────────────
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        filename: filePath,
        useStyles: true,
        useSharedStrings: false,
      });

      const ws = workbook.addWorksheet('Sales Activities', {
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
      groupRow.height = 24;
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
      headerRow.height = 22;
      headerRow.commit();

      // ── Data rows — paginated in chunks of 500 ────────────────────
      const CHUNK = 500;
      let rowIdx = 0;
      let processed = 0;

      while (true) {
        const rawOrders = await prisma.salesOrder.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: CHUNK,
          skip: processed,
          include: {
            items: { 
              include: { 
                item: { 
                  select: { 
                    description: true, 
                    sku: true, 
                    barCode: true, 
                    size: { select: { name: true } }, 
                    color: { select: { name: true } },
                    brand: { select: { name: true } },
                    category: { select: { name: true } },
                  } 
                } 
              } 
            },
            customer: { select: { id: true, name: true, contactNo: true } },
            promo: { select: { name: true, code: true } },
            coupon: { select: { code: true, description: true, discountValue: true, discountType: true } },
            alliance: { select: { partnerName: true, code: true, discountPercent: true, maxDiscount: true, binNumbers: true } },
            merchant: { select: { id: true, bankName: true, description: true, costCentreTag: true, tagId: true, commissionRate: true, bankGlCode: true } },
            voucherRedemptions: { 
              select: { 
                amountUsed: true, 
                voucher: { select: { code: true, faceValue: true, voucherType: true } } 
              } 
            },
            claims: {
              include: {
                items: {
                  include: {
                    item: { 
                      select: { 
                        description: true, 
                        sku: true, 
                        barCode: true,
                        size: { select: { name: true } },
                        color: { select: { name: true } },
                        brand: { select: { name: true } },
                        category: { select: { name: true } },
                      } 
                    }
                  }
                },
                voucher: { select: { code: true, faceValue: true, voucherType: true } }
              },
              orderBy: { submittedAt: 'desc' },
            }
          },
        });

        if (!rawOrders.length) break;

        const orderIds = rawOrders.map(o => o.id);

        // Fetch Outlet Location details (name, code, shortCode)
        const locationIds = [...new Set(rawOrders.map(o => o.locationId).filter(Boolean))] as string[];
        const locationMap = new Map<string, { name: string; code: string; shortCode?: string | null }>();
        if (locationIds.length) {
          const locations = await prisma.location.findMany({
            where: { id: { in: locationIds } },
            select: { id: true, name: true, code: true, shortCode: true },
          });
          for (const loc of locations) {
            locationMap.set(loc.id, { name: loc.name, code: loc.code, shortCode: loc.shortCode });
          }
        }

        // Fetch stock ledgers for returns/refunds
        const returnEntries = await prisma.stockLedger.findMany({
          where: {
            referenceType: { in: ['POS_RETURN', 'POS_REFUND'] },
            referenceId: { in: orderIds },
          },
          select: { 
            referenceId: true, 
            itemId: true, 
            qty: true, 
            referenceType: true, 
            createdAt: true 
          },
          orderBy: { createdAt: 'asc' },
        });

        const returnEntriesMap = new Map<string, typeof returnEntries>();
        for (const entry of returnEntries) {
          if (!returnEntriesMap.has(entry.referenceId)) {
            returnEntriesMap.set(entry.referenceId, []);
          }
          returnEntriesMap.get(entry.referenceId)!.push(entry);
        }

        // Fetch issued vouchers
        const issuedVouchers = await prisma.voucher.findMany({
          where: {
            sourceOrderId: { in: orderIds },
            isDeleted: false,
          },
          select: {
            id: true,
            code: true,
            voucherType: true,
            faceValue: true,
            expiresAt: true,
            sourceOrderId: true,
          }
        });

        const issuedVouchersMap = new Map<string, typeof issuedVouchers>();
        for (const v of issuedVouchers) {
          if (v.sourceOrderId) {
            if (!issuedVouchersMap.has(v.sourceOrderId)) {
              issuedVouchersMap.set(v.sourceOrderId, []);
            }
            issuedVouchersMap.get(v.sourceOrderId)!.push(v);
          }
        }

        // Fetch cashier names from master DB
        const cashierIds = [...new Set(rawOrders.map(o => o.cashierUserId).filter(Boolean))] as string[];
        const cashierNameMap = new Map<string, string>();
        if (cashierIds.length) {
          const cashierUsers = await prismaMaster.user.findMany({
            where: { id: { in: cashierIds } },
            select: { id: true, firstName: true, lastName: true },
          });
          for (const u of cashierUsers) {
            cashierNameMap.set(u.id, `${u.firstName} ${u.lastName}`.trim());
          }
        }

        // Flatten activities for this chunk
        let chunkActivities: any[] = [];
        rawOrders.forEach(order => {
          const orderVouchers = issuedVouchersMap.get(order.id) || [];
          const orderLedgers = returnEntriesMap.get(order.id) || [];
          const cashierName = order.cashierUserId ? (cashierNameMap.get(order.cashierUserId) || 'Cashier') : 'N/A';
          const locInfo = order.locationId ? locationMap.get(order.locationId) : null;
          const outletName = locInfo?.name || 'Main Outlet';
          const outletCode = locInfo?.code || locInfo?.shortCode || order.locationId || 'N/A';

          // ── Payment Breakdown Calculations ──
          const voucherRedemptions = order.voucherRedemptions || [];
          const voucherRedeemedTotal = voucherRedemptions.reduce((sum: number, r: any) => sum + Number(r.amountUsed || 0), 0) || Number(order.voucherAmount || 0);
          const voucherRedeemedCodes = voucherRedemptions.map((r: any) => r.voucher?.code).filter(Boolean).join(', ');

          let cashAmount = 0;
          let cardAmount = 0;
          let bankTransferAmount = 0;

          if (order.tenderType === 'split') {
            cashAmount = Number(order.cashAmount || 0);
            const isLegacy = order.voucherAmount === null || order.voucherAmount === undefined;
            cardAmount = isLegacy
              ? Math.max(0, Number(order.cardAmount || 0) - voucherRedeemedTotal - Number(order.changeAmount ?? 0))
              : Number(order.cardAmount || 0);
          } else {
            const method = (order.paymentMethod || '').toLowerCase();
            const rawTotal = Number(order.grandTotal || 0);
            const netPaid = Math.max(0, rawTotal - voucherRedeemedTotal);

            if (method === 'cash') {
              cashAmount = Number(order.cashAmount) || netPaid;
            } else if (method === 'card') {
              cardAmount = Number(order.cardAmount) || netPaid;
            } else if (method === 'bank_transfer' || method === 'bank') {
              bankTransferAmount = netPaid;
            }
          }

          // Merchant Commission Expense calculation
          let merchantCommissionPercent: number | null = null;
          let merchantCommissionAmount: number | null = null;
          if (order.merchant && cardAmount > 0) {
            const rawRate = Number(order.merchant.commissionRate || 0);
            const rateDecimal = rawRate > 1 ? rawRate / 100 : rawRate;
            merchantCommissionPercent = rateDecimal;
            merchantCommissionAmount = cardAmount * rateDecimal;
          }

          // Alliance Details
          const allianceName = order.alliance?.partnerName || '';
          const allianceCode = order.alliance?.code || '';
          const allianceDiscountPercent = order.alliance?.discountPercent ? Number(order.alliance.discountPercent) / 100 : null;
          const allianceMaxDiscount = order.alliance?.maxDiscount ? Number(order.alliance.maxDiscount) : null;
          const allianceBinNumbers = Array.isArray(order.alliance?.binNumbers) ? order.alliance.binNumbers.join(', ') : '';

          // 1. Sale Activity
          const saleIssuedVouchers = orderVouchers.filter(v => ['GIFT', 'CREDIT'].includes(v.voucherType));

          chunkActivities.push({
            id: `${order.id}-sale`,
            type: 'sale',
            number: order.orderNumber,
            date: order.createdAt,
            amount: Number(order.grandTotal),
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderStatus: order.status.toUpperCase(),
            outletName,
            outletCode,
            posId: order.posId || order.terminalId || 'N/A',
            customer: order.customer,
            cashierName,
            paymentMethodType: order.tenderType === 'split' ? 'SPLIT' : (order.paymentMethod || 'CASH').toUpperCase(),
            cashAmount,
            cardAmount,
            bankTransferAmount,
            voucherRedeemedAmount: voucherRedeemedTotal,
            voucherRedeemedCodes,
            changeAmount: Number(order.changeAmount || 0),
            merchantBankName: order.merchant?.bankName || '',
            merchantTag: order.merchant?.costCentreTag || order.merchant?.description || '',
            merchantTagId: order.merchant?.tagId || '',
            merchantCommissionPercent,
            merchantCommissionAmount,
            merchantBankGlCode: order.merchant?.bankGlCode || '',
            allianceName,
            allianceCode,
            allianceDiscountPercent,
            allianceMaxDiscount,
            allianceBinNumbers,
            globalDiscountPercent: order.globalDiscountPercent ? Number(order.globalDiscountPercent) / 100 : null,
            globalDiscountAmount: Number(order.globalDiscountAmount || 0),
            manualDiscountNote: order.manualDiscountNote || '',
            promoCode: order.promo?.code || '',
            promoName: order.promo?.name || '',
            couponCode: order.coupon?.code || '',
            fbrInvoiceNumber: order.fbrInvoiceNumber || '',
            fbrStatus: order.fbrStatus || '',
            issuedVouchers: saleIssuedVouchers.map(v => ({
              code: v.code,
              faceValue: Number(v.faceValue),
              voucherType: v.voucherType,
              expiresAt: v.expiresAt
            })),
            items: order.items.map((oi: any) => {
              const isManual = oi.overrideDiscountPercent !== null && oi.overrideDiscountPercent !== undefined || !!oi.overrideDiscountNote || !!order.manualDiscountNote;
              return {
                itemId: oi.itemId,
                sku: oi.item?.sku || oi.item?.barCode || 'N/A',
                barcode: oi.item?.barCode || '',
                description: oi.item?.description || 'Item',
                brand: oi.item?.brand?.name || '',
                category: oi.item?.category?.name || '',
                size: oi.item?.size?.name || '',
                color: oi.item?.color?.name || '',
                quantity: oi.quantity,
                unitPrice: Number(oi.unitPrice),
                lineTotal: Number(oi.lineTotal),
                taxPercent: Number(oi.taxPercent || 0),
                taxAmount: Number(oi.taxAmount || 0),
                discountPercent: Number(oi.discountPercent || 0),
                discountAmount: Number(oi.discountAmount || 0),
                manualDiscountApplied: isManual ? 'YES' : 'NO',
                manualDiscountNote: oi.overrideDiscountNote || order.manualDiscountNote || '',
              };
            })
          });

          // 2. Return Activity
          const returnLedgers = orderLedgers.filter(l => l.referenceType === 'POS_RETURN');
          if (order.returnNumber || returnLedgers.length > 0) {
            const exchangeVoucher = orderVouchers.find(v => v.voucherType === 'EXCHANGE');
            const returnDate = returnLedgers.length > 0 ? returnLedgers[returnLedgers.length - 1].createdAt : order.updatedAt;

            const returnedItems = returnLedgers.map(l => {
              const orderItem = order.items.find((oi: any) => oi.itemId === l.itemId);
              const qty = Math.abs(Number(l.qty));
              const origQty = Number(orderItem?.quantity || 1);
              const ratio = origQty > 0 ? qty / origQty : 1;

              return {
                itemId: l.itemId,
                sku: orderItem?.item?.sku || orderItem?.item?.barCode || 'N/A',
                barcode: orderItem?.item?.barCode || '',
                description: orderItem?.item?.description || 'Item',
                brand: orderItem?.item?.brand?.name || '',
                category: orderItem?.item?.category?.name || '',
                size: orderItem?.item?.size?.name || '',
                color: orderItem?.item?.color?.name || '',
                quantity: qty,
                unitPrice: orderItem ? Number(orderItem.unitPrice) : 0,
                lineTotal: orderItem ? qty * Number(orderItem.unitPrice) : 0,
                taxPercent: orderItem ? Number(orderItem.taxPercent || 0) : 0,
                taxAmount: orderItem ? ratio * Number(orderItem.taxAmount || 0) : 0,
                discountPercent: orderItem ? Number(orderItem.discountPercent || 0) : 0,
                discountAmount: orderItem ? ratio * Number(orderItem.discountAmount || 0) : 0,
                manualDiscountApplied: 'NO',
                manualDiscountNote: '',
              };
            });

            chunkActivities.push({
              id: `${order.id}-return`,
              type: 'return',
              number: order.returnNumber || 'Return',
              date: returnDate,
              amount: exchangeVoucher ? Number(exchangeVoucher.faceValue) : returnedItems.reduce((s, i) => s + i.lineTotal, 0),
              orderId: order.id,
              orderNumber: order.orderNumber,
              orderStatus: 'RETURNED',
              outletName,
              outletCode,
              posId: order.posId || order.terminalId || 'N/A',
              customer: order.customer,
              cashierName,
              paymentMethodType: 'RETURN',
              cashAmount: 0,
              cardAmount: 0,
              bankTransferAmount: 0,
              voucherRedeemedAmount: 0,
              voucherRedeemedCodes: '',
              changeAmount: 0,
              merchantBankName: '',
              merchantTag: '',
              merchantTagId: '',
              merchantCommissionPercent: null,
              merchantCommissionAmount: null,
              merchantBankGlCode: '',
              allianceName,
              allianceCode,
              allianceDiscountPercent,
              allianceMaxDiscount,
              allianceBinNumbers,
              globalDiscountPercent: null,
              globalDiscountAmount: 0,
              manualDiscountNote: '',
              promoCode: '',
              promoName: '',
              couponCode: '',
              fbrInvoiceNumber: order.fbrInvoiceNumber || '',
              fbrStatus: order.fbrStatus || '',
              items: returnedItems,
              issuedVouchers: exchangeVoucher ? [{
                code: exchangeVoucher.code,
                faceValue: Number(exchangeVoucher.faceValue),
                voucherType: 'EXCHANGE',
                expiresAt: exchangeVoucher.expiresAt
              }] : []
            });
          }

          // 3. Refund Activity
          const refundLedgers = orderLedgers.filter(l => l.referenceType === 'POS_REFUND');
          if (order.refundNumber || refundLedgers.length > 0) {
            const refundVouchers = orderVouchers.filter(v => ['REFUND', 'CREDIT'].includes(v.voucherType) && !saleIssuedVouchers.some(sv => sv.id === v.id));
            const refundDate = refundLedgers.length > 0 ? refundLedgers[refundLedgers.length - 1].createdAt : order.updatedAt;

            const refundedItems = refundLedgers.map(l => {
              const orderItem = order.items.find((oi: any) => oi.itemId === l.itemId);
              const qty = Math.abs(Number(l.qty));
              const origQty = Number(orderItem?.quantity || 1);
              const ratio = origQty > 0 ? qty / origQty : 1;

              return {
                itemId: l.itemId,
                sku: orderItem?.item?.sku || orderItem?.item?.barCode || 'N/A',
                barcode: orderItem?.item?.barCode || '',
                description: orderItem?.item?.description || 'Item',
                brand: orderItem?.item?.brand?.name || '',
                category: orderItem?.item?.category?.name || '',
                size: orderItem?.item?.size?.name || '',
                color: orderItem?.item?.color?.name || '',
                quantity: qty,
                unitPrice: orderItem ? Number(orderItem.unitPrice) : 0,
                lineTotal: orderItem ? qty * Number(orderItem.unitPrice) : 0,
                taxPercent: orderItem ? Number(orderItem.taxPercent || 0) : 0,
                taxAmount: orderItem ? ratio * Number(orderItem.taxAmount || 0) : 0,
                discountPercent: orderItem ? Number(orderItem.discountPercent || 0) : 0,
                discountAmount: orderItem ? ratio * Number(orderItem.discountAmount || 0) : 0,
                manualDiscountApplied: 'NO',
                manualDiscountNote: '',
              };
            });

            chunkActivities.push({
              id: `${order.id}-refund`,
              type: 'refund',
              number: order.refundNumber || 'Refund',
              date: refundDate,
              amount: refundVouchers.length > 0 ? refundVouchers.reduce((sum, v) => sum + Number(v.faceValue), 0) : refundedItems.reduce((s, i) => s + i.lineTotal, 0),
              orderId: order.id,
              orderNumber: order.orderNumber,
              orderStatus: 'REFUNDED',
              outletName,
              outletCode,
              posId: order.posId || order.terminalId || 'N/A',
              customer: order.customer,
              cashierName,
              paymentMethodType: 'REFUND',
              cashAmount: 0,
              cardAmount: 0,
              bankTransferAmount: 0,
              voucherRedeemedAmount: 0,
              voucherRedeemedCodes: '',
              changeAmount: 0,
              merchantBankName: '',
              merchantTag: '',
              merchantTagId: '',
              merchantCommissionPercent: null,
              merchantCommissionAmount: null,
              merchantBankGlCode: '',
              allianceName,
              allianceCode,
              allianceDiscountPercent,
              allianceMaxDiscount,
              allianceBinNumbers,
              globalDiscountPercent: null,
              globalDiscountAmount: 0,
              manualDiscountNote: '',
              promoCode: '',
              promoName: '',
              couponCode: '',
              fbrInvoiceNumber: order.fbrInvoiceNumber || '',
              fbrStatus: order.fbrStatus || '',
              items: refundedItems,
              issuedVouchers: refundVouchers.map(v => ({
                code: v.code,
                faceValue: Number(v.faceValue),
                voucherType: v.voucherType,
                expiresAt: v.expiresAt
              }))
            });
          }

          // 4. Claim Activities
          for (const claim of order.claims || []) {
            chunkActivities.push({
              id: claim.id,
              type: 'claim',
              number: claim.claimNumber,
              date: claim.submittedAt,
              status: claim.status,
              amount: Number(claim.claimedAmount),
              approvedAmount: Number(claim.approvedAmount),
              reasonNotes: claim.reasonNotes || '',
              reviewNotes: claim.reviewNotes || '',
              orderId: order.id,
              orderNumber: order.orderNumber,
              orderStatus: claim.status.toUpperCase(),
              outletName,
              outletCode,
              posId: order.posId || order.terminalId || 'N/A',
              customer: order.customer,
              cashierName,
              paymentMethodType: 'CLAIM',
              cashAmount: 0,
              cardAmount: 0,
              bankTransferAmount: 0,
              voucherRedeemedAmount: 0,
              voucherRedeemedCodes: '',
              changeAmount: 0,
              merchantBankName: '',
              merchantTag: '',
              merchantTagId: '',
              merchantCommissionPercent: null,
              merchantCommissionAmount: null,
              merchantBankGlCode: '',
              allianceName,
              allianceCode,
              allianceDiscountPercent,
              allianceMaxDiscount,
              allianceBinNumbers,
              globalDiscountPercent: null,
              globalDiscountAmount: 0,
              manualDiscountNote: '',
              promoCode: '',
              promoName: '',
              couponCode: '',
              fbrInvoiceNumber: order.fbrInvoiceNumber || '',
              fbrStatus: order.fbrStatus || '',
              issuedVouchers: claim.voucher ? [{
                code: claim.voucher.code,
                faceValue: Number(claim.voucher.faceValue),
                voucherType: 'EXCHANGE',
                expiresAt: (claim.voucher as any).expiresAt
              }] : [],
              items: claim.items.map((ci: any) => {
                const orderItem = order.items.find((oi: any) => oi.itemId === ci.itemId);
                const qty = Number(ci.claimedQty || 1);
                const origQty = Number(orderItem?.quantity || 1);
                const ratio = origQty > 0 ? qty / origQty : 1;

                return {
                  itemId: ci.itemId,
                  sku: ci.item?.sku || ci.item?.barCode || 'N/A',
                  barcode: ci.item?.barCode || '',
                  description: ci.item?.description || 'Item',
                  brand: ci.item?.brand?.name || '',
                  category: ci.item?.category?.name || '',
                  size: ci.item?.size?.name || '',
                  color: ci.item?.color?.name || '',
                  quantity: qty,
                  approvedQty: ci.approvedQty,
                  unitPrice: Number(ci.unitPaidPrice || 0),
                  lineTotal: Number(ci.claimedAmount || 0),
                  approvedAmount: Number(ci.approvedAmount || 0),
                  status: ci.itemStatus,
                  taxPercent: orderItem ? Number(orderItem.taxPercent || 0) : 0,
                  taxAmount: orderItem ? ratio * Number(orderItem.taxAmount || 0) : 0,
                  discountPercent: orderItem ? Number(orderItem.discountPercent || 0) : 0,
                  discountAmount: orderItem ? ratio * Number(orderItem.discountAmount || 0) : 0,
                  manualDiscountApplied: 'NO',
                  manualDiscountNote: '',
                };
              })
            });
          }
        });

        // ── In-Memory Filtering on this Chunk ──
        if (start || end) {
          chunkActivities = chunkActivities.filter(act => {
            const actTime = new Date(act.date).getTime();
            if (start && actTime < start.getTime()) return false;
            if (end && actTime > end.getTime()) return false;
            return true;
          });
        }

        if (activityType && activityType !== 'all') {
          if (activityType === 'exchange') {
            chunkActivities = chunkActivities.filter(act => 
              act.type === 'return' || (act.type === 'claim' && act.claimType === 'EXCHANGE')
            );
          } else {
            chunkActivities = chunkActivities.filter(act => act.type === activityType);
          }
        }

        // Write chunk activities to worksheet
        for (const act of chunkActivities) {
          if (act.items && act.items.length > 0) {
            for (const it of act.items) {
              const isAlt = rowIdx % 2 === 1;

              // Format issued vouchers string
              let issuedVouchersCodes = '';
              let issuedVoucherAmount = 0;
              if (act.issuedVouchers && act.issuedVouchers.length > 0) {
                issuedVouchersCodes = act.issuedVouchers.map((v: any) => `${v.voucherType}: ${v.code}`).join(', ');
                issuedVoucherAmount = act.issuedVouchers.reduce((sum: number, v: any) => sum + Number(v.faceValue || 0), 0);
              }

              const sign = act.type === 'sale' ? 1 : -1;
              const qty = sign * Number(it.quantity || 0);
              const unitPrice = Number(it.unitPrice || 0);
              const lineTotal = sign * Number(it.lineTotal || 0);
              const taxPercent = Number(it.taxPercent || 0);
              const taxAmount = sign * Number(it.taxAmount || 0);
              const discountAmount = sign * Number(it.discountAmount || 0);

              const taxDivisor = 1 + (taxPercent / 100);
              const unitPriceWost = unitPrice / taxDivisor;
              const grossLineTotalWost = (unitPrice * qty) / taxDivisor;
              const lineTotalWost = lineTotal / taxDivisor;
              const discountWost = discountAmount / taxDivisor;

              const rowData: Record<string, any> = {
                outletName: act.outletName,
                outletCode: act.outletCode,
                posId: act.posId,
                cashierName: act.cashierName,

                activityDate: new Date(act.date),
                activityType: act.type.toUpperCase(),
                activityNumber: act.number,
                parentOrderNumber: act.type !== 'sale' ? act.orderNumber : '',
                orderStatus: act.orderStatus || '',

                customerName: act.customer?.name || 'Walk-in Customer',
                customerContact: act.customer?.contactNo || '',

                itemSku: it.sku,
                itemBarcode: it.barcode || '',
                itemDescription: it.description,
                itemBrand: it.brand || '',
                itemCategory: it.category || '',
                itemSize: it.size || '',
                itemColor: it.color || '',
                quantity: qty,

                unitPrice: unitPrice,
                unitPriceWost: unitPriceWost,
                grossLineTotalWost: grossLineTotalWost,
                taxPercent: taxPercent / 100,
                taxAmount: taxAmount,
                lineTotal: lineTotal,
                lineTotalWost: lineTotalWost,

                itemDiscountPercent: Number(it.discountPercent || 0) / 100,
                itemDiscountAmount: discountAmount,
                itemDiscountWost: discountWost,
                manualDiscountApplied: it.manualDiscountApplied || 'NO',
                manualDiscountNote: it.manualDiscountNote || '',
                globalDiscountPercent: act.globalDiscountPercent,
                globalDiscountAmount: act.globalDiscountAmount ? sign * act.globalDiscountAmount : 0,
                promoCode: act.promoCode || '',
                promoName: act.promoName || '',
                couponCode: act.couponCode || '',

                allianceName: act.allianceName || '',
                allianceCode: act.allianceCode || '',
                allianceDiscountPercent: act.allianceDiscountPercent,
                allianceMaxDiscount: act.allianceMaxDiscount,
                allianceBinNumbers: act.allianceBinNumbers || '',

                paymentMethodType: act.paymentMethodType,
                cashAmount: act.cashAmount ? sign * act.cashAmount : 0,
                cardAmount: act.cardAmount ? sign * act.cardAmount : 0,
                bankTransferAmount: act.bankTransferAmount ? sign * act.bankTransferAmount : 0,
                voucherRedeemedAmount: act.voucherRedeemedAmount ? sign * act.voucherRedeemedAmount : 0,
                voucherRedeemedCodes: act.voucherRedeemedCodes || '',
                changeAmount: act.changeAmount || 0,

                merchantBankName: act.merchantBankName || '',
                merchantTag: act.merchantTag || '',
                merchantTagId: act.merchantTagId || '',
                merchantCommissionPercent: act.merchantCommissionPercent,
                merchantCommissionAmount: act.merchantCommissionAmount,
                merchantBankGlCode: act.merchantBankGlCode || '',

                issuedVoucherCodes: issuedVouchersCodes,
                issuedVoucherAmount: issuedVoucherAmount,
                claimStatus: act.status || '',
                reasonNotes: act.reasonNotes || '',
                reviewNotes: act.reviewNotes || '',

                fbrInvoiceNumber: act.fbrInvoiceNumber || '',
                fbrStatus: act.fbrStatus || '',
              };

              const dataRow = ws.getRow(rowIdx + 3);
              COLUMNS.forEach((col, colIdx) => {
                const cell = dataRow.getCell(colIdx + 1);
                cell.value = rowData[col.key] ?? null;
                if (col.numFmt) cell.numFmt = col.numFmt;
                cell.alignment = { horizontal: col.align ?? 'left', vertical: 'middle' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${isAlt ? ALT_ROW_BG : 'FFFFFF'}` } };
                cell.font = { size: 9 };
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
          }
        }

        processed += rawOrders.length;
        const pct = totalOrders > 0 ? Math.round((processed / totalOrders) * 95) : 50;
        await job.progress(pct);
        await new Promise((r) => setImmediate(r));

        if (rawOrders.length < CHUNK) break;
      }

      // Summary worksheet
      const summary = workbook.addWorksheet('Summary');
      summary.columns = [{ key: 'label', width: 30 }, { key: 'value', width: 36 }];

      const titleRow = summary.getRow(1);
      titleRow.getCell(1).value = 'POS Sales Activities Comprehensive Export Summary';
      titleRow.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF1E293B' } };
      titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.height = 28;
      titleRow.commit();

      const summaryRows = [
        ['Export Timestamp', new Date().toLocaleString('en-PK')],
        ['Total Activity Line Items Exported', rowIdx],
        ['Total Orders Processed', totalOrders],
        ['Search Query', filters?.search ?? '(none)'],
        ['Start Date Filter', filters?.startDate ? new Date(filters.startDate).toLocaleDateString() : '(all)'],
        ['End Date Filter', filters?.endDate ? new Date(filters.endDate).toLocaleDateString() : '(all)'],
        ['Activity Type Filter', activityType ?? 'ALL'],
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

      // Complete and upload export
      await this.exportHistoryService.completeAndUploadExport(
        prisma,
        jobId,
        filePath,
        `pos-sales-activity-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      await job.progress(100);
      this.logger.log(`[PosSalesActivityExport ${jobId}] Finished processing successfully (${rowIdx} rows)`);

      await this.notificationsService.create({
        userId,
        title: 'POS Sales Activity Export Ready',
        message: `Your comprehensive sales activity export of ${rowIdx.toLocaleString()} items is ready to download.`,
        category: 'export',
        priority: 'high',
        actionType: 'pos-sales-activity-export.ready',
        actionPayload: JSON.stringify({ jobId }),
        entityType: 'pos-sales-activity-export',
        entityId: jobId,
        channels: ['inApp'],
      });

    } catch (error: any) {
      this.logger.error(`[PosSalesActivityExport ${jobId}] FAILED: ${error.message}`, error.stack);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {}
      }

      await this.exportHistoryService.failExport(prisma, jobId);

      await this.notificationsService.create({
        userId,
        title: 'POS Sales Activity Export Failed',
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
