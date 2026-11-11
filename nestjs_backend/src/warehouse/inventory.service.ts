import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryItem } from '@prisma/client';

import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { runInBackground } from '../common/utils/run-in-background.util';
@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
  ) { }

  async getStockLevel(itemId: string, warehouseId: string, locationId?: string): Promise<any> {
    // Use the stock ledger (immutable source of truth) to calculate the net
    // available quantity. This accounts for ALL movements — purchases,
    // fabric vendor issues, returns, adjustments, etc.
    const where: any = {
      itemId,
      warehouseId,
    };
    if (locationId) {
      where.locationId = locationId;
    }

    const ledger = await this.prisma.stockLedger.aggregate({
      where,
      _sum: {
        qty: true,
      },
    });

    const totalQuantity = ledger._sum?.qty || 0;

    return {
      itemId,
      warehouseId,
      totalQuantity: Number(totalQuantity),
    };
  }

  async getDetailedStock(itemId: string): Promise<any[]> {
    // 1. Query StockLedger (the immutable source of truth for all warehouse & location inventory)
    const ledgerGroups = await this.prisma.stockLedger.groupBy({
      by: ['warehouseId', 'locationId'],
      where: { itemId },
      _sum: {
        qty: true,
      },
    });

    if (ledgerGroups && ledgerGroups.length > 0) {
      const warehouseIds = [...new Set(ledgerGroups.map((g) => g.warehouseId).filter(Boolean))] as string[];
      const locationIds = [...new Set(ledgerGroups.map((g) => g.locationId).filter(Boolean))] as string[];

      const [warehouses, locations] = await Promise.all([
        warehouseIds.length > 0
          ? this.prisma.warehouse.findMany({
              where: { id: { in: warehouseIds } },
              select: { id: true, name: true, code: true },
            })
          : [],
        locationIds.length > 0
          ? this.prisma.location.findMany({
              where: { id: { in: locationIds } },
              select: { id: true, name: true, code: true, warehouseId: true },
            })
          : [],
      ]);

      const whMap = new Map<string, { id: string; name: string; code: string }>();
      for (const w of warehouses) {
        whMap.set(w.id, w);
      }

      const locMap = new Map<string, { id: string; name: string; code: string; warehouseId: string | null }>();
      for (const l of locations) {
        locMap.set(l.id, l);
      }

      return ledgerGroups.map((g, idx) => {
        const qty = Number(g._sum.qty || 0);
        const wh = g.warehouseId ? whMap.get(g.warehouseId) : null;
        let locationData: any = null;

        if (g.locationId) {
          const loc = locMap.get(g.locationId);
          if (loc) {
            const parentWh = loc.warehouseId ? whMap.get(loc.warehouseId) : wh;
            locationData = {
              id: loc.id,
              name: loc.name,
              code: loc.code,
              warehouse: parentWh || wh || { name: 'Warehouse' },
            };
          }
        }

        return {
          id: `ledger-${g.warehouseId || 'wh'}-${g.locationId || 'loc'}-${idx}`,
          warehouseId: g.warehouseId,
          locationId: g.locationId,
          itemId,
          quantity: qty,
          status: 'AVAILABLE',
          location: locationData || {
            warehouse: wh || { name: 'Warehouse' },
          },
        };
      });
    }

    // 2. Fallback to legacy InventoryItem table if item has no ledger movements yet
    const items = await this.prisma.inventoryItem.findMany({
      where: { itemId, status: 'AVAILABLE' },
    });

    const enriched = await Promise.all(
      items.map(async (item) => {
        const warehouse = await this.prisma.warehouse.findUnique({
          where: { id: item.warehouseId },
          select: { id: true, name: true, code: true },
        });

        let locationData: any = {};
        if (item.locationId) {
          // Check Master Location (Shop/Outlet)
          const masterLoc = await this.prisma.location.findUnique({
            where: { id: item.locationId },
            select: { id: true, name: true, code: true },
          });
          if (masterLoc) locationData = masterLoc;
        }

        return {
          ...item,
          quantity: Number(item.quantity),
          location: {
            ...locationData,
            warehouse: warehouse,
          },
        };
      }),
    );

    return enriched;
  }

  async findSpecificBatch(
    itemId: string,
  ): Promise<InventoryItem[]> {
    return this.prisma.inventoryItem.findMany({
      where: { itemId },
    });
  }

  async searchInventory(
    query: string = '',
    warehouseId?: string,
    locationId?: string,
    filters?: {
      brandIds?: string[];
      categoryIds?: string[];
      silhouetteIds?: string[];
      genderIds?: string[];
      itemType?: string;
    }
  ) {
    const filterWhere: any = {};
    if (filters?.brandIds?.length) filterWhere.brandId = { in: filters.brandIds };
    if (filters?.categoryIds?.length) filterWhere.categoryId = { in: filters.categoryIds };
    if (filters?.silhouetteIds?.length) filterWhere.silhouetteId = { in: filters.silhouetteIds };
    if (filters?.genderIds?.length) filterWhere.genderId = { in: filters.genderIds };
    if (filters?.itemType) filterWhere.itemType = filters.itemType;

    const items = await this.prisma.item.findMany({
      where: {
        OR: query
          ? [
              { sku: { contains: query, mode: 'insensitive' } },
              { barCode: { contains: query, mode: 'insensitive' } },
              { itemId: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ]
          : undefined,
        isActive: true,
        ...filterWhere,
      },
      take: 50,
      select: {
        id: true,
        itemId: true,
        sku: true,
        barCode: true,
        description: true,
        unitPrice: true,
        unitCost: true, // Added unitCost field
        imageUrl: true,
        brand: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        silhouette: { select: { id: true, name: true } },
        gender: { select: { id: true, name: true } },
        color: { select: { id: true, name: true } },
        size: { select: { id: true, name: true } },
      },
    });

    const itemIds = items.map((i) => i.id);

    let stockMap: Map<string, number>;

    if (locationId) {
      // Outlet stock: use StockLedger (immutable source of truth)
      const stockEntries = await this.prisma.stockLedger.groupBy({
        by: ['itemId'],
        where: {
          itemId: { in: itemIds },
          locationId,
        },
        _sum: { qty: true },
      });
      stockMap = new Map(
        stockEntries.map((a) => [a.itemId, Number(a._sum.qty) || 0]),
      );
    } else if (warehouseId) {
      // Warehouse stock: use StockLedger
      const stockEntries = await this.prisma.stockLedger.groupBy({
        by: ['itemId'],
        where: {
          itemId: { in: itemIds },
          warehouseId,
          locationId: null,
        },
        _sum: { qty: true },
      });
      stockMap = new Map(
        stockEntries.map((a) => [a.itemId, Number(a._sum.qty) || 0]),
      );
    } else {
      // Global search (no warehouse/location filter) — sum all available inventory
      const inventoryItems = await this.prisma.inventoryItem.findMany({
        where: {
          itemId: { in: itemIds },
          status: 'AVAILABLE',
        },
        select: { itemId: true, quantity: true },
      });
      const globalMap = new Map<string, number>();
      for (const inv of inventoryItems) {
        globalMap.set(inv.itemId, (globalMap.get(inv.itemId) || 0) + Number(inv.quantity));
      }
      stockMap = globalMap;
    }

    const result = items.map((item) => ({
      ...item,
      totalQuantity: stockMap.get(item.id) || 0,
    }));

    return result;
  }
}
