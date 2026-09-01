import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../../upload/upload.service';

export interface OutOfStockReportFilterOptions {
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
  page?: number;
  limit?: number;
  sortBy?: 'salesLast30Days' | 'sku' | 'description' | 'availableQty' | 'deficit' | 'lastSaleDate' | 'unitPrice';
  sortOrder?: 'asc' | 'desc';
}

export interface QueueOutOfStockExportOptions extends OutOfStockReportFilterOptions {
  userId: string;
  format: 'xlsx' | 'pdf';
}

@Injectable()
export class OutOfStockReportService {
  private readonly logger = new Logger(OutOfStockReportService.name);

  constructor(
    @InjectQueue('out-of-stock-export') private readonly exportQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  async getOutOfStockReport(opts: OutOfStockReportFilterOptions) {
    const {
      locationId,
      warehouseId,
      brandIds = [],
      categoryIds = [],
      divisionIds = [],
      genderIds = [],
      seasonIds = [],
      search = '',
      threshold = 'zero',
      minThreshold = 5,
      page = 1,
      limit = 50,
      sortBy = 'salesLast30Days',
      sortOrder = 'desc',
    } = opts;

    // 1. Build Item Filters
    const itemWhere: any = {
      status: 'active',
      isActive: true,
      itemType: { not: 'SERVICE' },
    };

    if (brandIds.length > 0) itemWhere.brandId = { in: brandIds };
    if (categoryIds.length > 0) itemWhere.categoryId = { in: categoryIds };
    if (divisionIds.length > 0) itemWhere.divisionId = { in: divisionIds };
    if (genderIds.length > 0) itemWhere.genderId = { in: genderIds };
    if (seasonIds.length > 0) itemWhere.seasonId = { in: seasonIds };

    if (search && search.trim() !== '') {
      const q = search.trim();
      itemWhere.OR = [
        { sku: { contains: q, mode: 'insensitive' } },
        { barCode: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Fetch all matching items with metadata
    const items = await this.prisma.item.findMany({
      where: itemWhere,
      select: {
        id: true,
        sku: true,
        barCode: true,
        description: true,
        unitPrice: true,
        unitCost: true,
        brand: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
        gender: { select: { id: true, name: true } },
        size: { select: { id: true, name: true } },
        color: { select: { id: true, name: true } },
        season: { select: { id: true, name: true } },
      },
    });

    if (items.length === 0) {
      return {
        data: [],
        summary: {
          totalOutOfStockItems: 0,
          totalNegativeStockItems: 0,
          totalLowStockItems: 0,
          replenishableFromWarehouseCount: 0,
          interStoreTransferableCount: 0,
          companyWideDepletedCount: 0,
          totalPotentialLostSalesValue: 0,
        },
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    const itemIds = items.map((i) => i.id);
    const itemMap = new Map(items.map((i) => [i.id, i]));

    // Fetch all locations and warehouses for reference
    const [allLocations, allWarehouses] = await Promise.all([
      this.prisma.location.findMany({
        where: { isDeleted: false },
        select: { id: true, name: true, code: true, shortCode: true },
      }),
      this.prisma.warehouse.findMany({
        where: { isDeleted: false },
        select: { id: true, name: true, code: true, type: true },
      }),
    ]);

    const locationMap = new Map(allLocations.map((l) => [l.id, l]));
    const warehouseMap = new Map(allWarehouses.map((w) => [w.id, w]));

    // Central warehouses identification
    const centralWarehouseIds = new Set(
      allWarehouses.filter((w) => w.type === 'CENTRAL' || w.type === 'MAIN' || w.type === 'GENERAL').map((w) => w.id)
    );

    // 2. Fetch Stock Balances from StockLedger
    const isSingleLocation = !!(locationId && locationId !== 'all');
    const isSingleWarehouse = !!(warehouseId && warehouseId !== 'all');

    // Aggregate stock ledger by itemId and locationId / warehouseId
    const stockGroupBy = await this.prisma.stockLedger.groupBy({
      by: ['itemId', 'locationId', 'warehouseId'],
      where: {
        itemId: { in: itemIds },
      },
      _sum: { qty: true },
    });

    // Compute on-hand balances map
    // Key: `item_${itemId}_loc_${locationId || warehouseId}` -> onHandQty
    // Also track total enterprise stock, central warehouse stock, and other outlets stock
    const locationStockMap = new Map<string, number>(); // `${itemId}_${locOrWhId}` -> onHand
    const centralStockMap = new Map<string, number>(); // `${itemId}` -> centralWhOnHand
    const enterpriseStockMap = new Map<string, number>(); // `${itemId}` -> totalOnHand
    const outletStockMap = new Map<string, number>(); // `${itemId}` -> totalOutletsOnHand

    for (const row of stockGroupBy) {
      const qty = Number(row._sum.qty || 0);
      const locKey = row.locationId || row.warehouseId;
      if (locKey) {
        const key = `${row.itemId}_${locKey}`;
        locationStockMap.set(key, (locationStockMap.get(key) || 0) + qty);
      }

      enterpriseStockMap.set(row.itemId, (enterpriseStockMap.get(row.itemId) || 0) + qty);

      if (row.warehouseId && centralWarehouseIds.has(row.warehouseId)) {
        centralStockMap.set(row.itemId, (centralStockMap.get(row.itemId) || 0) + qty);
      }

      if (row.locationId) {
        outletStockMap.set(row.itemId, (outletStockMap.get(row.itemId) || 0) + qty);
      }
    }

    // 3. Fetch In-Transit Incoming Transfers
    const inTransitTransfers = await this.prisma.transferRequestItem.findMany({
      where: {
        itemId: { in: itemIds },
        transferRequest: {
          status: { in: ['IN_TRANSIT', 'DISPATCHED', 'PENDING_RECEIPT', 'APPROVED'] },
          ...(isSingleLocation ? { toLocationId: locationId } : {}),
          ...(isSingleWarehouse ? { toWarehouseId: warehouseId } : {}),
        },
      },
      select: {
        itemId: true,
        quantity: true,
        transferRequest: {
          select: {
            toLocationId: true,
            toWarehouseId: true,
          },
        },
      },
    });

    const inTransitMap = new Map<string, number>();
    for (const row of inTransitTransfers) {
      const targetId = row.transferRequest?.toLocationId || row.transferRequest?.toWarehouseId;
      if (targetId) {
        const key = `${row.itemId}_${targetId}`;
        inTransitMap.set(key, (inTransitMap.get(key) || 0) + Number(row.quantity || 0));
      }
    }

    // 4. Fetch Reserved Stock
    const reserves = await this.prisma.stockReserve.groupBy({
      by: ['itemId', 'warehouseId'],
      where: {
        itemId: { in: itemIds },
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      _sum: { quantity: true },
    });

    const reserveMap = new Map<string, number>();
    for (const row of reserves) {
      const key = `${row.itemId}_${row.warehouseId}`;
      reserveMap.set(key, (reserveMap.get(key) || 0) + Number(row._sum.quantity || 0));
    }

    // 5. Fetch Sales Demand & Velocity (Last 30 Days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSales = await this.prisma.salesOrderItem.findMany({
      where: {
        itemId: { in: itemIds },
        salesOrder: {
          createdAt: { gte: thirtyDaysAgo },
          status: { notIn: ['hold', 'hold_expired', 'hold_cancelled', 'draft'] },
          ...(isSingleLocation ? { locationId: locationId } : {}),
        },
      },
      select: {
        itemId: true,
        quantity: true,
        salesOrder: {
          select: {
            locationId: true,
            createdAt: true,
          },
        },
      },
    });

    const salesVelocityMap = new Map<string, { qty30d: number; lastSaleDate: Date | null }>();
    for (const row of recentSales) {
      const locId = row.salesOrder?.locationId || 'all';
      const key = isSingleLocation ? `${row.itemId}_${locId}` : row.itemId;
      const existing = salesVelocityMap.get(key) || { qty30d: 0, lastSaleDate: null };

      existing.qty30d += Number(row.quantity || 0);
      const rowDate = row.salesOrder?.createdAt ? new Date(row.salesOrder.createdAt) : null;
      if (rowDate && (!existing.lastSaleDate || rowDate > existing.lastSaleDate)) {
        existing.lastSaleDate = rowDate;
      }
      salesVelocityMap.set(key, existing);
    }

    // 6. Build Out-of-Stock Records List
    // We check inventory for each item at the specified scope (single location, single warehouse, or company-wide)
    const records: any[] = [];

    // Targets to inspect:
    // If locationId specified -> inspect that location
    // If warehouseId specified -> inspect that warehouse
    // Else -> inspect company-wide or per active location
    const targetLocations = isSingleLocation
      ? allLocations.filter((l) => l.id === locationId)
      : isSingleWarehouse
      ? allWarehouses.filter((w) => w.id === warehouseId)
      : allLocations; // Default multi-outlet inspection

    for (const item of items) {
      if (isSingleLocation || isSingleWarehouse) {
        const targetId = isSingleLocation ? locationId! : warehouseId!;
        const key = `${item.id}_${targetId}`;
        const onHand = locationStockMap.get(key) || 0;
        const reserved = reserveMap.get(key) || 0;
        const available = onHand - reserved;
        const inTransit = inTransitMap.get(key) || 0;

        const centralStock = centralStockMap.get(item.id) || 0;
        const totalOutletStock = outletStockMap.get(item.id) || 0;
        const otherOutletsStock = Math.max(0, totalOutletStock - (isSingleLocation ? onHand : 0));
        const enterpriseStock = enterpriseStockMap.get(item.id) || 0;

        let matchesThreshold = false;
        if (threshold === 'zero') matchesThreshold = available <= 0;
        else if (threshold === 'negative') matchesThreshold = available < 0;
        else if (threshold === 'low_stock') matchesThreshold = available <= minThreshold;
        else matchesThreshold = available <= 0;

        if (matchesThreshold) {
          const locObj = isSingleLocation ? locationMap.get(targetId) : null;
          const whObj = isSingleWarehouse ? warehouseMap.get(targetId) : null;

          const velocity = salesVelocityMap.get(`${item.id}_${targetId}`) || salesVelocityMap.get(item.id) || { qty30d: 0, lastSaleDate: null };

          let replenishmentStatus: 'WAREHOUSE_AVAILABLE' | 'INTER_STORE_AVAILABLE' | 'FULLY_DEPLETED' = 'FULLY_DEPLETED';
          if (centralStock > 0) replenishmentStatus = 'WAREHOUSE_AVAILABLE';
          else if (otherOutletsStock > 0) replenishmentStatus = 'INTER_STORE_AVAILABLE';

          records.push({
            itemId: item.id,
            sku: item.sku,
            barCode: item.barCode || '',
            description: item.description || 'Unknown Product',
            brand: item.brand?.name || 'N/A',
            category: item.category?.name || 'N/A',
            division: item.division?.name || 'N/A',
            gender: item.gender?.name || 'N/A',
            size: item.size?.name || 'N/A',
            color: item.color?.name || 'N/A',
            season: item.season?.name || 'N/A',
            unitPrice: Number(item.unitPrice || 0),
            unitCost: Number(item.unitCost || 0),
            locationId: isSingleLocation ? targetId : null,
            locationName: locObj?.name || whObj?.name || 'All Locations',
            locationCode: locObj?.code || locObj?.shortCode || whObj?.code || 'ALL',
            onHandQty: onHand,
            reservedQty: reserved,
            availableQty: available,
            deficitQty: available < 0 ? Math.abs(available) : 0,
            inTransitQty: inTransit,
            centralWarehouseQty: centralStock,
            otherOutletsQty: otherOutletsStock,
            enterpriseStockQty: enterpriseStock,
            salesLast30Days: velocity.qty30d,
            lastSaleDate: velocity.lastSaleDate,
            replenishmentStatus,
          });
        }
      } else {
        // Company-wide aggregation per item
        const enterpriseStock = enterpriseStockMap.get(item.id) || 0;
        const centralStock = centralStockMap.get(item.id) || 0;
        const totalOutletStock = outletStockMap.get(item.id) || 0;
        const inTransitTotal = inTransitTransfers
          .filter((t) => t.itemId === item.id)
          .reduce((sum, t) => sum + Number(t.quantity || 0), 0);

        let matchesThreshold = false;
        if (threshold === 'zero') matchesThreshold = enterpriseStock <= 0;
        else if (threshold === 'negative') matchesThreshold = enterpriseStock < 0;
        else if (threshold === 'low_stock') matchesThreshold = enterpriseStock <= minThreshold;
        else matchesThreshold = enterpriseStock <= 0;

        if (matchesThreshold) {
          const velocity = salesVelocityMap.get(item.id) || { qty30d: 0, lastSaleDate: null };

          let replenishmentStatus: 'WAREHOUSE_AVAILABLE' | 'INTER_STORE_AVAILABLE' | 'FULLY_DEPLETED' = 'FULLY_DEPLETED';
          if (centralStock > 0) replenishmentStatus = 'WAREHOUSE_AVAILABLE';
          else if (totalOutletStock > 0) replenishmentStatus = 'INTER_STORE_AVAILABLE';

          records.push({
            itemId: item.id,
            sku: item.sku,
            barCode: item.barCode || '',
            description: item.description || 'Unknown Product',
            brand: item.brand?.name || 'N/A',
            category: item.category?.name || 'N/A',
            division: item.division?.name || 'N/A',
            gender: item.gender?.name || 'N/A',
            size: item.size?.name || 'N/A',
            color: item.color?.name || 'N/A',
            season: item.season?.name || 'N/A',
            unitPrice: Number(item.unitPrice || 0),
            unitCost: Number(item.unitCost || 0),
            locationId: null,
            locationName: 'Enterprise-Wide (All Locations)',
            locationCode: 'ALL',
            onHandQty: enterpriseStock,
            reservedQty: 0,
            availableQty: enterpriseStock,
            deficitQty: enterpriseStock < 0 ? Math.abs(enterpriseStock) : 0,
            inTransitQty: inTransitTotal,
            centralWarehouseQty: centralStock,
            otherOutletsQty: totalOutletStock,
            enterpriseStockQty: enterpriseStock,
            salesLast30Days: velocity.qty30d,
            lastSaleDate: velocity.lastSaleDate,
            replenishmentStatus,
          });
        }
      }
    }

    // 7. Calculate Summary Statistics
    let totalOutOfStockItems = 0;
    let totalNegativeStockItems = 0;
    let totalLowStockItems = 0;
    let replenishableFromWarehouseCount = 0;
    let interStoreTransferableCount = 0;
    let companyWideDepletedCount = 0;
    let totalPotentialLostSalesValue = 0;

    for (const r of records) {
      if (r.availableQty <= 0) totalOutOfStockItems++;
      if (r.availableQty < 0) totalNegativeStockItems++;
      if (r.availableQty > 0 && r.availableQty <= minThreshold) totalLowStockItems++;

      if (r.replenishmentStatus === 'WAREHOUSE_AVAILABLE') replenishableFromWarehouseCount++;
      else if (r.replenishmentStatus === 'INTER_STORE_AVAILABLE') interStoreTransferableCount++;
      else companyWideDepletedCount++;

      // Demand estimation: (Units sold in 30 days) * Unit Retail Price
      if (r.salesLast30Days > 0) {
        totalPotentialLostSalesValue += r.salesLast30Days * r.unitPrice;
      }
    }

    // 8. Sorting
    records.sort((a, b) => {
      let valA: any = a[sortBy] ?? '';
      let valB: any = b[sortBy] ?? '';

      if (sortBy === 'lastSaleDate') {
        valA = a.lastSaleDate ? new Date(a.lastSaleDate).getTime() : 0;
        valB = b.lastSaleDate ? new Date(b.lastSaleDate).getTime() : 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // 9. Pagination
    const total = records.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedData = records.slice((page - 1) * limit, page * limit);

    return {
      data: paginatedData,
      summary: {
        totalOutOfStockItems,
        totalNegativeStockItems,
        totalLowStockItems,
        replenishableFromWarehouseCount,
        interStoreTransferableCount,
        companyWideDepletedCount,
        totalPotentialLostSalesValue,
      },
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async queueExport(opts: QueueOutOfStockExportOptions): Promise<{ jobId: string }> {
    const jobId = uuidv4();
    const tenantId = this.prisma.getTenantId() ?? '';
    const tenantDbUrl = this.prisma.getTenantDbUrl() ?? '';
    const ext = opts.format === 'pdf' ? 'pdf' : 'xlsx';

    // Save export history record
    await this.prisma.exportHistory.create({
      data: {
        id: jobId,
        userId: opts.userId,
        fileName: `out-of-stock-report-${new Date().toISOString().slice(0, 10)}.${ext}`,
        filePath: path.join('uploads', 'exports', `export-${jobId}.${ext}`),
        moduleName: 'OUT_OF_STOCK_REPORT',
        status: 'PENDING',
      },
    });

    await this.exportQueue.add(
      {
        jobId,
        userId: opts.userId,
        tenantId,
        tenantDbUrl,
        locationId: opts.locationId,
        warehouseId: opts.warehouseId,
        brandIds: opts.brandIds,
        categoryIds: opts.categoryIds,
        divisionIds: opts.divisionIds,
        genderIds: opts.genderIds,
        seasonIds: opts.seasonIds,
        search: opts.search,
        threshold: opts.threshold,
        minThreshold: opts.minThreshold,
        format: opts.format,
        sortBy: opts.sortBy,
        sortOrder: opts.sortOrder,
      },
      {
        jobId,
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
        timeout: 2 * 60 * 60 * 1000,
      },
    );

    this.logger.log(`[OutOfStockExport] Queued export job ${jobId} for user ${opts.userId} (tenant: ${tenantId})`);
    return { jobId };
  }

  async getJobStatus(jobId: string): Promise<{ state: string; progress: number }> {
    const job = await this.exportQueue.getJob(jobId);
    if (!job) throw new NotFoundException(`Export job ${jobId} not found`);
    const state = await job.getState();
    const progress = typeof job.progress() === 'number' ? (job.progress() as number) : 0;
    return { state, progress };
  }

  async streamExportFile(jobId: string, res: any): Promise<void> {
    const record = await this.prisma.exportHistory.findUnique({
      where: { id: jobId },
      select: { fileName: true, filePath: true },
    });

    if (!record) {
      throw new NotFoundException(`Export record ${jobId} not found in database`);
    }

    try {
      await this.prisma.exportHistory.update({
        where: { id: jobId },
        data: { downloadCount: { increment: 1 } },
      });
    } catch (err: any) {
      this.logger.warn(`Could not update export download count for job ${jobId}: ${err.message}`);
    }

    if (record.filePath.startsWith('s3://')) {
      const s3Key = record.filePath.replace('s3://', '');
      const signedUrl = await this.uploadService.getSignedUrlForDownload(s3Key);
      return res.redirect(signedUrl, 302);
    }

    if (record.filePath.startsWith('http://') || record.filePath.startsWith('https://')) {
      return res.redirect(record.filePath, 302);
    }

    let absolutePath = record.filePath;
    if (!path.isAbsolute(absolutePath)) {
      absolutePath = path.join(process.cwd(), record.filePath);
    }

    if (!fs.existsSync(absolutePath)) {
      const directUploadsPath = path.join(process.cwd(), 'uploads', 'exports', path.basename(record.filePath));
      if (fs.existsSync(directUploadsPath)) {
        absolutePath = directUploadsPath;
      }
    }

    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException(`Export file not found on disk at ${absolutePath}`);
    }

    const stat = fs.statSync(absolutePath);

    const stream = fs.createReadStream(absolutePath);
    stream.on('error', (err) => {
      this.logger.error(`[OutOfStockReportExport] Stream error: ${err.message}`);
    });

    const isPdf = record.fileName.endsWith('.pdf');
    res.header('Content-Type', isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', `attachment; filename="${record.fileName}"`);
    res.header('Content-Length', stat.size);
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(stream);
  }
}
