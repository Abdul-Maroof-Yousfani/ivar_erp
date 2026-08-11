import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../database/prisma.service';
import { PrismaMasterService } from '../database/prisma-master.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface SalesActivityExportJobData {
  jobId: string;
  userId: string;
  tenantId: string;
  tenantDbUrl: string;
  startDate?: string;
  endDate?: string;
  activityType?: string;
  locationId?: string;
  posId?: string;
  search?: string;
}

// ── Colour palette ─────────────────────────────────────────────────────────────
const SUBHEADER_BG  = '2C5282';
const SUBHEADER_FG  = 'F1F5F9';
const BORDER_COLOR  = 'E2E8F0';

const GROUP_COLORS: Record<string, string> = {
  'Activity & Order Info':    '1E3A5F',
  'Item & Article Details':   '2F855A',
  'Discounts & Merchants':    'D97706',
  'Payment Tenders':          '9B2C2C',
  'Voucher & Claim Audit':    '4C1D95',
};

const COLUMNS: {
  header: string;
  key: string;
  width: number;
  group: string;
  numFmt?: string;
  align?: ExcelJS.Alignment['horizontal'];
}[] = [
  // Activity & Order Info
  { header: 'Date & Time',                key: 'dateTime',               width: 20, group: 'Activity & Order Info', align: 'center' },
  { header: 'Activity Type',              key: 'activityType',           width: 15, group: 'Activity & Order Info', align: 'center' },
  { header: 'Activity Number',            key: 'activityNumber',         width: 20, group: 'Activity & Order Info', align: 'center' },
  { header: 'Returned Ref No',            key: 'returnedRefNo',          width: 20, group: 'Activity & Order Info', align: 'center' },
  { header: 'Location / Outlet',          key: 'location',               width: 22, group: 'Activity & Order Info' },
  { header: 'POS Terminal',               key: 'terminal',               width: 16, group: 'Activity & Order Info', align: 'center' },
  { header: 'Cashier',                    key: 'cashierName',            width: 18, group: 'Activity & Order Info' },
  { header: 'Customer Name',              key: 'customerName',           width: 20, group: 'Activity & Order Info' },
  { header: 'Customer Contact',           key: 'customerContact',        width: 16, group: 'Activity & Order Info', align: 'center' },
  { header: 'Order Status',               key: 'orderStatus',            width: 15, group: 'Activity & Order Info', align: 'center' },
  { header: 'FBR Invoice #',              key: 'fbrInvoiceNumber',       width: 20, group: 'Activity & Order Info', align: 'center' },

  // Item & Article Details
  { header: 'SKU',                        key: 'sku',                    width: 15, group: 'Item & Article Details', align: 'center' },
  { header: 'Barcode',                    key: 'barcode',                width: 16, group: 'Item & Article Details', align: 'center' },
  { header: 'Description',                key: 'description',            width: 28, group: 'Item & Article Details' },
  { header: 'Category',                   key: 'category',               width: 18, group: 'Item & Article Details' },
  { header: 'Size',                       key: 'size',                   width: 10, group: 'Item & Article Details', align: 'center' },
  { header: 'Color',                      key: 'color',                  width: 12, group: 'Item & Article Details', align: 'center' },
  { header: 'Brand',                      key: 'brand',                  width: 15, group: 'Item & Article Details' },
  { header: 'Quantity',                   key: 'quantity',               width: 10, group: 'Item & Article Details', numFmt: '#,##0', align: 'right' },
  { header: 'Unit Price (Retail)',        key: 'unitPrice',              width: 16, group: 'Item & Article Details', numFmt: '#,##0.00', align: 'right' },
  { header: 'WOST (Unit Excl. Tax)',     key: 'wostUnit',               width: 18, group: 'Item & Article Details', numFmt: '#,##0.00', align: 'right' },
  { header: 'Total WOST (Line Excl. Tax)',key: 'totalWost',              width: 20, group: 'Item & Article Details', numFmt: '#,##0.00', align: 'right' },
  { header: 'Item Discount',              key: 'discount',               width: 14, group: 'Item & Article Details', numFmt: '#,##0.00', align: 'right' },
  { header: 'Tax Amount',                 key: 'tax',                    width: 14, group: 'Item & Article Details', numFmt: '#,##0.00', align: 'right' },
  { header: 'Net Line Total',             key: 'lineTotal',              width: 16, group: 'Item & Article Details', numFmt: '#,##0.00', align: 'right' },

  // Discounts & Merchants
  { header: 'Promo Campaign',             key: 'promo',                  width: 18, group: 'Discounts & Merchants' },
  { header: 'Coupon Code',                key: 'coupon',                 width: 15, group: 'Discounts & Merchants', align: 'center' },
  { header: 'Alliance Partner',           key: 'alliance',               width: 18, group: 'Discounts & Merchants' },
  { header: 'Alliance Discount %',        key: 'allianceDiscountPercent',width: 16, group: 'Discounts & Merchants', numFmt: '0.00%', align: 'right' },
  { header: 'Manual Discount %',          key: 'manualDiscountPercent',  width: 16, group: 'Discounts & Merchants', numFmt: '0.00%', align: 'right' },
  { header: 'Manual Discount Amount',     key: 'globalDiscount',         width: 18, group: 'Discounts & Merchants', numFmt: '#,##0.00', align: 'right' },
  { header: 'Manual Discount Note',       key: 'manualDiscountNote',     width: 25, group: 'Discounts & Merchants' },
  { header: 'Merchant / Bank',            key: 'merchantName',           width: 20, group: 'Discounts & Merchants' },
  { header: 'Commission Rate %',          key: 'merchantCommission',     width: 16, group: 'Discounts & Merchants', numFmt: '0.00%', align: 'right' },
  { header: 'Bank GL Code',               key: 'merchantGlCode',         width: 15, group: 'Discounts & Merchants', align: 'center' },

  // Payment Tenders (Separate Columns)
  { header: 'Cash Amount',                key: 'cashAmount',             width: 14, group: 'Payment Tenders', numFmt: '#,##0.00', align: 'right' },
  { header: 'Card Amount',                key: 'cardAmount',             width: 14, group: 'Payment Tenders', numFmt: '#,##0.00', align: 'right' },
  { header: 'Voucher Amount',             key: 'voucherAmount',          width: 16, group: 'Payment Tenders', numFmt: '#,##0.00', align: 'right' },
  { header: 'Bank Transfer',              key: 'bankTransferAmount',     width: 14, group: 'Payment Tenders', numFmt: '#,##0.00', align: 'right' },
  { header: 'Credit Account',             key: 'creditAccountAmount',    width: 14, group: 'Payment Tenders', numFmt: '#,##0.00', align: 'right' },
  { header: 'Change Returned',            key: 'changeAmount',           width: 14, group: 'Payment Tenders', numFmt: '#,##0.00', align: 'right' },
  { header: 'Net Grand Total',            key: 'activityAmount',         width: 16, group: 'Payment Tenders', numFmt: '#,##0.00', align: 'right' },

  // Voucher & Claim Audit
  { header: 'Issued Voucher Code',        key: 'issuedVoucher',          width: 20, group: 'Voucher & Claim Audit', align: 'center' },
  { header: 'Issued Voucher Value',       key: 'voucherValue',           width: 16, group: 'Voucher & Claim Audit', numFmt: '#,##0.00', align: 'right' },
  { header: 'Claim Reason / Notes',       key: 'claimNotes',             width: 25, group: 'Voucher & Claim Audit' },
];

