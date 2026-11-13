import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockLedgerService } from '../warehouse/stock-ledger/stock-ledger.service';
import { PurchaseInvoiceService } from '../purchase/purchase-invoice/purchase-invoice.service';
import { CalculateCostingDto } from './dto/calculate-costing.dto';
import { CreateProductionBatchDto } from './dto/create-production-batch.dto';
import { RefreshBGradeDto } from './dto/refresh-b-grade.dto';
import { CreateBGradeRefreshOrderDto } from './dto/create-b-grade-refresh-order.dto';
import { CreateBGradeRefreshReceivingDto } from './dto/create-b-grade-refresh-receiving.dto';
import {
  MovementType,
  FabricStatus,
  Prisma,
  FabricVendorTracker,
} from '@prisma/client';

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockLedgerService: StockLedgerService,
    private readonly purchaseInvoiceService: PurchaseInvoiceService,
  ) { }

  /**
   * Pure calculation engine matching COSTING FILE.xlsx and Ivar Production Flow Document.
   * Supports both single-article mode and multi-article / dynamic size breakdown with per-item fabric consumption.
   */
  calculateCosting(dto: CalculateCostingDto) {
    const defaultFabricRate = Number(dto.fabricRate) || 0;
    const deductBGradeCmt = Boolean(dto.deductBGradeCmt);

    let rawItems: Array<{
      articleItemId: string;
      sizeName?: string;
      qtyTotalReceived: number;
      qtyBGrade: number;
      cmtRate: number;
      qtyFabricUsed?: number;
    }> = [];

    if (dto.items && dto.items.length > 0) {
      rawItems = dto.items.map((it) => ({
        articleItemId: it.articleItemId,
        sizeName: it.sizeName,
        qtyTotalReceived: Number(it.qtyTotalReceived),
        qtyBGrade: Number(it.qtyBGrade || 0),
        cmtRate: Number(it.cmtRate),
        qtyFabricUsed:
          it.qtyFabricUsed !== undefined &&
            it.qtyFabricUsed !== null &&
            it.qtyFabricUsed !== ('' as any)
            ? Number(it.qtyFabricUsed)
            : undefined,
      }));
    } else if (dto.qtyTotalReceived) {
      rawItems = [
        {
          articleItemId: 'primary',
          qtyTotalReceived: Number(dto.qtyTotalReceived),
          qtyBGrade: Number(dto.qtyBGrade || 0),
          cmtRate: Number(dto.cmtRate || 0),
          qtyFabricUsed: dto.qtyFabricUsed
            ? Number(dto.qtyFabricUsed)
            : undefined,
        },
      ];
    } else {
      throw new BadRequestException(
        'Either items array or qtyTotalReceived must be provided.',
      );
    }

    const batchQtyTotalReceived = rawItems.reduce(
      (acc, it) => acc + it.qtyTotalReceived,
      0,
    );
    if (batchQtyTotalReceived <= 0) {
      throw new BadRequestException(
        'Total pieces received (A + B) must be greater than zero.',
      );
    }

    // Determine how fabric is distributed:
    // If any item specifies its own qtyFabricUsed, we use item-level fabric.
    // If not, we distribute batch-level dto.qtyFabricUsed proportionally across items.
    const hasPerItemFabric = rawItems.some(
      (it) => it.qtyFabricUsed !== undefined && it.qtyFabricUsed > 0,
    );
    const dtoFabricUsed = Number(dto.qtyFabricUsed) || 0;

    let batchFabricUsed = 0;
    let batchQtyAGrade = 0;
    let batchQtyBGrade = 0;
    let batchTotalBill = 0;
    let batchBTotalValue = 0;
    let batchATotalValue = 0;
    let batchVendorCmtBill = 0;

    const calculatedItems = rawItems.map((it) => {
      if (it.qtyBGrade > it.qtyTotalReceived) {
        throw new BadRequestException(
          `B-grade pieces (${it.qtyBGrade}) cannot exceed total received pieces (${it.qtyTotalReceived}) for line ${it.sizeName || it.articleItemId}.`,
        );
      }
      const qtyA = it.qtyTotalReceived - it.qtyBGrade;

      let itemFabricUsed = 0;
      if (hasPerItemFabric) {
        itemFabricUsed = it.qtyFabricUsed !== undefined ? it.qtyFabricUsed : 0;
      } else {
        // Distribute proportionally based on pieces
        itemFabricUsed =
          batchQtyTotalReceived > 0
            ? (it.qtyTotalReceived / batchQtyTotalReceived) * dtoFabricUsed
            : 0;
      }

      // 1. Consumption per piece (CONS): Fabric Used for this item / Pieces Received of this item
      const itemConsumption =
        it.qtyTotalReceived > 0 ? itemFabricUsed / it.qtyTotalReceived : 0;

      // 2. Fabric Cost per piece: CONS * Fabric Rate per meter
      const itemFabricCostPerPc = itemConsumption * defaultFabricRate;

      // 3. Initial Net Cost: Fabric Cost per piece + CMT Rate
      const initialNetCost = itemFabricCostPerPc + it.cmtRate;
      const lineTotalBill = initialNetCost * it.qtyTotalReceived;

      // 4. Grading: B-Grade absorbs 50% discount
      const bUnitValue = initialNetCost * 0.5;
      const bTotalValue = it.qtyBGrade * bUnitValue;
      const aTotalValue = lineTotalBill - bTotalValue;

      // 5. Sound A-Grade unit cost absorbs the B-grade loss
      const aFinalUnitCost = qtyA > 0 ? aTotalValue / qtyA : initialNetCost;

      const cmtQty = deductBGradeCmt ? qtyA : it.qtyTotalReceived;
      const lineCmtBill = cmtQty * it.cmtRate;

      batchFabricUsed += itemFabricUsed;
      batchQtyAGrade += qtyA;
      batchQtyBGrade += it.qtyBGrade;
      batchTotalBill += lineTotalBill;
      batchBTotalValue += bTotalValue;
      batchATotalValue += aTotalValue;
      batchVendorCmtBill += lineCmtBill;

      return {
        articleItemId: it.articleItemId,
        sizeName: it.sizeName,
        qtyFabricUsed: Number(itemFabricUsed.toFixed(4)),
        consumption: Number(itemConsumption.toFixed(6)),
        qtyTotalReceived: it.qtyTotalReceived,
        qtyAGrade: qtyA,
        qtyBGrade: it.qtyBGrade,
        cmtRate: it.cmtRate,
        cmtQty,
        fabricCostPerPc: Number(itemFabricCostPerPc.toFixed(2)),
        cmtCostPerPc: it.cmtRate,
        initialNetCost: Number(initialNetCost.toFixed(2)),
        totalBill: Number(lineTotalBill.toFixed(2)),
        bUnitValue: Number(bUnitValue.toFixed(2)),
        bTotalValue: Number(bTotalValue.toFixed(2)),
        aTotalValue: Number(aTotalValue.toFixed(2)),
        aFinalUnitCost: Number(aFinalUnitCost.toFixed(2)),
        vendorCmtBillAmount: Number(lineCmtBill.toFixed(2)),
        raw: {
          qtyFabricUsed: itemFabricUsed,
          consumption: itemConsumption,
          fabricCostPerPc: itemFabricCostPerPc,
          initialNetCost,
          totalBill: lineTotalBill,
          bUnitValue,
          bTotalValue,
          aTotalValue,
          aFinalUnitCost,
          vendorCmtBillAmount: lineCmtBill,
        },
      };
    });

    const finalBatchFabricUsed = hasPerItemFabric
      ? batchFabricUsed
      : dtoFabricUsed;
    const batchAvgConsumption =
      batchQtyTotalReceived > 0
        ? finalBatchFabricUsed / batchQtyTotalReceived
        : 0;
    const batchFabricCostPerPc = batchAvgConsumption * defaultFabricRate;
    const avgInitialNetCost =
      batchQtyTotalReceived > 0 ? batchTotalBill / batchQtyTotalReceived : 0;
    const avgAFinalUnitCost =
      batchQtyAGrade > 0
        ? batchATotalValue / batchQtyAGrade
        : avgInitialNetCost;
    const avgBUnitValue =
      batchQtyBGrade > 0
        ? batchBTotalValue / batchQtyBGrade
        : avgInitialNetCost * 0.5;
    const avgCmtRate =
      rawItems.length > 0
        ? rawItems.reduce(
          (acc, it) => acc + it.cmtRate * it.qtyTotalReceived,
          0,
        ) / batchQtyTotalReceived
        : 0;

    return {
      qtyFabricUsed: Number(finalBatchFabricUsed.toFixed(4)),
      fabricRate: defaultFabricRate,
      qtyTotalReceived: batchQtyTotalReceived,
      qtyAGrade: batchQtyAGrade,
      qtyBGrade: batchQtyBGrade,
      cmtRate: Number(avgCmtRate.toFixed(2)),
      deductBGradeCmt,
      consumption: Number(batchAvgConsumption.toFixed(6)),
      fabricCostPerPc: Number(batchFabricCostPerPc.toFixed(2)),
      cmtCostPerPc: Number(avgCmtRate.toFixed(2)),
      initialNetCost: Number(avgInitialNetCost.toFixed(2)),
      totalBill: Number(batchTotalBill.toFixed(2)),
      bUnitValue: Number(avgBUnitValue.toFixed(2)),
      bTotalValue: Number(batchBTotalValue.toFixed(2)),
      aTotalValue: Number(batchATotalValue.toFixed(2)),
      aFinalUnitCost: Number(avgAFinalUnitCost.toFixed(2)),
      vendorCmtBillAmount: Number(batchVendorCmtBill.toFixed(2)),
      items: calculatedItems,
      raw: {
        qtyFabricUsed: finalBatchFabricUsed,
        consumption: batchAvgConsumption,
        fabricCostPerPc: batchFabricCostPerPc,
        initialNetCost: avgInitialNetCost,
        totalBill: batchTotalBill,
        bUnitValue: avgBUnitValue,
        bTotalValue: batchBTotalValue,
        aTotalValue: batchATotalValue,
        aFinalUnitCost: avgAFinalUnitCost,
        vendorCmtBillAmount: batchVendorCmtBill,
      },
    };
  }

  /**
   * Main production batch creation with:
   * 1. Multi-article & dynamic size breakdown
   * 2. Optional FabricVendorTracker balance deduction (Phased receiving)
   * 3. Atomic stock ledger movements per item/warehouse
   * 4. Auto-generated CMT Purchase Invoice (triggering JV upon approval)
   */
  async createBatch(
    dto: CreateProductionBatchDto,
    ctx?: { userId?: string; ipAddress?: string; userAgent?: string },
  ) {
    // 1. Calculate costing values
    const costing = this.calculateCosting({
      qtyFabricUsed: dto.qtyFabricUsed,
      fabricRate: dto.fabricRate,
      qtyTotalReceived: dto.qtyTotalReceived,
      qtyBGrade: dto.qtyBGrade || 0,
      cmtRate: dto.cmtRate,
      items: dto.items,
      deductBGradeCmt: dto.deductBGradeCmt,
    });

    return this.prisma.$transaction(async (tx) => {
      // 2. Validate Fabric Item
      const fabricItem = await tx.item.findUnique({
        where: { id: dto.fabricItemId },
      });
      if (!fabricItem) {
        throw new NotFoundException(
          `Fabric item with ID ${dto.fabricItemId} not found`,
        );
      }

      // 3. Determine items to receive
      const itemsToReceive: Array<{
        articleItemId: string;
        sizeName?: string;
        qtyFabricUsed?: number;
        consumption?: number;
        qtyTotalReceived: number;
        qtyAGrade: number;
        qtyBGrade: number;
        cmtRate: number;
        fabricCostPerPc: number;
        initialNetCost: number;
        bUnitValue: number;
        aFinalUnitCost: number;
        totalLineAmount: number;
        cmtQty: number;
        lineCmtBill: number;
      }> = [];

      if (dto.items && dto.items.length > 0) {
        for (const it of costing.items) {
          const itemExists = await tx.item.findUnique({
            where: { id: it.articleItemId },
          });
          if (!itemExists) {
            throw new NotFoundException(
              `Finished article item with ID ${it.articleItemId} not found`,
            );
          }
          itemsToReceive.push({
            articleItemId: it.articleItemId,
            sizeName: it.sizeName,
            qtyFabricUsed: it.qtyFabricUsed,
            consumption: it.consumption,
            qtyTotalReceived: it.qtyTotalReceived,
            qtyAGrade: it.qtyAGrade,
            qtyBGrade: it.qtyBGrade,
            cmtRate: it.cmtRate,
            fabricCostPerPc: it.fabricCostPerPc,
            initialNetCost: it.initialNetCost,
            bUnitValue: it.bUnitValue,
            aFinalUnitCost: it.aFinalUnitCost,
            totalLineAmount: it.totalBill,
            cmtQty: it.cmtQty,
            lineCmtBill: it.vendorCmtBillAmount,
          });
        }
      } else if (dto.articleItemId) {
        const itemExists = await tx.item.findUnique({
          where: { id: dto.articleItemId },
        });
        if (!itemExists) {
          throw new NotFoundException(
            `Finished article item with ID ${dto.articleItemId} not found`,
          );
        }
        itemsToReceive.push({
          articleItemId: dto.articleItemId,
          qtyFabricUsed: costing.raw.qtyFabricUsed,
          consumption: costing.raw.consumption,
          qtyTotalReceived: costing.qtyTotalReceived,
          qtyAGrade: costing.qtyAGrade,
          qtyBGrade: costing.qtyBGrade,
          cmtRate: dto.cmtRate || 0,
          fabricCostPerPc: costing.fabricCostPerPc,
          initialNetCost: costing.initialNetCost,
          bUnitValue: costing.bUnitValue,
          aFinalUnitCost: costing.aFinalUnitCost,
          totalLineAmount: costing.totalBill,
          cmtQty: costing.items[0]?.cmtQty || costing.qtyTotalReceived,
          lineCmtBill: costing.vendorCmtBillAmount,
        });
      } else {
        throw new BadRequestException(
          'At least one finished article item must be provided.',
        );
      }

      const primaryArticleItemId = itemsToReceive[0].articleItemId;
      const effectiveFabricUsed = Number(costing.raw.qtyFabricUsed);

      // 4. Validate Warehouses
      const [fabricWh, aWh, bWh] = await Promise.all([
        tx.warehouse.findUnique({ where: { id: dto.fabricWarehouseId } }),
        tx.warehouse.findUnique({ where: { id: dto.aGradeWarehouseId } }),
        tx.warehouse.findUnique({ where: { id: dto.bGradeWarehouseId } }),
      ]);
      if (!fabricWh)
        throw new NotFoundException(
          `Fabric Warehouse ID ${dto.fabricWarehouseId} not found`,
        );
      if (!aWh)
        throw new NotFoundException(
          `A-Grade Warehouse ID ${dto.aGradeWarehouseId} not found`,
        );
      if (!bWh)
        throw new NotFoundException(
          `B-Grade Warehouse ID ${dto.bGradeWarehouseId} not found`,
        );

      // 5. Validate & Update Fabric Vendor Tracker (If provided)
      let tracker: FabricVendorTracker | null = null;
      if (dto.trackerId) {
        tracker = await tx.fabricVendorTracker.findUnique({
          where: { id: dto.trackerId },
        });
        if (!tracker) {
          throw new NotFoundException(
            `Fabric Vendor Tracker with ID ${dto.trackerId} not found`,
          );
        }

        const currentUsed = Number(tracker.qtyUsed) || 0;
        const qtyIssued = Number(tracker.qtyIssued) || 0;
        const qtyReturned = Number(tracker.qtyReturned) || 0;
        const qtyShortage = Number(tracker.qtyShortage) || 0;
        const remainingWithVendor =
          qtyIssued - currentUsed - qtyReturned - qtyShortage;

        if (effectiveFabricUsed > remainingWithVendor + 0.001) {
          throw new BadRequestException(
            `Entered fabric consumption (${effectiveFabricUsed}m) exceeds remaining fabric with vendor (${remainingWithVendor.toFixed(2)}m).`,
          );
        }
      }

      // 6. Generate sequential Batch Number: PB-YYYY-XXXX
      const year = new Date().getFullYear();
      const count = await tx.productionBatch.count();
      let suffix = (count + 1).toString().padStart(4, '0');
      let batchNumber = `PB-${year}-${suffix}`;
      let exists = await tx.productionBatch.findUnique({
        where: { batchNumber },
      });
      let attempts = 0;
      while (exists && attempts < 15) {
        attempts++;
        suffix = (count + 1 + attempts).toString().padStart(4, '0');
        batchNumber = `PB-${year}-${suffix}`;
        exists = await tx.productionBatch.findUnique({
          where: { batchNumber },
        });
      }

      // 7. Create ProductionBatch master record
      const batch = await tx.productionBatch.create({
        data: {
          batchNumber,
          supplierId: dto.supplierId,
          fabricItemId: dto.fabricItemId,
          fabricWarehouseId: dto.fabricWarehouseId,
          trackerId: dto.trackerId || null,
          qtyFabricUsed: effectiveFabricUsed,
          fabricRate: dto.fabricRate,
          articleItemId: primaryArticleItemId,
          qtyTotalReceived: costing.qtyTotalReceived,
          qtyAGrade: costing.qtyAGrade,
          qtyBGrade: costing.qtyBGrade,
          consumption: costing.raw.consumption,
          fabricCostPerPc: costing.raw.fabricCostPerPc,
          cmtCostPerPc: costing.cmtRate,
          initialNetCost: costing.raw.initialNetCost,
          totalBill: costing.raw.totalBill,
          bUnitValue: costing.raw.bUnitValue,
          bTotalValue: costing.raw.bTotalValue,
          aTotalValue: costing.raw.aTotalValue,
          aFinalUnitCost: costing.raw.aFinalUnitCost,
          aGradeWarehouseId: dto.aGradeWarehouseId,
          bGradeWarehouseId: dto.bGradeWarehouseId,
          productionDate: dto.productionDate
            ? new Date(dto.productionDate)
            : new Date(),
          notes: dto.notes,
          status: 'COMPLETED',
          isCostingLocked: false,
          batchItems: {
            create: itemsToReceive.map((it) => ({
              articleItemId: it.articleItemId,
              sizeName: it.sizeName || null,
              qtyFabricUsed: it.qtyFabricUsed,
              consumption: it.consumption,
              qtyTotalReceived: it.qtyTotalReceived,
              qtyAGrade: it.qtyAGrade,
              qtyBGrade: it.qtyBGrade,
              cmtCostPerPc: it.cmtRate,
              fabricCostPerPc: it.fabricCostPerPc,
              initialNetCost: it.initialNetCost,
              bUnitValue: it.bUnitValue,
              aFinalUnitCost: it.aFinalUnitCost,
              totalLineAmount: it.totalLineAmount,
            })),
          },
        },
      });

      // 8. Update Fabric Vendor Tracker consumption & log if linked
      if (dto.trackerId && tracker) {
        const currentUsed = Number(tracker.qtyUsed) || 0;
        const qtyIssued = Number(tracker.qtyIssued) || 0;
        const qtyReturned = Number(tracker.qtyReturned) || 0;
        const qtyShortage = Number(tracker.qtyShortage) || 0;
        const newUsed = currentUsed + effectiveFabricUsed;
        const isCompleted = newUsed + qtyReturned + qtyShortage >= qtyIssued;

        await tx.fabricVendorTracker.update({
          where: { id: tracker.id },
          data: {
            qtyUsed: newUsed,
            status: isCompleted ? FabricStatus.COMPLETED : FabricStatus.PARTIAL,
            consumptionDate: new Date(),
          },
        });

        await tx.fabricVendorConsumptionLog.create({
          data: {
            trackerId: tracker.id,
            qtyUsed: effectiveFabricUsed,
            consumptionDate: new Date(),
            notes: `Auto-logged from Production Batch #${batchNumber}`,
          },
        });
      }

      // 9. Stock Ledger Movements
      // 9a. OUTBOUND fabric from Vendor Warehouse
      await this.stockLedgerService.createEntry(
        {
          itemId: dto.fabricItemId,
          warehouseId: dto.fabricWarehouseId,
          qty: -effectiveFabricUsed,
          movementType: MovementType.OUTBOUND,
          referenceType: 'PRODUCTION_FABRIC_CONSUMPTION',
          referenceId: batch.id,
          rate: dto.fabricRate,
          allowNegativeStock: true,
        },
        tx as any,
        ctx,
      );

      await this.syncInventoryItem(tx, {
        itemId: dto.fabricItemId,
        warehouseId: dto.fabricWarehouseId,
        qty: -effectiveFabricUsed,
      });

      // 9b. INBOUND finished pieces for each item/size row
      for (const it of itemsToReceive) {
        if (it.qtyAGrade > 0) {
          await this.stockLedgerService.createEntry(
            {
              itemId: it.articleItemId,
              warehouseId: dto.aGradeWarehouseId,
              qty: it.qtyAGrade,
              movementType: MovementType.INBOUND,
              referenceType: 'PRODUCTION_A_GRADE',
              referenceId: batch.id,
              rate: it.aFinalUnitCost,
              allowNegativeStock: true,
            },
            tx as any,
            ctx,
          );

          await this.syncInventoryItem(tx, {
            itemId: it.articleItemId,
            warehouseId: dto.aGradeWarehouseId,
            qty: it.qtyAGrade,
          });
        }

        if (it.qtyBGrade > 0) {
          await this.stockLedgerService.createEntry(
            {
              itemId: it.articleItemId,
              warehouseId: dto.bGradeWarehouseId,
              qty: it.qtyBGrade,
              movementType: MovementType.INBOUND,
              referenceType: 'PRODUCTION_B_GRADE',
              referenceId: batch.id,
              rate: it.bUnitValue,
              allowNegativeStock: true,
            },
            tx as any,
            ctx,
          );

          await this.syncInventoryItem(tx, {
            itemId: it.articleItemId,
            warehouseId: dto.bGradeWarehouseId,
            qty: it.qtyBGrade,
          });
        }
      }

      // 10. Auto-Generate Vendor Purchase Invoice (CMT Only)
      const invoiceCount = await tx.purchaseInvoice.count();
      const invSuffix = (invoiceCount + 1).toString().padStart(4, '0');
      const invoiceNumber = `PI-CMT-${year}-${invSuffix}`;
      const cmtTotal = costing.raw.vendorCmtBillAmount;

      const invoiceItemData = await Promise.all(
        itemsToReceive.map(async (it) => {
          const itemDetail = await tx.item.findUnique({
            where: { id: it.articleItemId },
            select: { sku: true, description: true },
          });
          const itemLabel = `${it.sizeName ? `[Size ${it.sizeName}] ` : ''}${itemDetail?.description || itemDetail?.sku || 'Garment'}`;
          return {
            itemId: it.articleItemId,
            description: `CMT Stitching Labor: ${it.cmtQty} pcs (${itemLabel}) @ Rs ${it.cmtRate} (Batch #${batchNumber})`,
            quantity: it.cmtQty,
            unitPrice: it.cmtRate,
            lineTotal: it.lineCmtBill,
          };
        }),
      );

      const purchaseInvoice = await tx.purchaseInvoice.create({
        data: {
          invoiceNumber,
          invoiceDate: dto.productionDate
            ? new Date(dto.productionDate)
            : new Date(),
          supplierId: dto.supplierId,
          warehouseId: dto.aGradeWarehouseId,
          invoiceType: 'PRODUCTION_CMT',
          purchaseType: 'CMT_STITCHING',
          subtotal: cmtTotal,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: cmtTotal,
          remainingAmount: cmtTotal,
          paidAmount: 0,
          paymentStatus: 'UNPAID',
          status: 'SUBMITTED',
          notes: `Auto-generated CMT Invoice for Production Batch #${batchNumber}`,
          items: {
            create: invoiceItemData,
          },
        },
      });

      // Link invoice to production batch
      const updatedBatch = await tx.productionBatch.update({
        where: { id: batch.id },
        data: { purchaseInvoiceId: purchaseInvoice.id },
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          fabricItem: {
            select: { id: true, sku: true, description: true, uom: true },
          },
          articleItem: {
            select: {
              id: true,
              sku: true,
              description: true,
              uom: true,
              size: true,
            },
          },
          fabricWarehouse: { select: { id: true, code: true, name: true } },
          aGradeWarehouse: { select: { id: true, code: true, name: true } },
          bGradeWarehouse: { select: { id: true, code: true, name: true } },
          purchaseInvoice: {
            select: {
              id: true,
              invoiceNumber: true,
              totalAmount: true,
              status: true,
            },
          },
          tracker: {
            select: {
              id: true,
              trackerNumber: true,
              qtyIssued: true,
              qtyUsed: true,
              status: true,
            },
          },
          batchItems: {
            include: {
              articleItem: {
                select: { id: true, sku: true, description: true, size: true },
              },
            },
          },
        },
      });

      return updatedBatch;
    });
  }

  /**
   * Send B-grade stock for refresh and return into A-Grade warehouse
   */
  async refreshBGrade(
    dto: RefreshBGradeDto,
    ctx?: { userId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const qtyToRefresh = Number(dto.qtyRefreshed);
    const refreshRate = Number(dto.refreshRate || 0);

    if (qtyToRefresh <= 0) {
      throw new BadRequestException(
        'Refresh quantity must be greater than zero.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.productionBatch.findUnique({
        where: { id: dto.batchId },
        include: {
          articleItem: true,
          supplier: true,
          batchItems: {
            include: { articleItem: true },
          },
        },
      });

      if (!batch) {
        throw new NotFoundException(
          `Production batch with ID ${dto.batchId} not found.`,
        );
      }

      let targetItem: any = null;
      if (dto.batchItemId) {
        targetItem = batch.batchItems.find((it) => it.id === dto.batchItemId);
        if (!targetItem) {
          throw new NotFoundException(
            `Batch item with ID ${dto.batchItemId} not found in batch #${batch.batchNumber}.`,
          );
        }
      } else if (batch.batchItems && batch.batchItems.length === 1) {
        targetItem = batch.batchItems[0];
      }

      // Determine item-specific details vs batch fallback
      const effectiveItemId = targetItem
        ? targetItem.articleItemId
        : batch.articleItemId;
      const effectiveBUnitValue = targetItem
        ? Number(targetItem.bUnitValue)
        : Number(batch.bUnitValue);
      const effectiveAFinalCost = targetItem
        ? Number(targetItem.aFinalUnitCost)
        : Number(batch.aFinalUnitCost);

      const totalBGrade = targetItem
        ? Number(targetItem.qtyBGrade)
        : Number(batch.qtyBGrade);
      const alreadyRefreshed = targetItem
        ? Number(targetItem.qtyRefreshed || 0)
        : Number(batch.qtyRefreshed);
      const availableToRefresh = totalBGrade - alreadyRefreshed;

      if (qtyToRefresh > availableToRefresh + 0.0001) {
        throw new BadRequestException(
          `Cannot refresh ${qtyToRefresh} pieces. Only ${availableToRefresh} B-grade pieces remain available for this garment line.`,
        );
      }

      // 1. OUTBOUND from B-Grade Warehouse for the specific article
      await this.stockLedgerService.createEntry(
        {
          itemId: effectiveItemId,
          warehouseId: batch.bGradeWarehouseId,
          qty: -qtyToRefresh,
          movementType: MovementType.OUTBOUND,
          referenceType: 'B_GRADE_REFRESH_OUT',
          referenceId: batch.id,
          rate: effectiveBUnitValue,
          allowNegativeStock: true,
        },
        tx as any,
        ctx,
      );

      await this.syncInventoryItem(tx, {
        itemId: effectiveItemId,
        warehouseId: batch.bGradeWarehouseId,
        qty: -qtyToRefresh,
      });

      // 2. INBOUND into A-Grade Warehouse at this specific item's recalculated A-cost!
      await this.stockLedgerService.createEntry(
        {
          itemId: effectiveItemId,
          warehouseId: batch.aGradeWarehouseId,
          qty: qtyToRefresh,
          movementType: MovementType.INBOUND,
          referenceType: 'B_GRADE_REFRESH_IN',
          referenceId: batch.id,
          rate: effectiveAFinalCost,
          allowNegativeStock: true,
        },
        tx as any,
        ctx,
      );

      await this.syncInventoryItem(tx, {
        itemId: effectiveItemId,
        warehouseId: batch.aGradeWarehouseId,
        qty: qtyToRefresh,
      });

      // 3. Optional: Create Refresh Purchase Invoice if vendor charges a rework rate
      let refreshInvoiceId: string | null = null;
      const refreshTotalAmount = qtyToRefresh * refreshRate;

      if (refreshRate > 0) {
        const year = new Date().getFullYear();
        const count = await tx.purchaseInvoice.count();
        const invSuffix = (count + 1).toString().padStart(4, '0');
        const invoiceNumber = `PI-REFRESH-${year}-${invSuffix}`;

        const refreshInvoice = await tx.purchaseInvoice.create({
          data: {
            invoiceNumber,
            invoiceDate: new Date(),
            supplierId: batch.supplierId,
            warehouseId: batch.aGradeWarehouseId,
            invoiceType: 'PRODUCTION_REFRESH',
            purchaseType: 'REFRESH_CMT',
            subtotal: refreshTotalAmount,
            taxAmount: 0,
            discountAmount: 0,
            totalAmount: refreshTotalAmount,
            remainingAmount: refreshTotalAmount,
            paidAmount: 0,
            paymentStatus: 'UNPAID',
            status: 'SUBMITTED',
            notes: `Refresh Rework charges for ${qtyToRefresh} pcs from Batch #${batch.batchNumber}`,
            items: {
              create: [
                {
                  itemId: effectiveItemId,
                  description: `Rework/Refresh CMT for ${qtyToRefresh} pcs @ Rs ${refreshRate} (Batch #${batch.batchNumber})`,
                  quantity: qtyToRefresh,
                  unitPrice: refreshRate,
                  lineTotal: refreshTotalAmount,
                },
              ],
            },
          },
        });
        refreshInvoiceId = refreshInvoice.id;
      }

      // 4. Update item refreshed qty AND batch refreshed qty
      if (targetItem) {
        await tx.productionBatchItem.update({
          where: { id: targetItem.id },
          data: {
            qtyRefreshed: {
              increment: qtyToRefresh,
            },
          },
        });
      }

      const updatedRefreshed = Number(batch.qtyRefreshed) + qtyToRefresh;
      await tx.productionBatch.update({
        where: { id: batch.id },
        data: { qtyRefreshed: updatedRefreshed },
      });

      // 5. Create Refresh Log
      const refreshLog = await tx.productionRefreshLog.create({
        data: {
          batchId: batch.id,
          qtyRefreshed: qtyToRefresh,
          refreshRate,
          refreshTotalAmount,
          refreshInvoiceId,
          notes: targetItem?.sizeName
            ? `[${targetItem.sizeName}] ${dto.notes || ''}`
            : dto.notes,
        },
      });

      return {
        success: true,
        message: `Successfully refreshed ${qtyToRefresh} pieces into A-grade stock!`,
        refreshedQty: qtyToRefresh,
        remainingBGrade: Math.max(0, availableToRefresh - qtyToRefresh),
        log: refreshLog,
      };
    });
  }

  /**
   * Get all production batches
   */
  async findAllBatches(query?: {
    supplierId?: string;
    articleItemId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      supplierId,
      articleItemId,
      search,
      page = 1,
      limit = 50,
    } = query || {};
    const skip = (page - 1) * limit;

    const where: any = {
      ...(supplierId && { supplierId }),
      ...(articleItemId && { articleItemId }),
    };

    if (search) {
      where.OR = [
        { batchNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
        { articleItem: { sku: { contains: search, mode: 'insensitive' } } },
        {
          articleItem: {
            description: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [batches, total] = await Promise.all([
      this.prisma.productionBatch.findMany({
        where,
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          fabricItem: {
            select: { id: true, sku: true, description: true, uom: true },
          },
          articleItem: {
            select: {
              id: true,
              sku: true,
              description: true,
              uom: true,
              size: true,
            },
          },
          fabricWarehouse: { select: { id: true, code: true, name: true } },
          aGradeWarehouse: { select: { id: true, code: true, name: true } },
          bGradeWarehouse: { select: { id: true, code: true, name: true } },
          purchaseInvoice: {
            select: {
              id: true,
              invoiceNumber: true,
              totalAmount: true,
              status: true,
            },
          },
          tracker: {
            select: {
              id: true,
              trackerNumber: true,
              qtyIssued: true,
              qtyUsed: true,
              status: true,
            },
          },
          batchItems: {
            include: {
              articleItem: {
                select: { id: true, sku: true, description: true, size: true },
              },
            },
          },
          refreshLogs: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.productionBatch.count({ where }),
    ]);

    return { batches, total, page, limit };
  }

  /**
   * Get batch details by ID
   */
  async findOneBatch(id: string) {
    const batch = await this.prisma.productionBatch.findUnique({
      where: { id },
      include: {
        supplier: true,
        fabricItem: true,
        articleItem: { include: { size: true } },
        fabricWarehouse: true,
        aGradeWarehouse: true,
        bGradeWarehouse: true,
        tracker: true,
        batchItems: {
          include: {
            articleItem: { include: { size: true } },
          },
        },
        purchaseInvoice: {
          include: {
            items: true,
          },
        },
        refreshLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException(`Production batch with ID ${id} not found`);
    }

    return batch;
  }

  /**
   * Get B-Grade stock grouped by article item and vendor receiving batch
   */
  async getBGradeInventory() {
    const batches = await this.prisma.productionBatch.findMany({
      where: {
        qtyBGrade: { gt: 0 },
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        articleItem: {
          select: {
            id: true,
            sku: true,
            description: true,
            uom: true,
            size: true,
          },
        },
        bGradeWarehouse: { select: { id: true, code: true, name: true } },
        aGradeWarehouse: { select: { id: true, code: true, name: true } },
        batchItems: {
          where: { qtyBGrade: { gt: 0 } },
          include: {
            articleItem: {
              select: { id: true, sku: true, description: true, size: true },
            },
          },
        },
        refreshLogs: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const stockItems: any[] = [];

    for (const b of batches) {
      if (b.batchItems && b.batchItems.length > 0) {
        // Return per-item records so each garment's B-grade can be managed and refreshed individually
        for (const it of b.batchItems) {
          const itemTotalB = Number(it.qtyBGrade || 0);
          const itemRefreshed = Number(it.qtyRefreshed || 0);
          const itemRemainingB = Math.max(0, itemTotalB - itemRefreshed);
          const bUnitVal = Number(it.bUnitValue || b.bUnitValue || 0);
          const remainingVal = itemRemainingB * bUnitVal;
          const aFinalCost = Number(it.aFinalUnitCost || b.aFinalUnitCost || 0);

          stockItems.push({
            id: it.id,
            batchId: b.id,
            batchItemId: it.id,
            batchNumber: b.batchNumber,
            productionDate: b.productionDate,
            supplier: b.supplier,
            articleItemId: it.articleItemId,
            articleItem: it.articleItem || b.articleItem,
            sizeName: it.sizeName,
            bGradeWarehouse: b.bGradeWarehouse,
            aGradeWarehouse: b.aGradeWarehouse,
            qtyBGradeTotal: itemTotalB,
            qtyRefreshed: itemRefreshed,
            qtyRemainingBGrade: itemRemainingB,
            bUnitValue: bUnitVal,
            remainingValuation: Number(remainingVal.toFixed(2)),
            aFinalUnitCost: aFinalCost,
            batchItems: b.batchItems,
            refreshLogs: b.refreshLogs,
          });
        }
      } else {
        // Fallback for single-article legacy batches
        const totalB = Number(b.qtyBGrade);
        const refreshed = Number(b.qtyRefreshed);
        const remainingB = Math.max(0, totalB - refreshed);
        const bUnitValue = Number(b.bUnitValue);
        const remainingValue = remainingB * bUnitValue;

        stockItems.push({
          id: b.id,
          batchId: b.id,
          batchItemId: null,
          batchNumber: b.batchNumber,
          productionDate: b.productionDate,
          supplier: b.supplier,
          articleItemId: b.articleItemId,
          articleItem: b.articleItem,
          sizeName: null,
          bGradeWarehouse: b.bGradeWarehouse,
          aGradeWarehouse: b.aGradeWarehouse,
          qtyBGradeTotal: totalB,
          qtyRefreshed: refreshed,
          qtyRemainingBGrade: remainingB,
          bUnitValue,
          remainingValuation: Number(remainingValue.toFixed(2)),
          aFinalUnitCost: Number(b.aFinalUnitCost),
          batchItems: b.batchItems,
          refreshLogs: b.refreshLogs,
        });
      }
    }

    return stockItems;
  }

  /**
   * Summary Dashboard KPIs
   */
  async getDashboardStats() {
    const batches = await this.prisma.productionBatch.findMany();

    let totalFabricUsed = 0;
    let totalPiecesProduced = 0;
    let totalAGradePieces = 0;
    let totalBGradePieces = 0;
    let totalRefreshedPieces = 0;
    let totalBatchBill = 0;

    for (const b of batches) {
      totalFabricUsed += Number(b.qtyFabricUsed || 0);
      totalPiecesProduced += Number(b.qtyTotalReceived || 0);
      totalAGradePieces += Number(b.qtyAGrade || 0);
      totalBGradePieces += Number(b.qtyBGrade || 0);
      totalRefreshedPieces += Number(b.qtyRefreshed || 0);
      totalBatchBill += Number(b.totalBill || 0);
    }

    const pendingRefreshPieces = Math.max(
      0,
      totalBGradePieces - totalRefreshedPieces,
    );
    const avgConsumption =
      totalPiecesProduced > 0
        ? (totalFabricUsed / totalPiecesProduced).toFixed(2)
        : '0.00';
    const bGradeRatio =
      totalPiecesProduced > 0
        ? ((totalBGradePieces / totalPiecesProduced) * 100).toFixed(1)
        : '0.0';

    return {
      totalBatches: batches.length,
      totalFabricUsed: Number(totalFabricUsed.toFixed(2)),
      totalPiecesProduced,
      totalAGradePieces,
      totalBGradePieces,
      totalRefreshedPieces,
      pendingRefreshPieces,
      totalBatchBill: Number(totalBatchBill.toFixed(2)),
      avgConsumption,
      bGradeRatio: `${bGradeRatio}%`,
    };
  }

  private async syncInventoryItem(
    tx: Prisma.TransactionClient,
    params: {
      itemId: string;
      warehouseId: string;
      locationId?: string | null;
      qty: number;
    },
  ) {
    try {
      const existing = await tx.inventoryItem.findFirst({
        where: {
          itemId: params.itemId,
          warehouseId: params.warehouseId,
          locationId: params.locationId || null,
          status: 'AVAILABLE',
        },
      });
      if (existing) {
        await tx.inventoryItem.update({
          where: { id: existing.id },
          data: {
            quantity: { increment: new Prisma.Decimal(params.qty) },
          },
        });
      } else {
        await tx.inventoryItem.create({
          data: {
            itemId: params.itemId,
            warehouseId: params.warehouseId,
            locationId: params.locationId || null,
            quantity: new Prisma.Decimal(params.qty),
            status: 'AVAILABLE',
          },
        });
      }
    } catch (e) {
      console.warn('syncInventoryItem warning:', e);
    }
  }

  // ───────────────────────────────────────────────────────────────
  // B-GRADE REFRESH WORKFLOW (Two-Phase: Send Out → Receive Back)
  // ───────────────────────────────────────────────────────────────

  async createBGradeRefreshOrder(
    dto: CreateBGradeRefreshOrderDto,
    ctx?: { userId?: string; ipAddress?: string; userAgent?: string },
  ) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Generate order number
      const year = new Date().getFullYear();
      const count = await tx.bGradeRefreshOrder.count();
      const orderNumber = `BGO-${year}-${(count + 1).toString().padStart(4, '0')}`;

      // Create the order
      const order = await tx.bGradeRefreshOrder.create({
        data: {
          orderNumber,
          supplierId: dto.supplierId,
          bGradeWarehouseId: dto.bGradeWarehouseId,
          sentDate: dto.sentDate ? new Date(dto.sentDate) : new Date(),
          notes: dto.notes,
          status: 'PENDING',
          items: {
            create: dto.items.map((item) => ({
              itemId: item.itemId,
              qtySent: item.qtySent,
              qtyReceived: 0,
              bUnitValue: item.bUnitValue,
              aFinalUnitCost: item.aFinalUnitCost,
            })),
          },
        },
        include: {
          items: true,
          supplier: true,
          bGradeWarehouse: true,
        },
      });

      // Deduct from B-grade warehouse immediately (stock leaves warehouse on send)
      for (const item of dto.items) {
        await this.stockLedgerService.createEntry(
          {
            itemId: item.itemId,
            warehouseId: dto.bGradeWarehouseId,
            qty: -Number(item.qtySent),
            movementType: MovementType.OUTBOUND,
            referenceType: 'B_GRADE_REFRESH_SEND',
            referenceId: order.id,
            rate: Number(item.bUnitValue),
            allowNegativeStock: true,
          },
          tx as any,
          ctx,
        );

        await this.syncInventoryItem(tx, {
          itemId: item.itemId,
          warehouseId: dto.bGradeWarehouseId,
          qty: -Number(item.qtySent),
        });
      }

      return order;
    });
  }

  async createBGradeRefreshReceiving(
    dto: CreateBGradeRefreshReceivingDto,
    ctx?: { userId?: string; ipAddress?: string; userAgent?: string },
  ) {
    const refreshCostPerPc = Number(dto.refreshCostPerPc || 0);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.bGradeRefreshOrder.findUnique({
        where: { id: dto.orderId },
        include: {
          items: { include: { item: true } },
          supplier: true,
        },
      });

      if (!order) throw new NotFoundException(`Refresh order ${dto.orderId} not found.`);
      if (order.status === 'CANCELLED') throw new BadRequestException('Cannot receive against a cancelled order.');
      if (order.status === 'COMPLETED') throw new BadRequestException('This refresh order is already fully completed.');

      // Validate qty constraints
      for (const ri of dto.items) {
        const orderItem = order.items.find((oi) => oi.id === ri.orderItemId);
        if (!orderItem) throw new NotFoundException(`Order item ${ri.orderItemId} not found.`);
        const processedBefore = Number(orderItem.qtyReceived) + Number(orderItem.qtyReturnedBGrade || 0);
        const remaining = Number(orderItem.qtySent) - processedBefore;
        const nowProcessing = (Number(ri.qtyReceived) || 0) + (Number(ri.qtyReturnedBGrade) || 0);
        if (nowProcessing > remaining + 0.0001) {
          throw new BadRequestException(
            `Cannot receive ${nowProcessing} pcs (${ri.qtyReceived || 0} fresh, ${ri.qtyReturnedBGrade || 0} returned B-grade) for item ${orderItem.item?.sku || orderItem.itemId}. Only ${remaining} pcs remain pending with vendor.`,
          );
        }
      }

      // Generate receiving number
      const year = new Date().getFullYear();
      const count = await tx.bGradeRefreshReceiving.count();
      const receivingNumber = `BGR-${year}-${(count + 1).toString().padStart(4, '0')}`;

      const totalQtyFresh = dto.items.reduce((s, i) => s + (Number(i.qtyReceived) || 0), 0);
      const totalQtyReturnedBGrade = dto.items.reduce((s, i) => s + (Number(i.qtyReturnedBGrade) || 0), 0);

      if (totalQtyFresh <= 0 && totalQtyReturnedBGrade <= 0) {
        throw new BadRequestException('Please enter at least 1 piece to receive (either fresh A-grade or returned B-grade).');
      }

      const bRefreshRatePerPc = refreshCostPerPc * 0.5; // 50% rate for returned B-grade pieces (Rs. 60 when fresh is Rs. 120)
      const freshCostTotal = totalQtyFresh * refreshCostPerPc;
      const bCostTotal = totalQtyReturnedBGrade * bRefreshRatePerPc;
      const totalRefreshCost = freshCostTotal + bCostTotal;

      // Create purchase invoice if refresh cost > 0
      let purchaseInvoiceId: string | null = null;
      if (totalRefreshCost > 0) {
        const piCount = await tx.purchaseInvoice.count();
        const invoiceNumber = `PI-REFRESH-${year}-${(piCount + 1).toString().padStart(4, '0')}`;

        // Build separate line items: Fresh (Full Rate) + Returned B-Grade (50% Rate)
        const invoiceLines: Array<{
          itemId: string;
          description: string;
          quantity: number;
          unitPrice: number;
          lineTotal: number;
        }> = [];

        for (const i of dto.items) {
          const qRecv = Number(i.qtyReceived) || 0;
          const qBRet = Number(i.qtyReturnedBGrade) || 0;
          const oi = order.items.find((x) => x.id === i.orderItemId)!;

          if (qRecv > 0 && refreshCostPerPc > 0) {
            invoiceLines.push({
              itemId: i.itemId,
              description: `Refresh CMT (Fresh A-Grade) — ${oi.item?.sku || oi.itemId} (${qRecv} pcs @ Rs ${refreshCostPerPc}/pc)`,
              quantity: qRecv,
              unitPrice: refreshCostPerPc,
              lineTotal: qRecv * refreshCostPerPc,
            });
          }

          if (qBRet > 0 && bRefreshRatePerPc > 0) {
            invoiceLines.push({
              itemId: i.itemId,
              description: `Refresh CMT (Returned B-Grade) — ${oi.item?.sku || oi.itemId} (${qBRet} pcs @ 50% rate Rs ${bRefreshRatePerPc}/pc)`,
              quantity: qBRet,
              unitPrice: bRefreshRatePerPc,
              lineTotal: qBRet * bRefreshRatePerPc,
            });
          }
        }

        const inv = await tx.purchaseInvoice.create({
          data: {
            invoiceNumber,
            invoiceDate: dto.receivedDate ? new Date(dto.receivedDate) : new Date(),
            supplierId: order.supplierId,
            warehouseId: dto.aGradeWarehouseId,
            invoiceType: 'PRODUCTION_REFRESH',
            purchaseType: 'REFRESH_CMT',
            subtotal: totalRefreshCost,
            taxAmount: 0,
            discountAmount: 0,
            totalAmount: totalRefreshCost,
            remainingAmount: totalRefreshCost,
            paidAmount: 0,
            paymentStatus: 'UNPAID',
            status: 'SUBMITTED',
            notes: `B-Grade Refresh charges — Order ${order.orderNumber}. ${totalQtyFresh} fresh pcs @ Rs ${refreshCostPerPc}/pc (Rs ${freshCostTotal}) + ${totalQtyReturnedBGrade} returned B-grade pcs @ Rs ${bRefreshRatePerPc}/pc (Rs ${bCostTotal}) = Total Rs ${totalRefreshCost}`,
            items: {
              create: invoiceLines,
            },
          },
        });
        purchaseInvoiceId = inv.id;
      }

      // Create receiving record
      const receiving = await tx.bGradeRefreshReceiving.create({
        data: {
          receivingNumber,
          orderId: dto.orderId,
          supplierId: order.supplierId,
          aGradeWarehouseId: dto.aGradeWarehouseId,
          refreshCostPerPc,
          totalRefreshCost,
          purchaseInvoiceId,
          receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : new Date(),
          notes: dto.notes,
          items: {
            create: dto.items.map((i) => {
              const qRecv = Number(i.qtyReceived) || 0;
              const qBRet = Number(i.qtyReturnedBGrade) || 0;
              const oi = order.items.find((x) => x.id === i.orderItemId)!;
              const freshACost = Number(oi.aFinalUnitCost) + refreshCostPerPc;
              const bUnitVal = freshACost * 0.5;
              return {
                orderItemId: i.orderItemId,
                itemId: i.itemId,
                qtyReceived: qRecv,
                qtyReturnedBGrade: qBRet,
                refreshCostPerPc,
                bUnitValue: bUnitVal,
              };
            }),
          },
        },
        include: { items: true },
      });

      // Update order items & stock ledgers:
      // 1. Fresh A-Grade pieces inbound to aGradeWarehouseId at (aFinalUnitCost + refreshCostPerPc)
      // 2. Returned B-Grade pieces inbound to bGradeWarehouseId at 50% of the fresh A-Grade unit cost
      for (const ri of dto.items) {
        const qRecv = Number(ri.qtyReceived) || 0;
        const qBRet = Number(ri.qtyReturnedBGrade) || 0;
        if (qRecv <= 0 && qBRet <= 0) continue;

        const orderItem = order.items.find((oi) => oi.id === ri.orderItemId)!;
        const freshACost = Number(orderItem.aFinalUnitCost) + refreshCostPerPc;
        const bUnitVal = freshACost * 0.5;

        // Inbound Fresh pieces to A-grade warehouse
        if (qRecv > 0) {
          await this.stockLedgerService.createEntry(
            {
              itemId: ri.itemId,
              warehouseId: dto.aGradeWarehouseId,
              qty: qRecv,
              movementType: MovementType.INBOUND,
              referenceType: 'B_GRADE_REFRESH_RECEIVE',
              referenceId: receiving.id,
              rate: freshACost,
              allowNegativeStock: true,
            },
            tx as any,
            ctx,
          );

          await this.syncInventoryItem(tx, {
            itemId: ri.itemId,
            warehouseId: dto.aGradeWarehouseId,
            qty: qRecv,
          });
        }

        // Inbound Defective / Returned pieces back to B-grade warehouse
        if (qBRet > 0) {
          await this.stockLedgerService.createEntry(
            {
              itemId: ri.itemId,
              warehouseId: order.bGradeWarehouseId,
              qty: qBRet,
              movementType: MovementType.INBOUND,
              referenceType: 'B_GRADE_REFRESH_RETURN',
              referenceId: receiving.id,
              rate: bUnitVal,
              allowNegativeStock: true,
            },
            tx as any,
            ctx,
          );

          await this.syncInventoryItem(tx, {
            itemId: ri.itemId,
            warehouseId: order.bGradeWarehouseId,
            qty: qBRet,
          });
        }

        // Update order item tracked quantities
        await tx.bGradeRefreshOrderItem.update({
          where: { id: ri.orderItemId },
          data: {
            qtyReceived: { increment: qRecv },
            qtyReturnedBGrade: { increment: qBRet },
          },
        });
      }

      // Recalculate order status: COMPLETED if all sent pieces are accounted for (Fresh + Returned B-Grade)
      const updatedItems = await tx.bGradeRefreshOrderItem.findMany({ where: { orderId: dto.orderId } });
      const totalSent = updatedItems.reduce((s, i) => s + Number(i.qtySent), 0);
      const totalAccounted = updatedItems.reduce(
        (s, i) => s + Number(i.qtyReceived) + Number(i.qtyReturnedBGrade || 0),
        0,
      );
      const newStatus = totalAccounted >= totalSent - 0.0001 ? 'COMPLETED' : 'PARTIALLY_RECEIVED';

      await tx.bGradeRefreshOrder.update({
        where: { id: dto.orderId },
        data: { status: newStatus },
      });

      return { success: true, receiving, orderStatus: newStatus };
    });
  }

  async getBGradeRefreshOrders(filters?: { status?: string; supplierId?: string }) {
    return this.prisma.bGradeRefreshOrder.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.supplierId && { supplierId: filters.supplierId }),
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        bGradeWarehouse: { select: { id: true, code: true, name: true } },
        items: {
          include: { item: { select: { id: true, sku: true, description: true } } },
        },
        receivings: { select: { id: true, receivingNumber: true, receivedDate: true, totalRefreshCost: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBGradeRefreshOrderById(id: string) {
    const order = await this.prisma.bGradeRefreshOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        bGradeWarehouse: true,
        items: {
          include: {
            item: { select: { id: true, sku: true, description: true, uom: true } },
            receivingItems: true,
          },
        },
        receivings: {
          include: {
            items: {
              include: {
                item: { select: { id: true, sku: true, description: true, uom: true } },
              },
            },
            aGradeWarehouse: { select: { id: true, code: true, name: true } },
            purchaseInvoice: { select: { id: true, invoiceNumber: true, totalAmount: true, paymentStatus: true } },
          },
          orderBy: { receivedDate: 'desc' },
        },
      },
    });
    if (!order) throw new NotFoundException(`Refresh order ${id} not found.`);
    return order;
  }

  async cancelBGradeRefreshOrder(
    id: string,
    ctx?: { userId?: string; ipAddress?: string; userAgent?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.bGradeRefreshOrder.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) throw new NotFoundException(`Refresh order ${id} not found.`);
      if (order.status !== 'PENDING') {
        throw new BadRequestException('Only PENDING orders can be cancelled.');
      }

      // Reverse stock deductions
      for (const item of order.items) {
        await this.stockLedgerService.createEntry(
          {
            itemId: item.itemId,
            warehouseId: order.bGradeWarehouseId,
            qty: Number(item.qtySent),
            movementType: MovementType.INBOUND,
            referenceType: 'B_GRADE_REFRESH_CANCEL',
            referenceId: order.id,
            rate: Number(item.bUnitValue),
            allowNegativeStock: true,
          },
          tx as any,
          ctx,
        );

        await this.syncInventoryItem(tx, {
          itemId: item.itemId,
          warehouseId: order.bGradeWarehouseId,
          qty: Number(item.qtySent),
        });
      }

      return tx.bGradeRefreshOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
    });
  }
}
