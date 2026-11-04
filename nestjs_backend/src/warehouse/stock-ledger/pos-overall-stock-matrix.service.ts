import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';

export interface PosStockMatrixQueryOptions {
  search?: string;
  brandId?: string;
  categoryId?: string;
  divisionId?: string;
  genderId?: string;
  sizeId?: string;
  colorId?: string;
  locationId?: string;
  currentLocationId?: string;
  inStockOnly?: boolean;
  outOfStockHereOnly?: boolean;
  page?: number;
  limit?: number;
  asOfDate?: string;
  format?: 'xlsx' | 'csv';
}

export interface PosMatrixItem {
  id: string;
  brand: string;
  division: string;
  category: string;
  gender: string;
  silhouette: string;
  sku: string;
  articleName: string;
  size: string;
  color: string;
  barcode: string;
  availableQty: number;
  inTransit: number;
  stockReserved: number;
  pendingInvoice: number;
  totalBalance: number;
  sellingPrice: number;
  sellingValue: number;
  storeStocks: Record<string, number>; // locationId -> qty
  warehouseStocks: Record<string, number>; // warehouseId -> qty
  currentStoreQty?: number;
  storesWithStock: Array<{
    locationId: string;
    locationName: string;
    shortCode?: string;
    phone?: string;
    address?: string;
    qty: number;
  }>;
}

@Injectable()
export class PosOverallStockMatrixService {
  private readonly logger = new Logger(PosOverallStockMatrixService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Main matrix data fetcher with pagination, database-level stock filtering, and search
   */
  async getMatrixData(opts: PosStockMatrixQueryOptions) {
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(opts.limit) || 50));
    const skip = (page - 1) * limit;

    const targetDate = opts.asOfDate ? new Date(opts.asOfDate) : new Date();
    targetDate.setHours(23, 59, 59, 999);