@Processor('sales-activity-export')
export class SalesActivityExportProcessor {
  private readonly logger = new Logger(SalesActivityExportProcessor.name);

  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Process()
  async handleExport(job: Job<SalesActivityExportJobData>): Promise<void> {
    const {
      jobId,
      userId,
      tenantId,
      tenantDbUrl,
      startDate,
      endDate,
      activityType,
      locationId,
      posId,
      search,
    } = job.data;

    this.logger.log(`[SalesActivityExport ${jobId}] Starting for user ${userId}`);

    const prisma = new PrismaService({ tenantId, tenantDbUrl } as any);
    const prismaMaster = new PrismaMasterService();

    const exportDir = path.join(process.cwd(), 'uploads', 'exports');
    fs.mkdirSync(exportDir, { recursive: true });
    const filePath = path.join(exportDir, `export-${jobId}.xlsx`);

    try {
      await prismaMaster.onModuleInit();

      // ── Build Base WHERE Filter ─────────────────────────────────────────
      const where: any = {};
      if (posId) {
        if (posId.length > 20) where.terminalId = posId;
        else where.posId = posId;
      }
      if (locationId) where.locationId = locationId;

      where.status = { notIn: ['hold', 'hold_expired', 'hold_cancelled'] };

      // ── Date Range ──────────────────────────────────────────────────────
      let start: Date | undefined = undefined;
      let end: Date | undefined = undefined;

      if (startDate) {
        start = new Date(startDate);
      } else if (!search) {
        start = new Date();
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
      }

      if (endDate) {
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
      } else if (!search) {
        end = new Date();
        end.setHours(23, 59, 59, 999);
      }

      // ── Resolve Target Sales Order IDs ──────────────────────────────────
      const targetOrderIds = new Set<string>();
      const filterByDate = start || end;

      if (filterByDate) {
        const saleRangeQuery: any = {};
        if (start) saleRangeQuery.gte = start;
        if (end) saleRangeQuery.lte = end;

        const salesInRange = await prisma.salesOrder.findMany({
          where: { ...where, createdAt: saleRangeQuery },
          select: { id: true },
        });
        salesInRange.forEach((o) => targetOrderIds.add(o.id));

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
        ledgersInRange.forEach((l) => targetOrderIds.add(l.referenceId));

        const claimRangeQuery: any = {};
        if (start) claimRangeQuery.gte = start;
        if (end) claimRangeQuery.lte = end;

        const claimsInRange = await prisma.posClaim.findMany({
          where: { submittedAt: claimRangeQuery },
          select: { salesOrderId: true },
        });
        claimsInRange.forEach((c) => targetOrderIds.add(c.salesOrderId));
      }

      if (search) {
        const searchTerm = search.trim();
        const searchWhere: any = {
          OR: [
            { orderNumber: { contains: searchTerm, mode: 'insensitive' } },
            { returnNumber: { contains: searchTerm, mode: 'insensitive' } },
            { refundNumber: { contains: searchTerm, mode: 'insensitive' } },
          ],
        };

        const matchedOrders = await prisma.salesOrder.findMany({
          where: { ...where, ...searchWhere },
          select: { id: true },
        });
        const searchOrderIds = new Set(matchedOrders.map((o) => o.id));

        const matchedClaims = await prisma.posClaim.findMany({
          where: { claimNumber: { contains: searchTerm, mode: 'insensitive' } },
          select: { salesOrderId: true },
        });
        matchedClaims.forEach((c) => searchOrderIds.add(c.salesOrderId));

        const matchedIssuedVouchers = await prisma.voucher.findMany({
          where: { code: { contains: searchTerm, mode: 'insensitive' }, sourceOrderId: { not: null } },
          select: { sourceOrderId: true },
        });
        matchedIssuedVouchers.forEach((v) => searchOrderIds.add(v.sourceOrderId as string));

        const matchedRedemptions = await prisma.voucherRedemption.findMany({
          where: { voucher: { code: { contains: searchTerm, mode: 'insensitive' } } },
          select: { orderId: true },
        });
        matchedRedemptions.forEach((r) => searchOrderIds.add(r.orderId));

        if (filterByDate) {
          const intersectIds = Array.from(targetOrderIds).filter((id) => searchOrderIds.has(id));
          targetOrderIds.clear();
          intersectIds.forEach((id) => targetOrderIds.add(id));
        } else {
          searchOrderIds.forEach((id) => targetOrderIds.add(id));
        }
      }

      where.id = { in: Array.from(targetOrderIds) };

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

      const ws = workbook.addWorksheet('Sales Activity Detail Log', {
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
      let processedCount = 0;

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
                  select: {
                    description: true,
                    sku: true,
                    barCode: true,
                    unitCost: true,
                    size: { select: { name: true } },
                    color: { select: { name: true } },
                    brand: { select: { name: true } },
                    category: { select: { name: true } },
                  },
                },
              },
            },
            customer: { select: { id: true, name: true, contactNo: true } },
            promo: { select: { name: true, code: true } },
            coupon: { select: { code: true, description: true } },
            alliance: { select: { partnerName: true, code: true, discountPercent: true, maxDiscount: true } },
            merchant: { select: { id: true, description: true, bankName: true, commissionRate: true, bankGlCode: true } },
            voucherRedemptions: {
              select: {
                amountUsed: true,
                voucher: { select: { code: true, faceValue: true } },
              },
            },
            claims: {
              include: {
                items: {
                  include: {
                    item: { select: { description: true, sku: true, barCode: true, unitCost: true } },
                  },
                },
                voucher: { select: { code: true, faceValue: true } },
              },
              orderBy: { submittedAt: 'desc' },
            },
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

        // Fetch StockLedger entries (for returns/refunds) for this chunk
        const orderIds = chunk.map((o) => o.id);
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
            createdAt: true,
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
          },
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

        // ── Process orders in this chunk into flat activities ──
        for (const order of chunk) {
          const locationName = locationMap.get(order.locationId || '') || '-';
          const cashierName  = cashierMap.get(order.cashierUserId || '') || '-';
          const customerName = order.customer?.name || 'Walk-in';
          const customerContact = order.customer?.contactNo || '-';
          const posTerminal   = order.terminalId || order.posId || '-';

          const orderVouchers = issuedVouchersMap.get(order.id) || [];
          const orderLedgers  = returnEntriesMap.get(order.id) || [];

          // Tenders breakdown
          const voucherTotalRedeemed = (order.voucherRedemptions || []).reduce(
            (sum: number, r: any) => sum + Number(r.amountUsed || 0),
            0
          );
          const orderVoucherAmt = voucherTotalRedeemed || Number(order.voucherAmount || 0);
          const orderCashAmt    = Number(order.cashAmount || 0);
          const orderCardAmt    = Number(order.cardAmount || 0);
          const orderChangeAmt  = Number(order.changeAmount || 0);

          let orderBankTransferAmt = 0;
          let orderCreditAccountAmt = 0;
          if (order.paymentMethod === 'bank_transfer') orderBankTransferAmt = Number(order.grandTotal);
          else if (order.paymentMethod === 'credit_account') orderCreditAccountAmt = Number(order.grandTotal);

          const promoName = order.promo ? `${order.promo.name} (${order.promo.code})` : '-';
          const couponCode = order.coupon?.code || '-';
          const allianceName = order.alliance ? `${order.alliance.partnerName} (${order.alliance.code})` : '-';
          const alliancePct = order.alliance?.discountPercent ? Number(order.alliance.discountPercent) / 100 : null;

          const manualDiscPercent = order.globalDiscountPercent ? Number(order.globalDiscountPercent) / 100 : null;
          const manualDiscAmount = order.globalDiscountAmount ? Number(order.globalDiscountAmount) : null;
          const manualDiscNote = order.manualDiscountNote || '-';

          const merchantName = order.merchant ? (order.merchant.bankName || order.merchant.description || 'Merchant') : '-';
          const merchantComm = order.merchant?.commissionRate ? Number(order.merchant.commissionRate) / 100 : null;
          const merchantGl = order.merchant?.bankGlCode || '-';
          const fbrNum = order.fbrInvoiceNumber || '-';

          // 1. Sale Activity
          if (!activityType || activityType === 'all' || activityType === 'sale') {
            const saleIssuedVouchers = orderVouchers.filter((v) => ['GIFT', 'CREDIT'].includes(v.voucherType));
            const firstVoucher = saleIssuedVouchers[0];

            order.items.forEach((item) => {
              const dataRow = ws.getRow(rowIdx + 3);

              const lineTot = Number(item.lineTotal || 0);
              const taxAmt  = Number(item.taxAmount || 0);
              const totalWost = lineTot - taxAmt;
              const wostUnit = item.quantity > 0 ? totalWost / item.quantity : 0;

              const rowData: Record<string, any> = {
                dateTime:               new Date(order.createdAt),
                activityType:           'Sale',
                activityNumber:         order.orderNumber,
                returnedRefNo:          '-',
                location:               locationName,
                terminal:               posTerminal,
                cashierName:            cashierName,
                customerName:           customerName,
                customerContact:        customerContact,
                orderStatus:            order.status,
                fbrInvoiceNumber:       fbrNum,

                sku:                    item.item?.sku || item.item?.barCode || '-',
                barcode:                item.item?.barCode || '-',
                description:            item.item?.description || '-',
                category:               item.item?.category?.name || '-',
                size:                   item.item?.size?.name || '-',
                color:                  item.item?.color?.name || '-',
                brand:                  item.item?.brand?.name || '-',
                quantity:               item.quantity,
                unitPrice:              Number(item.unitPrice),
                wostUnit:               wostUnit,
                totalWost:              totalWost,
                discount:               Number(item.discountAmount),
                tax:                    taxAmt,
                lineTotal:              lineTot,

                promo:                  promoName,
                coupon:                 couponCode,
                alliance:               allianceName,
                allianceDiscountPercent:alliancePct,
                manualDiscountPercent:  manualDiscPercent,
                globalDiscount:         manualDiscAmount,
                manualDiscountNote:     manualDiscNote,
                merchantName:           merchantName,
                merchantCommission:     merchantComm,
                merchantGlCode:         merchantGl,

                cashAmount:             orderCashAmt,
                cardAmount:             orderCardAmt,
                voucherAmount:          orderVoucherAmt,
                bankTransferAmount:     orderBankTransferAmt,
                creditAccountAmount:    orderCreditAccountAmt,
                changeAmount:           orderChangeAmt,
                activityAmount:         Number(order.grandTotal),

                issuedVoucher:          firstVoucher ? `${firstVoucher.code} (${firstVoucher.voucherType})` : '-',
                voucherValue:           firstVoucher ? Number(firstVoucher.faceValue) : null,
                claimNotes:             '-',
              };

              COLUMNS.forEach((col, colIdx) => {
                const cell = dataRow.getCell(colIdx + 1);
                cell.value = rowData[col.key] ?? null;
                if (col.numFmt) cell.numFmt = col.numFmt;
                cell.alignment = { horizontal: col.align ?? 'left', vertical: 'middle' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
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
            });
          }

          // 2. Return Activity
          const returnLedgers = orderLedgers.filter((l) => l.referenceType === 'POS_RETURN');
          if (order.returnNumber || returnLedgers.length > 0) {
            if (!activityType || activityType === 'all' || activityType === 'return') {
              const exchangeVoucher = orderVouchers.find((v) => v.voucherType === 'EXCHANGE');
              const returnDate = returnLedgers.length > 0 ? returnLedgers[returnLedgers.length - 1].createdAt : order.updatedAt;

              const returnedItems = returnLedgers.map((l) => {
                const orderItem = order.items.find((oi) => oi.itemId === l.itemId);
                const price = orderItem ? Number(orderItem.unitPrice) : 0;
                const lineTot = orderItem ? Math.abs(Number(l.qty)) * Number(orderItem.unitPrice) : 0;
                const taxAmt = orderItem ? (Number(orderItem.taxAmount || 0) / Number(orderItem.quantity || 1)) * Math.abs(Number(l.qty)) : 0;
                const totWost = lineTot - taxAmt;
                const qty = Math.abs(Number(l.qty));

                return {
                  sku: orderItem?.item?.sku || orderItem?.item?.barCode || '-',
                  barcode: orderItem?.item?.barCode || '-',
                  description: orderItem?.item?.description || 'Item',
                  category: orderItem?.item?.category?.name || '-',
                  size: orderItem?.item?.size?.name || '-',
                  color: orderItem?.item?.color?.name || '-',
                  brand: orderItem?.item?.brand?.name || '-',
                  quantity: qty,
                  price: price,
                  wostUnit: qty > 0 ? totWost / qty : 0,
                  totalWost: totWost,
                  tax: taxAmt,
                  lineTotal: lineTot,
                };
              });

              const totalReturnAmount = exchangeVoucher
                ? Number(exchangeVoucher.faceValue)
                : returnedItems.reduce((s, i) => s + i.lineTotal, 0);

              const itemsToRender = returnedItems.length ? returnedItems : [{ sku: '-', barcode: '-', description: 'Return Slip', category: '-', size: '-', color: '-', brand: '-', quantity: 1, price: 0, wostUnit: 0, totalWost: 0, tax: 0, lineTotal: 0 }];

              itemsToRender.forEach((item) => {
                const dataRow = ws.getRow(rowIdx + 3);

                const rowData: Record<string, any> = {
                  dateTime:               new Date(returnDate),
                  activityType:           'Return',
                  activityNumber:         order.returnNumber || 'Return',
                  returnedRefNo:          order.orderNumber,
                  location:               locationName,
                  terminal:               posTerminal,
                  cashierName:            cashierName,
                  customerName:           customerName,
                  customerContact:        customerContact,
                  orderStatus:            order.status,
                  fbrInvoiceNumber:       fbrNum,

                  sku:                    item.sku,
                  barcode:                item.barcode,
                  description:            item.description,
                  category:               item.category,
                  size:                   item.size,
                  color:                  item.color,
                  brand:                  item.brand,
                  quantity:               item.quantity,
                  unitPrice:              item.price,
                  wostUnit:               item.wostUnit,
                  totalWost:              item.totalWost,
                  discount:               0,
                  tax:                    item.tax,
                  lineTotal:              item.lineTotal,

                  promo:                  promoName,
                  coupon:                 couponCode,
                  alliance:               allianceName,
                  allianceDiscountPercent:alliancePct,
                  manualDiscountPercent:  manualDiscPercent,
                  globalDiscount:         manualDiscAmount,
                  manualDiscountNote:     manualDiscNote,
                  merchantName:           merchantName,
                  merchantCommission:     merchantComm,
                  merchantGlCode:         merchantGl,

                  cashAmount:             0,
                  cardAmount:             0,
                  voucherAmount:          exchangeVoucher ? Number(exchangeVoucher.faceValue) : totalReturnAmount,
                  bankTransferAmount:     0,
                  creditAccountAmount:    0,
                  changeAmount:           0,
                  activityAmount:         totalReturnAmount,

                  issuedVoucher:          exchangeVoucher ? `${exchangeVoucher.code} (EXCHANGE)` : '-',
                  voucherValue:           exchangeVoucher ? Number(exchangeVoucher.faceValue) : null,
                  claimNotes:             '-',
                };

                COLUMNS.forEach((col, colIdx) => {
                  const cell = dataRow.getCell(colIdx + 1);
                  cell.value = rowData[col.key] ?? null;
                  if (col.numFmt) cell.numFmt = col.numFmt;
                  cell.alignment = { horizontal: col.align ?? 'left', vertical: 'middle' };
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
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
              });
            }
          }

          // 3. Refund Activity
          const refundLedgers = orderLedgers.filter((l) => l.referenceType === 'POS_REFUND');
          if (order.refundNumber || refundLedgers.length > 0) {
            if (!activityType || activityType === 'all' || activityType === 'refund') {
              const saleIssuedVouchers = orderVouchers.filter((v) => ['GIFT', 'CREDIT'].includes(v.voucherType));
              const refundVouchers = orderVouchers.filter((v) => ['REFUND', 'CREDIT'].includes(v.voucherType) && !saleIssuedVouchers.some((sv) => sv.id === v.id));
              const refundDate = refundLedgers.length > 0 ? refundLedgers[refundLedgers.length - 1].createdAt : order.updatedAt;

              const refundedItems = refundLedgers.map((l) => {
                const orderItem = order.items.find((oi) => oi.itemId === l.itemId);
                const price = orderItem ? Number(orderItem.unitPrice) : 0;
                const lineTot = orderItem ? Math.abs(Number(l.qty)) * Number(orderItem.unitPrice) : 0;
                const taxAmt = orderItem ? (Number(orderItem.taxAmount || 0) / Number(orderItem.quantity || 1)) * Math.abs(Number(l.qty)) : 0;
                const totWost = lineTot - taxAmt;
                const qty = Math.abs(Number(l.qty));

                return {
                  sku: orderItem?.item?.sku || orderItem?.item?.barCode || '-',
                  barcode: orderItem?.item?.barCode || '-',
                  description: orderItem?.item?.description || 'Item',
                  category: orderItem?.item?.category?.name || '-',
                  size: orderItem?.item?.size?.name || '-',
                  color: orderItem?.item?.color?.name || '-',
                  brand: orderItem?.item?.brand?.name || '-',
                  quantity: qty,
                  price: price,
                  wostUnit: qty > 0 ? totWost / qty : 0,
                  totalWost: totWost,
                  tax: taxAmt,
                  lineTotal: lineTot,
                };
              });

              const totalRefundAmount = refundVouchers.length > 0
                ? refundVouchers.reduce((s, v) => s + Number(v.faceValue), 0)
                : refundedItems.reduce((s, i) => s + i.lineTotal, 0);

              const firstRefundVoucher = refundVouchers[0];

              const itemsToRender = refundedItems.length ? refundedItems : [{ sku: '-', barcode: '-', description: 'Cash Refund', category: '-', size: '-', color: '-', brand: '-', quantity: 1, price: 0, wostUnit: 0, totalWost: 0, tax: 0, lineTotal: 0 }];

              itemsToRender.forEach((item) => {
                const dataRow = ws.getRow(rowIdx + 3);

                const rowData: Record<string, any> = {
                  dateTime:               new Date(refundDate),
                  activityType:           'Refund',
                  activityNumber:         order.refundNumber || 'Refund',
                  returnedRefNo:          order.orderNumber,
                  location:               locationName,
                  terminal:               posTerminal,
                  cashierName:            cashierName,
                  customerName:           customerName,
                  customerContact:        customerContact,
                  orderStatus:            order.status,
                  fbrInvoiceNumber:       fbrNum,

                  sku:                    item.sku,
                  barcode:                item.barcode,
                  description:            item.description,
                  category:               item.category,
                  size:                   item.size,
                  color:                  item.color,
                  brand:                  item.brand,
                  quantity:               item.quantity,
                  unitPrice:              item.price,
                  wostUnit:               item.wostUnit,
                  totalWost:              item.totalWost,
                  discount:               0,
                  tax:                    item.tax,
                  lineTotal:              item.lineTotal,

                  promo:                  promoName,
                  coupon:                 couponCode,
                  alliance:               allianceName,
                  allianceDiscountPercent:alliancePct,
                  manualDiscountPercent:  manualDiscPercent,
                  globalDiscount:         manualDiscAmount,
                  manualDiscountNote:     manualDiscNote,
                  merchantName:           merchantName,
                  merchantCommission:     merchantComm,
                  merchantGlCode:         merchantGl,

                  cashAmount:             totalRefundAmount,
                  cardAmount:             0,
                  voucherAmount:          firstRefundVoucher ? Number(firstRefundVoucher.faceValue) : 0,
                  bankTransferAmount:     0,
                  creditAccountAmount:    0,
                  changeAmount:           0,
                  activityAmount:         totalRefundAmount,

                  issuedVoucher:          firstRefundVoucher ? `${firstRefundVoucher.code} (${firstRefundVoucher.voucherType})` : '-',
                  voucherValue:           firstRefundVoucher ? Number(firstRefundVoucher.faceValue) : null,
                  claimNotes:             '-',
                };

                COLUMNS.forEach((col, colIdx) => {
                  const cell = dataRow.getCell(colIdx + 1);
                  cell.value = rowData[col.key] ?? null;
                  if (col.numFmt) cell.numFmt = col.numFmt;
                  cell.alignment = { horizontal: col.align ?? 'left', vertical: 'middle' };
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
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
              });
            }
          }

          // 4. Claim Activities
          if (!activityType || activityType === 'all' || activityType === 'claim') {
            for (const claim of order.claims || []) {
              const claimVoucher = claim.voucher;
              const claimNotes = [claim.reasonNotes, claim.reviewNotes].filter(Boolean).join(' | ') || '-';
              const itemsToRender = claim.items || [];

              itemsToRender.forEach((ci: any) => {
                const dataRow = ws.getRow(rowIdx + 3);

                const rowData: Record<string, any> = {
                  dateTime:               new Date(claim.submittedAt),
                  activityType:           'Claim',
                  activityNumber:         claim.claimNumber,
                  returnedRefNo:          order.orderNumber,
                  location:               locationName,
                  terminal:               posTerminal,
                  cashierName:            cashierName,
                  customerName:           customerName,
                  customerContact:        customerContact,
                  orderStatus:            order.status,
                  fbrInvoiceNumber:       fbrNum,

                  sku:                    ci.item?.sku || ci.item?.barCode || '-',
                  barcode:                ci.item?.barCode || '-',
                  description:            ci.item?.description || 'Item Claim',
                  category:               '-',
                  size:                   '-',
                  color:                  '-',
                  brand:                  '-',
                  quantity:               ci.claimedQty,
                  unitPrice:              0,
                  wostUnit:               0,
                  totalWost:              0,
                  discount:               0,
                  tax:                    0,
                  lineTotal:              0,

                  promo:                  promoName,
                  coupon:                 couponCode,
                  alliance:               allianceName,
                  allianceDiscountPercent:alliancePct,
                  manualDiscountPercent:  manualDiscPercent,
                  globalDiscount:         manualDiscAmount,
                  manualDiscountNote:     manualDiscNote,
                  merchantName:           merchantName,
                  merchantCommission:     merchantComm,
                  merchantGlCode:         merchantGl,

                  cashAmount:             0,
                  cardAmount:             0,
                  voucherAmount:          claimVoucher ? Number(claimVoucher.faceValue) : 0,
                  bankTransferAmount:     0,
                  creditAccountAmount:    0,
                  changeAmount:           0,
                  activityAmount:         Number(claim.claimedAmount),

                  issuedVoucher:          claimVoucher ? `${claimVoucher.code} (EXCHANGE)` : '-',
                  voucherValue:           claimVoucher ? Number(claimVoucher.faceValue) : null,
                  claimNotes:             claimNotes,
                };

                COLUMNS.forEach((col, colIdx) => {
                  const cell = dataRow.getCell(colIdx + 1);
                  cell.value = rowData[col.key] ?? null;
                  if (col.numFmt) cell.numFmt = col.numFmt;
                  cell.alignment = { horizontal: col.align ?? 'left', vertical: 'middle' };
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
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
              });
            }
          }

          processedCount++;
        }

        cursor = chunk[chunk.length - 1].id;
        await job.progress(Math.min(99, Math.round((processedCount / (where.id.in.length || 1)) * 100)));
      }

      await workbook.commit();
      this.logger.log(`[SalesActivityExport ${jobId}] Finished writing ${rowIdx} rows to ${filePath}`);

      // ── Send Notification ──────────────────────────────────────────────
      await this.notificationsService.create({
        userId,
        title: 'Sales Activity Export Ready',
        message: `Your POS Sales Activity detailed export of ${rowIdx.toLocaleString()} items is ready to download.`,
        category: 'export',
        priority: 'high',
        actionType: 'sales-activity-export.ready',
        actionPayload: JSON.stringify({ jobId }),
        entityType: 'sales-activity-export',
        entityId: jobId,
        channels: ['inApp'],
      });
    } catch (err: any) {
      this.logger.error(`[SalesActivityExport ${jobId}] Error: ${err.message}`, err.stack);

      await this.notificationsService.create({
        userId,
        title: 'Sales Activity Export Failed',
        message: `Sales Activity export failed: ${err.message}`,
        category: 'export',
        priority: 'urgent',
        actionType: 'sales-activity-export.failed',
        actionPayload: JSON.stringify({ jobId, error: err.message }),
        entityType: 'sales-activity-export',
        entityId: jobId,
        channels: ['inApp'],
      });

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw err;
    }
  }
}