    // 1. Fetch active retail stock locations & warehouses
    const [locations, warehouses] = await Promise.all([
      this.prisma.location.findMany({
        where: { isStockLocation: true, isDeleted: false },
        select: { id: true, name: true, code: true, shortCode: true, phone: true, address: true },
        orderBy: [{ shortCode: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.warehouse.findMany({
        where: { isDeleted: false, isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const locationIds = locations.map((l) => l.id);
    const warehouseIds = warehouses.map((w) => w.id);

    // 2. Build Item filter
    const itemWhere: any = {
      isActive: true,
    };

    if (opts.brandId) itemWhere.brandId = opts.brandId;
    if (opts.categoryId) itemWhere.categoryId = opts.categoryId;
    if (opts.divisionId) itemWhere.divisionId = opts.divisionId;
    if (opts.genderId) itemWhere.genderId = opts.genderId;
    if (opts.sizeId) itemWhere.sizeId = opts.sizeId;
    if (opts.colorId) itemWhere.colorId = opts.colorId;

    if (opts.search && opts.search.trim()) {
      const q = opts.search.trim();
      itemWhere.OR = [
        { sku: { contains: q, mode: 'insensitive' } },
        { barCode: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { brand: { name: { contains: q, mode: 'insensitive' } } },
        { silhouette: { name: { contains: q, mode: 'insensitive' } } },
        { color: { name: { contains: q, mode: 'insensitive' } } },
        { size: { name: { contains: q, mode: 'insensitive' } } },
        { category: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // 3. Database-level stock filters for POS inquiry modes
    if (opts.inStockOnly) {
      // Find all itemIds that currently have quantity > 0 across StockLedger or InventoryItem
      const [ledgerStock, inStockInv] = await Promise.all([
        this.prisma.stockLedger.groupBy({
          by: ['itemId'],
          where: {
            createdAt: { lte: targetDate },
          },
          _sum: { qty: true },
        }),
        this.prisma.inventoryItem.groupBy({
          by: ['itemId'],
          where: {
            status: 'AVAILABLE',
            quantity: { gt: 0 },
            createdAt: { lte: targetDate },
          },
        }),
      ]);

      const inStockSet = new Set<string>();
      for (const row of ledgerStock) {
        if (Number(row._sum.qty || 0) > 0) {
          inStockSet.add(row.itemId);
        }
      }
      for (const row of inStockInv) {
        inStockSet.add(row.itemId);
      }

      const inStockIds = Array.from(inStockSet);

      if (inStockIds.length === 0) {
        return {
          items: [],
          stores: locations,
          warehouses,
          totals: {
            totalVariants: 0,
            totalAvailable: 0,
            totalTransit: 0,
            totalReserved: 0,
            totalBalance: 0,
            totalSellingValue: 0,
          },
          pagination: { page: 1, limit, total: 0, totalPages: 1 },
        };
      }

      const inStockCondition = [
        { id: { in: inStockIds } },
        { itemId: { in: inStockIds } },
      ];

      if (itemWhere.OR) {
        itemWhere.AND = [{ OR: itemWhere.OR }, { OR: inStockCondition }];
        delete itemWhere.OR;
      } else {
        itemWhere.OR = inStockCondition;
      }
    } else if (opts.outOfStockHereOnly && opts.currentLocationId) {
      // Find items that have quantity > 0 elsewhere, but <= 0 in current store
      const [hereLedger, hereInv, otherLedger, otherInv] = await Promise.all([
        this.prisma.stockLedger.groupBy({
          by: ['itemId'],
          where: {
            locationId: opts.currentLocationId,
            createdAt: { lte: targetDate },
          },
          _sum: { qty: true },
        }),
        this.prisma.inventoryItem.groupBy({
          by: ['itemId'],
          where: {
            locationId: opts.currentLocationId,
            status: 'AVAILABLE',
            quantity: { gt: 0 },
            createdAt: { lte: targetDate },
          },
        }),
        this.prisma.stockLedger.groupBy({
          by: ['itemId'],
          where: {
            OR: [
              { locationId: { not: opts.currentLocationId } },
              { locationId: null },
            ],
            createdAt: { lte: targetDate },
          },
          _sum: { qty: true },
        }),
        this.prisma.inventoryItem.groupBy({
          by: ['itemId'],
          where: {
            OR: [
              { locationId: { not: opts.currentLocationId } },
              { locationId: null },
            ],
            status: 'AVAILABLE',
            quantity: { gt: 0 },
            createdAt: { lte: targetDate },
          },
        }),
      ]);

      const herePositive = new Set<string>();
      for (const row of hereLedger) {
        if (Number(row._sum.qty || 0) > 0) herePositive.add(row.itemId);
      }
      for (const row of hereInv) {
        herePositive.add(row.itemId);
      }

      const otherPositive = new Set<string>();
      for (const row of otherLedger) {
        if (Number(row._sum.qty || 0) > 0) otherPositive.add(row.itemId);
      }
      for (const row of otherInv) {
        otherPositive.add(row.itemId);
      }

      const candidateIds = Array.from(otherPositive).filter((id) => !herePositive.has(id));

      if (candidateIds.length === 0) {
        return {
          items: [],
          stores: locations,
          warehouses,
          totals: {
            totalVariants: 0,
            totalAvailable: 0,
            totalTransit: 0,
            totalReserved: 0,
            totalBalance: 0,
            totalSellingValue: 0,
          },
          pagination: { page: 1, limit, total: 0, totalPages: 1 },
        };
      }

      const outHereCondition = [
        { id: { in: candidateIds } },
        { itemId: { in: candidateIds } },
      ];

      if (itemWhere.OR) {
        itemWhere.AND = [{ OR: itemWhere.OR }, { OR: outHereCondition }];
        delete itemWhere.OR;
      } else {
        itemWhere.OR = outHereCondition;
      }
    }

    // 4. Count total matching items
    const totalCount = await this.prisma.item.count({ where: itemWhere });

    // 5. Fetch page items with relations
    const items = await this.prisma.item.findMany({
      where: itemWhere,
      skip,
      take: limit,
      include: {
        brand: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        gender: { select: { id: true, name: true } },
        silhouette: { select: { id: true, name: true } },
        size: { select: { id: true, name: true } },
        color: { select: { id: true, name: true } },
      },
      orderBy: [{ sku: 'asc' }, { size: { name: 'asc' } }],
    });

    if (items.length === 0) {
      return {
        items: [],
        stores: locations,
        warehouses,
        totals: {
          totalVariants: totalCount,
          totalAvailable: 0,
          totalTransit: 0,
          totalReserved: 0,
          totalBalance: 0,
          totalSellingValue: 0,
        },
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit) || 1,
        },
      };
    }

    // Collect both item.id (UUID) and item.itemId (Code) to support both relation styles
    const itemFilterIds: string[] = [];
    for (const item of items) {
      if (item.id) itemFilterIds.push(item.id);
      if (item.itemId && item.itemId !== item.id) itemFilterIds.push(item.itemId);
    }

    // 6. Query stock levels across locations and warehouses from BOTH StockLedger and InventoryItem
    const [
      ledgerLocGroup,
      ledgerWhGroup,
      invLocGroup,
      invWhGroup,
      transitItems,
      reservedItems,
    ] = await Promise.all([
      this.prisma.stockLedger.groupBy({
        by: ['itemId', 'locationId'],
        where: {
          itemId: { in: itemFilterIds },
          locationId: { in: locationIds },
          createdAt: { lte: targetDate },
        },
        _sum: { qty: true },
      }),
      this.prisma.stockLedger.groupBy({
        by: ['itemId', 'warehouseId'],
        where: {
          itemId: { in: itemFilterIds },
          warehouseId: { in: warehouseIds },
          locationId: null,
          createdAt: { lte: targetDate },
        },
        _sum: { qty: true },
      }),
      this.prisma.inventoryItem.groupBy({
        by: ['itemId', 'locationId'],
        where: {
          itemId: { in: itemFilterIds },
          locationId: { in: locationIds },
          status: 'AVAILABLE',
          createdAt: { lte: targetDate },
        },
        _sum: { quantity: true },
      }),
      this.prisma.inventoryItem.groupBy({
        by: ['itemId', 'warehouseId'],
        where: {
          itemId: { in: itemFilterIds },
          warehouseId: { in: warehouseIds },
          locationId: null,
          status: 'AVAILABLE',
          createdAt: { lte: targetDate },
        },
        _sum: { quantity: true },
      }),
      this.prisma.transferRequestItem.findMany({
        where: {
          itemId: { in: itemFilterIds },
          transferRequest: {
            createdAt: { lte: targetDate },
            status: {
              in: [
                'PENDING',
                'PENDING_CHECKER',
                'PENDING_AUTHORIZER',
                'PENDING_APPROVER',
                'APPROVED',
                'SOURCE_APPROVED',
                'IN_TRANSIT',
                'PARTIAL_RECEIVED',
              ],
            },
          },
        },
        select: { itemId: true, quantity: true, fulfilledQty: true },
      }),
      this.prisma.stockReserve.groupBy({
        by: ['itemId'],
        where: {
          itemId: { in: itemFilterIds },
          createdAt: { lte: targetDate },
        },
        _sum: { quantity: true },
      }),
    ]);

    // Build Maps for fast O(1) lookups
    const locLedgerMap = new Map<string, number>();
    for (const row of ledgerLocGroup) {
      if (row.locationId) {
        locLedgerMap.set(`${row.itemId}_${row.locationId}`, Number(row._sum.qty || 0));
      }
    }

    const whLedgerMap = new Map<string, number>();
    for (const row of ledgerWhGroup) {
      if (row.warehouseId) {
        whLedgerMap.set(`${row.itemId}_${row.warehouseId}`, Number(row._sum.qty || 0));
      }
    }

    const locInvMap = new Map<string, number>();
    for (const row of invLocGroup) {
      if (row.locationId) {
        locInvMap.set(`${row.itemId}_${row.locationId}`, Number(row._sum.quantity || 0));
      }
    }

    const whInvMap = new Map<string, number>();
    for (const row of invWhGroup) {
      if (row.warehouseId) {
        whInvMap.set(`${row.itemId}_${row.warehouseId}`, Number(row._sum.quantity || 0));
      }
    }

    const transitMap = new Map<string, number>();
    for (const t of transitItems) {
      const qty = Math.max(0, Number(t.quantity || 0) - Number(t.fulfilledQty || 0));
      if (qty > 0) {
        transitMap.set(t.itemId, (transitMap.get(t.itemId) || 0) + qty);
      }
    }

    const reserveMap = new Map<string, number>();
    for (const r of reservedItems) {
      reserveMap.set(r.itemId, Number(r._sum.quantity || 0));
    }

    // 7. Map and calculate variant metrics
    let pageTotalAvailable = 0;
    let pageTotalTransit = 0;
    let pageTotalReserved = 0;
    let pageTotalBalance = 0;
    let pageTotalSellingValue = 0;

    const resultItems: PosMatrixItem[] = items.map((item) => {
      let sumLoc = 0;
      const storeStocks: Record<string, number> = {};
      const storesWithStock: PosMatrixItem['storesWithStock'] = [];

      for (const loc of locations) {
        const lKey1 = `${item.id}_${loc.id}`;
        const lKey2 = `${item.itemId}_${loc.id}`;
        const hasLedger = locLedgerMap.has(lKey1) || locLedgerMap.has(lKey2);
        const ledgerVal = locLedgerMap.get(lKey1) ?? locLedgerMap.get(lKey2) ?? 0;
        const invVal = locInvMap.get(lKey1) ?? locInvMap.get(lKey2) ?? 0;

        const rawQty = hasLedger ? ledgerVal : invVal;
        const qty = Math.max(0, rawQty);

        storeStocks[loc.id] = qty;
        sumLoc += qty;

        if (qty > 0) {
          storesWithStock.push({
            locationId: loc.id,
            locationName: loc.name,
            shortCode: loc.shortCode || loc.code || loc.name,
            phone: loc.phone || undefined,
            address: loc.address || undefined,
            qty,
          });
        }
      }

      // Sort stores with stock descending by quantity
      storesWithStock.sort((a, b) => b.qty - a.qty);

      let sumWh = 0;
      const warehouseStocks: Record<string, number> = {};
      for (const wh of warehouses) {
        const wKey1 = `${item.id}_${wh.id}`;
        const wKey2 = `${item.itemId}_${wh.id}`;
        const hasLedger = whLedgerMap.has(wKey1) || whLedgerMap.has(wKey2);
        const ledgerVal = whLedgerMap.get(wKey1) ?? whLedgerMap.get(wKey2) ?? 0;
        const invVal = whInvMap.get(wKey1) ?? whInvMap.get(wKey2) ?? 0;

        const rawQty = hasLedger ? ledgerVal : invVal;
        const qty = Math.max(0, rawQty);

        warehouseStocks[wh.id] = qty;
        sumWh += qty;
      }

      const availableQty = sumLoc + sumWh;
      const inTransit =
        transitMap.get(item.id) || transitMap.get(item.itemId) || 0;
      const stockReserved =
        reserveMap.get(item.id) || reserveMap.get(item.itemId) || 0;
      const pendingInvoice = 0;
      const totalBalance = availableQty + inTransit + stockReserved;
      const sellingPrice = Number(item.unitPrice || 0);
      const sellingValue = availableQty * sellingPrice;

      pageTotalAvailable += availableQty;
      pageTotalTransit += inTransit;
      pageTotalReserved += stockReserved;
      pageTotalBalance += totalBalance;
      pageTotalSellingValue += sellingValue;

      const currentStoreQty = opts.currentLocationId ? storeStocks[opts.currentLocationId] || 0 : undefined;

      return {
        id: item.id,
        brand: item.brand?.name || '—',
        division: item.division?.name || '—',
        category: item.category?.name || '—',
        gender: item.gender?.name || '—',
        silhouette: item.silhouette?.name || '—',
        sku: item.sku,
        articleName: item.description || item.sku,
        size: item.size?.name || '—',
        color: item.color?.name || '—',
        barcode: item.barCode || '—',
        availableQty,
        inTransit,
        stockReserved,
        pendingInvoice,
        totalBalance,
        sellingPrice,
        sellingValue,
        storeStocks,
        warehouseStocks,
        currentStoreQty,
        storesWithStock,
      };
    });

    return {
      items: resultItems,
      stores: locations,
      warehouses,
      totals: {
        totalVariants: totalCount,
        totalAvailable: pageTotalAvailable,
        totalTransit: pageTotalTransit,
        totalReserved: pageTotalReserved,
        totalBalance: pageTotalBalance,
        totalSellingValue: pageTotalSellingValue,
      },
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  /**
   * Fast quick search for POS Terminal barcode scan or customer inquiry modal
   */
  async getQuickItemStock(query: string, currentLocationId?: string) {
    if (!query || !query.trim()) {
      return { status: false, message: 'Search query is required' };
    }

    const q = query.trim();

    // 1. Fetch active retail locations
    const locations = await this.prisma.location.findMany({
      where: { isStockLocation: true, isDeleted: false },
      select: { id: true, name: true, code: true, shortCode: true, phone: true, address: true },
      orderBy: [{ shortCode: 'asc' }, { name: 'asc' }],
    });

    const locationIds = locations.map((l) => l.id);

    // 2. Find matching items (exact barcode / sku first, then partial)
    const items = await this.prisma.item.findMany({
      where: {
        isActive: true,
        OR: [
          { barCode: { equals: q, mode: 'insensitive' } },
          { sku: { equals: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { barCode: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 20,
      include: {
        brand: { select: { name: true } },
        size: { select: { name: true } },
        color: { select: { name: true } },
      },
      orderBy: [{ sku: 'asc' }, { size: { name: 'asc' } }],
    });

    if (items.length === 0) {
      return { status: true, data: { items: [], message: 'No items found matching search query.' } };
    }

    const itemFilterIds: string[] = [];
    for (const item of items) {
      if (item.id) itemFilterIds.push(item.id);
      if (item.itemId && item.itemId !== item.id) itemFilterIds.push(item.itemId);
    }

    // 3. Stock in locations & warehouses from BOTH StockLedger and InventoryItem
    const [ledgerLocGroup, ledgerWhGroup, invLocGroup, invWhGroup] = await Promise.all([
      this.prisma.stockLedger.groupBy({
        by: ['itemId', 'locationId'],
        where: {
          itemId: { in: itemFilterIds },
          locationId: { in: locationIds },
        },
        _sum: { qty: true },
      }),
      this.prisma.stockLedger.groupBy({
        by: ['itemId'],
        where: {
          itemId: { in: itemFilterIds },
          locationId: null,
        },
        _sum: { qty: true },
      }),
      this.prisma.inventoryItem.groupBy({
        by: ['itemId', 'locationId'],
        where: {
          itemId: { in: itemFilterIds },
          locationId: { in: locationIds },
          status: 'AVAILABLE',
        },
        _sum: { quantity: true },
      }),
      this.prisma.inventoryItem.groupBy({
        by: ['itemId'],
        where: {
          itemId: { in: itemFilterIds },
          locationId: null,
          status: 'AVAILABLE',
        },
        _sum: { quantity: true },
      }),
    ]);

    const locLedgerMap = new Map<string, number>();
    for (const row of ledgerLocGroup) {
      if (row.locationId) {
        locLedgerMap.set(`${row.itemId}_${row.locationId}`, Number(row._sum.qty || 0));
      }
    }

    const whLedgerMap = new Map<string, number>();
    for (const row of ledgerWhGroup) {
      whLedgerMap.set(row.itemId, Number(row._sum.qty || 0));
    }

    const locInvMap = new Map<string, number>();
    for (const row of invLocGroup) {
      if (row.locationId) {
        locInvMap.set(`${row.itemId}_${row.locationId}`, Number(row._sum.quantity || 0));
      }
    }

    const whInvMap = new Map<string, number>();
    for (const row of invWhGroup) {
      whInvMap.set(row.itemId, Number(row._sum.quantity || 0));
    }

    const result = items.map((item) => {
      const wKey1 = item.id;
      const wKey2 = item.itemId;
      const hasWhLedger = whLedgerMap.has(wKey1) || whLedgerMap.has(wKey2);
      const whLedgerVal = whLedgerMap.get(wKey1) ?? whLedgerMap.get(wKey2) ?? 0;
      const whInvVal = whInvMap.get(wKey1) ?? whInvMap.get(wKey2) ?? 0;
      const warehouseStock = Math.max(0, hasWhLedger ? whLedgerVal : whInvVal);

      let totalAvailable = warehouseStock;

      const storesWithStock: Array<{
        locationId: string;
        locationName: string;
        shortCode?: string;
        phone?: string;
        address?: string;
        qty: number;
        isCurrent: boolean;
      }> = [];

      let currentStoreQty = 0;

      for (const loc of locations) {
        const lKey1 = `${item.id}_${loc.id}`;
        const lKey2 = `${item.itemId}_${loc.id}`;
        const hasLocLedger = locLedgerMap.has(lKey1) || locLedgerMap.has(lKey2);
        const locLedgerVal = locLedgerMap.get(lKey1) ?? locLedgerMap.get(lKey2) ?? 0;
        const locInvVal = locInvMap.get(lKey1) ?? locInvMap.get(lKey2) ?? 0;

        const rawQty = hasLocLedger ? locLedgerVal : locInvVal;
        const qty = Math.max(0, rawQty);

        totalAvailable += qty;

        const isCurrent = loc.id === currentLocationId;
        if (isCurrent) currentStoreQty = qty;

        if (qty > 0) {
          storesWithStock.push({
            locationId: loc.id,
            locationName: loc.name,
            shortCode: loc.shortCode || loc.code || loc.name,
            phone: loc.phone || undefined,
            address: loc.address || undefined,
            qty,
            isCurrent,
          });
        }
      }

      storesWithStock.sort((a, b) => {
        if (a.isCurrent) return -1;
        if (b.isCurrent) return 1;
        return b.qty - a.qty;
      });

      return {
        id: item.id,
        sku: item.sku,
        barcode: item.barCode || '—',
        articleName: item.description || item.sku,
        brand: item.brand?.name || '—',
        size: item.size?.name || '—',
        color: item.color?.name || '—',
        unitPrice: Number(item.unitPrice || 0),
        currentStoreQty,
        totalAvailable,
        warehouseStock,
        storesWithStock,
      };
    });

    return { status: true, data: { items: result } };
  }

  /**
   * Stream Excel / CSV export matching pos-overall-stock-matrix-2026-11-03.xlsx
   */
  async streamExcel(opts: PosStockMatrixQueryOptions, res: any): Promise<void> {
    const targetDate = opts.asOfDate ? new Date(opts.asOfDate) : new Date();
    targetDate.setHours(23, 59, 59, 999);

    // 1. Fetch active retail locations
    const locations = await this.prisma.location.findMany({
      where: { isStockLocation: true, isDeleted: false },
      select: { id: true, name: true, code: true, shortCode: true },
      orderBy: [{ shortCode: 'asc' }, { name: 'asc' }],
    });

    const locationIds = locations.map((l) => l.id);

    // 2. Fetch all active items matching filters
    const itemWhere: any = { isActive: true };
    if (opts.brandId) itemWhere.brandId = opts.brandId;
    if (opts.categoryId) itemWhere.categoryId = opts.categoryId;
    if (opts.divisionId) itemWhere.divisionId = opts.divisionId;
    if (opts.genderId) itemWhere.genderId = opts.genderId;
    if (opts.sizeId) itemWhere.sizeId = opts.sizeId;
    if (opts.colorId) itemWhere.colorId = opts.colorId;

    if (opts.search && opts.search.trim()) {
      const q = opts.search.trim();
      itemWhere.OR = [
        { sku: { contains: q, mode: 'insensitive' } },
        { barCode: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { brand: { name: { contains: q, mode: 'insensitive' } } },
        { silhouette: { name: { contains: q, mode: 'insensitive' } } },
        { color: { name: { contains: q, mode: 'insensitive' } } },
        { size: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    if (opts.inStockOnly) {
      const [ledgerStock, inStockInv] = await Promise.all([
        this.prisma.stockLedger.groupBy({
          by: ['itemId'],
          where: {
            createdAt: { lte: targetDate },
          },
          _sum: { qty: true },
        }),
        this.prisma.inventoryItem.groupBy({
          by: ['itemId'],
          where: {
            status: 'AVAILABLE',
            quantity: { gt: 0 },
            createdAt: { lte: targetDate },
          },
        }),
      ]);

      const inStockSet = new Set<string>();
      for (const row of ledgerStock) {
        if (Number(row._sum.qty || 0) > 0) inStockSet.add(row.itemId);
      }
      for (const row of inStockInv) {
        inStockSet.add(row.itemId);
      }

      const inStockIds = Array.from(inStockSet);
      const stockCondition = [
        { id: { in: inStockIds } },
        { itemId: { in: inStockIds } },
      ];
      if (itemWhere.OR) {
        itemWhere.AND = [{ OR: itemWhere.OR }, { OR: stockCondition }];
        delete itemWhere.OR;
      } else {
        itemWhere.OR = stockCondition;
      }
    }

    const items = await this.prisma.item.findMany({
      where: itemWhere,
      include: {
        brand: { select: { name: true } },
        division: { select: { name: true } },
        category: { select: { name: true } },
        gender: { select: { name: true } },
        silhouette: { select: { name: true } },
        size: { select: { name: true } },
        color: { select: { name: true } },
      },
      orderBy: [{ sku: 'asc' }, { size: { name: 'asc' } }],
    });

    const itemFilterIds: string[] = [];
    for (const item of items) {
      if (item.id) itemFilterIds.push(item.id);
      if (item.itemId && item.itemId !== item.id) itemFilterIds.push(item.itemId);
    }

    // Stock levels & transit from BOTH StockLedger and InventoryItem
    const [ledgerLocGroup, invLocGroup, transitItems, reservedItems] = await Promise.all([
      this.prisma.stockLedger.groupBy({
        by: ['itemId', 'locationId'],
        where: {
          itemId: { in: itemFilterIds },
          locationId: { in: locationIds },
          createdAt: { lte: targetDate },
        },
        _sum: { qty: true },
      }),
      this.prisma.inventoryItem.groupBy({
        by: ['itemId', 'locationId'],
        where: {
          itemId: { in: itemFilterIds },
          locationId: { in: locationIds },
          status: 'AVAILABLE',
          createdAt: { lte: targetDate },
        },
        _sum: { quantity: true },
      }),
      this.prisma.transferRequestItem.findMany({
        where: {
          itemId: { in: itemFilterIds },
          transferRequest: {
            createdAt: { lte: targetDate },
            status: {
              in: [
                'PENDING',
                'PENDING_CHECKER',
                'PENDING_AUTHORIZER',
                'PENDING_APPROVER',
                'APPROVED',
                'SOURCE_APPROVED',
                'IN_TRANSIT',
                'PARTIAL_RECEIVED',
              ],
            },
          },
        },
        select: { itemId: true, quantity: true, fulfilledQty: true },
      }),
      this.prisma.stockReserve.groupBy({
        by: ['itemId'],
        where: {
          itemId: { in: itemFilterIds },
          createdAt: { lte: targetDate },
        },
        _sum: { quantity: true },
      }),
    ]);

    const locLedgerMap = new Map<string, number>();
    for (const row of ledgerLocGroup) {
      if (row.locationId) {
        locLedgerMap.set(`${row.itemId}_${row.locationId}`, Number(row._sum.qty || 0));
      }
    }

    const locInvMap = new Map<string, number>();
    for (const row of invLocGroup) {
      if (row.locationId) {
        locInvMap.set(`${row.itemId}_${row.locationId}`, Number(row._sum.quantity || 0));
      }
    }

    const transitMap = new Map<string, number>();
    for (const t of transitItems) {
      const qty = Math.max(0, Number(t.quantity || 0) - Number(t.fulfilledQty || 0));
      if (qty > 0) {
        transitMap.set(t.itemId, (transitMap.get(t.itemId) || 0) + qty);
      }
    }

    const reserveMap = new Map<string, number>();
    for (const r of reservedItems) {
      reserveMap.set(r.itemId, Number(r._sum.quantity || 0));
    }

    // Build Excel Workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Overall Stock Matrix');

    // Header metadata rows
    worksheet.addRow(['IVAR']);
    worksheet.addRow(['OVERALL STOCK MATRIX REPORT (POS LEVEL - STORE-WISE BREAKDOWN)']);
    worksheet.addRow([`As Of Date: ${opts.asOfDate || new Date().toISOString().split('T')[0]}`]);
    worksheet.addRow([`Generated At: ${new Date().toLocaleString('en-PK')}`]);
    worksheet.addRow([]); // Blank row

    worksheet.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
    worksheet.getRow(2).font = { bold: true, size: 11, color: { argb: 'FF475569' } };
    worksheet.getRow(3).font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
    worksheet.getRow(4).font = { italic: true, size: 9, color: { argb: 'FF64748B' } };

    // Column headers
    const fixedHeaders = [
      'Brand',
      'Division',
      'Category',
      'Gender',
      'Silhouette',
      'SKU',
      'Article Name',
      'Size',
      'Color',
      'Barcode',
      'Available Qty',
      'In Transit',
      'Stock Reserved',
      'Pending Invoice',
      'Total Balance',
      'Selling Price (Rs.)',
      'Selling Value (Rs.)',
    ];

    const storeHeaders = locations.map((loc) => loc.shortCode || loc.code || loc.name);
    const allHeaders = [...fixedHeaders, ...storeHeaders];

    const headerRow = worksheet.addRow(allHeaders);
    headerRow.height = 24;

    headerRow.eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colNumber > 17 ? 'FF0F766E' : 'FF1E293B' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber >= 11 ? 'right' : colNumber === 8 || colNumber === 9 ? 'center' : 'left',
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });

    // Populate data rows
    for (const item of items) {
      let sumLoc = 0;
      const storeQtys: number[] = [];

      for (const loc of locations) {
        const lKey1 = `${item.id}_${loc.id}`;
        const lKey2 = `${item.itemId}_${loc.id}`;
        const hasLocLedger = locLedgerMap.has(lKey1) || locLedgerMap.has(lKey2);
        const locLedgerVal = locLedgerMap.get(lKey1) ?? locLedgerMap.get(lKey2) ?? 0;
        const locInvVal = locInvMap.get(lKey1) ?? locInvMap.get(lKey2) ?? 0;

        const rawQty = hasLocLedger ? locLedgerVal : locInvVal;
        const qty = Math.max(0, rawQty);

        storeQtys.push(qty);
        sumLoc += qty;
      }

      const availableQty = sumLoc;
      const inTransit =
        transitMap.get(item.id) || transitMap.get(item.itemId) || 0;
      const stockReserved =
        reserveMap.get(item.id) || reserveMap.get(item.itemId) || 0;
      const pendingInvoice = 0;
      const totalBalance = availableQty + inTransit + stockReserved;
      const sellingPrice = Number(item.unitPrice || 0);
      const sellingValue = availableQty * sellingPrice;

      if (opts.inStockOnly && totalBalance === 0) {
        continue;
      }

      const rowData = [
        item.brand?.name || '—',
        item.division?.name || '—',
        item.category?.name || '—',
        item.gender?.name || '—',
        item.silhouette?.name || '—',
        item.sku,
        item.description || item.sku,
        item.size?.name || '—',
        item.color?.name || '—',
        item.barCode || '—',
        availableQty,
        inTransit,
        stockReserved,
        pendingInvoice,
        totalBalance,
        sellingPrice,
        sellingValue,
        ...storeQtys,
      ];

      const r = worksheet.addRow(rowData);
      r.height = 18;

      r.eachCell((cell, colNumber) => {
        cell.font = { size: 9 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber >= 11 ? 'right' : colNumber === 8 || colNumber === 9 ? 'center' : 'left',
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFF1F5F9' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFF1F5F9' } },
          right: { style: 'thin', color: { argb: 'FFF1F5F9' } },
        };

        if (colNumber === 16 || colNumber === 17) {
          cell.numFmt = '#,##0';
        } else if (colNumber >= 11) {
          cell.numFmt = '#,##0';
        }
      });
    }

    // Auto-fit column widths
    worksheet.columns.forEach((column, index) => {
      if (index === 0) column.width = 16;
      else if (index === 1) column.width = 14;
      else if (index === 2) column.width = 16;
      else if (index === 3) column.width = 12;
      else if (index === 4) column.width = 16;
      else if (index === 5) column.width = 14;
      else if (index === 6) column.width = 24;
      else if (index === 7) column.width = 8;
      else if (index === 8) column.width = 14;
      else if (index === 9) column.width = 16;
      else if (index >= 10 && index <= 16) column.width = 14;
      else column.width = 10;
    });

    const ext = opts.format === 'csv' ? 'csv' : 'xlsx';
    const fileName = `pos-overall-stock-matrix-${opts.asOfDate || new Date().toISOString().split('T')[0]}.${ext}`;

    if (opts.format === 'csv') {
      const buffer = await workbook.csv.writeBuffer();
      res.header('Content-Type', 'text/csv; charset=utf-8');
      res.header('Content-Disposition', `attachment; filename="${fileName}"`);
      res.header('Cache-Control', 'no-cache');
      return res.send(buffer);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', `attachment; filename="${fileName}"`);
    res.header('Cache-Control', 'no-cache');
    return res.send(buffer);
  }
}
