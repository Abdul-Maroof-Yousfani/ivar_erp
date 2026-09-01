import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockLedgerService } from '../warehouse/stock-ledger/stock-ledger.service';
import { CreateFabricIssueDto } from './dto/create-fabric-issue.dto';
import { UpdateConsumptionDto } from './dto/update-consumption.dto';
import { FabricStatus, MovementType } from '@prisma/client';

@Injectable()
export class FabricVendorTrackerService {
  constructor(
    private prisma: PrismaService,
    private stockLedgerService: StockLedgerService,
  ) {}

  async create(dto: CreateFabricIssueDto, ctx?: { userId?: string; ipAddress?: string; userAgent?: string }) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Generate unique tracker number: FT-YYYY-XXXX
      const year = new Date().getFullYear();
      const count = await tx.fabricVendorTracker.count();
      let suffix = (count + 1).toString().padStart(4, '0');
      let trackerNumber = `FT-${year}-${suffix}`;

      // In case of parallel creations or concurrency
      let exists = await tx.fabricVendorTracker.findUnique({ where: { trackerNumber } });
      let attempts = 0;
      while (exists && attempts < 10) {
        attempts++;
        suffix = (count + 1 + attempts).toString().padStart(4, '0');
        trackerNumber = `FT-${year}-${suffix}`;
        exists = await tx.fabricVendorTracker.findUnique({ where: { trackerNumber } });
      }

      // 2. Fetch the Item to get its current rate/price
      const item = await tx.item.findUnique({
        where: { id: dto.itemId },
      });
      if (!item) {
        throw new NotFoundException(`Item with ID ${dto.itemId} not found`);
      }

      // 3. Create the Fabric Vendor Tracker record
      const tracker = await tx.fabricVendorTracker.create({
        data: {
          trackerNumber,
          supplierId: dto.supplierId,
          itemId: dto.itemId,
          warehouseId: dto.warehouseId,
          qtyIssued: dto.qtyIssued,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
          status: FabricStatus.PENDING,
          notes: dto.notes,
        },
      });

      // 4. Create an OUTBOUND Stock Ledger Entry (deduct from warehouse stock)
      // Note: qty must be negative for OUTBOUND in createEntry
      const rate = item.unitPrice || 0;
      await this.stockLedgerService.createEntry(
        {
          itemId: dto.itemId,
          warehouseId: dto.warehouseId,
          qty: -dto.qtyIssued,
          movementType: MovementType.OUTBOUND,
          referenceType: 'FABRIC_ISSUE',
          referenceId: tracker.id,
          rate,
        },
        tx,
        ctx,
      );

      return tracker;
    });
  }

  async updateConsumption(id: string, dto: UpdateConsumptionDto, ctx?: { userId?: string; ipAddress?: string; userAgent?: string }) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Find tracker record
      const tracker = await tx.fabricVendorTracker.findUnique({
        where: { id },
      });
      if (!tracker) {
        throw new NotFoundException(`Fabric Tracker record with ID ${id} not found`);
      }

      if (tracker.status === FabricStatus.COMPLETED) {
        throw new BadRequestException('This fabric tracking record has already been marked as COMPLETED.');
      }

      const currentUsed = Number(tracker.qtyUsed) || 0;
      const currentReturned = Number(tracker.qtyReturned) || 0;
      const currentShortage = Number(tracker.qtyShortage) || 0;
      const qtyIssued = Number(tracker.qtyIssued);

      const previousAccounted = currentUsed + currentReturned + currentShortage;
      const remainingUnaccounted = qtyIssued - previousAccounted;

      const newEntrySum = Number(dto.qtyUsed || 0) + Number(dto.qtyReturned || 0) + Number(dto.qtyShortage || 0);

      if (newEntrySum <= 0) {
        throw new BadRequestException('Please enter a quantity for used, returned, or shortage.');
      }

      if (newEntrySum > remainingUnaccounted + 0.0001) {
        throw new BadRequestException(
          `Cannot log ${newEntrySum} meters. Remaining unaccounted fabric is only ${remainingUnaccounted.toFixed(2)} meters.`,
        );
      }

      const updatedQtyUsed = currentUsed + Number(dto.qtyUsed || 0);
      const updatedQtyReturned = currentReturned + Number(dto.qtyReturned || 0);
      const updatedQtyShortage = currentShortage + Number(dto.qtyShortage || 0);
      const updatedTotalAccounted = updatedQtyUsed + updatedQtyReturned + updatedQtyShortage;

      const newStatus =
        Math.abs(updatedTotalAccounted - qtyIssued) < 0.0001 || updatedTotalAccounted >= qtyIssued
          ? FabricStatus.COMPLETED
          : FabricStatus.PARTIAL;

      // 3. Update the tracker record
      const updatedTracker = await tx.fabricVendorTracker.update({
        where: { id },
        data: {
          qtyUsed: updatedQtyUsed,
          qtyReturned: updatedQtyReturned,
          qtyShortage: updatedQtyShortage,
          consumptionDate: dto.consumptionDate ? new Date(dto.consumptionDate) : new Date(),
          status: newStatus,
          notes: dto.notes
            ? tracker.notes
              ? `${tracker.notes} | ${dto.notes}`
              : dto.notes
            : tracker.notes,
        },
      });

      // 4. Create consumption log history
      await tx.fabricVendorConsumptionLog.create({
        data: {
          trackerId: id,
          qtyUsed: Number(dto.qtyUsed || 0),
          qtyReturned: Number(dto.qtyReturned || 0),
          qtyShortage: Number(dto.qtyShortage || 0),
          consumptionDate: dto.consumptionDate ? new Date(dto.consumptionDate) : new Date(),
          notes: dto.notes,
        },
      });

      // 5. If qtyReturned > 0 for this entry, return the returned fabric back to Main Store/Warehouse
      if (Number(dto.qtyReturned || 0) > 0) {
        const item = await tx.item.findUnique({
          where: { id: tracker.itemId },
        });
        const rate = item?.unitPrice || 0;

        await this.stockLedgerService.createEntry(
          {
            itemId: tracker.itemId,
            warehouseId: tracker.warehouseId,
            qty: Number(dto.qtyReturned),
            movementType: MovementType.INBOUND,
            referenceType: 'FABRIC_RETURN',
            referenceId: tracker.id,
            rate,
          },
          tx,
          ctx,
        );
      }

      return updatedTracker;
    });
  }

  async findAll(options?: {
    supplierId?: string;
    itemId?: string;
    status?: FabricStatus;
    search?: string;
  }) {
    const { supplierId, itemId, status, search } = options || {};

    const where: any = {
      ...(supplierId && { supplierId }),
      ...(itemId && { itemId }),
      ...(status && { status }),
    };

    if (search) {
      where.OR = [
        { trackerNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
        { item: { sku: { contains: search, mode: 'insensitive' } } },
        { item: { description: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.fabricVendorTracker.findMany({
      where,
      include: {
        supplier: {
          select: { id: true, code: true, name: true, contactNo: true },
        },
        item: {
          select: { id: true, itemId: true, sku: true, description: true, uom: true },
        },
        warehouse: {
          select: { id: true, code: true, name: true },
        },
        consumptionLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const tracker = await this.prisma.fabricVendorTracker.findUnique({
      where: { id },
      include: {
        supplier: {
          select: { id: true, code: true, name: true, contactNo: true },
        },
        item: {
          select: { id: true, itemId: true, sku: true, description: true, uom: true },
        },
        warehouse: {
          select: { id: true, code: true, name: true },
        },
        consumptionLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!tracker) {
      throw new NotFoundException(`Fabric tracker with ID ${id} not found`);
    }

    return tracker;
  }

  async remove(id: string, ctx?: { userId?: string; ipAddress?: string; userAgent?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const tracker = await tx.fabricVendorTracker.findUnique({
        where: { id },
      });
      if (!tracker) {
        throw new NotFoundException(`Fabric tracker with ID ${id} not found`);
      }

      // Revert the stock movements
      const item = await tx.item.findUnique({ where: { id: tracker.itemId } });
      const rate = item?.unitPrice || 0;

      // 1. Revert Issue: We deducted qtyIssued from store. Now we add it back.
      await this.stockLedgerService.createEntry(
        {
          itemId: tracker.itemId,
          warehouseId: tracker.warehouseId,
          qty: Number(tracker.qtyIssued), // Add back positive
          movementType: MovementType.INBOUND,
          referenceType: 'FABRIC_ISSUE_REVERSION',
          referenceId: tracker.id,
          rate,
        },
        tx,
        ctx,
      );

      // 2. Revert Return: If tracker was COMPLETED and had returns, we added qtyReturned back to store.
      // Now we must deduct it.
      if (tracker.status === FabricStatus.COMPLETED && Number(tracker.qtyReturned) > 0) {
        await this.stockLedgerService.createEntry(
          {
            itemId: tracker.itemId,
            warehouseId: tracker.warehouseId,
            qty: -Number(tracker.qtyReturned), // Deduct negative
            movementType: MovementType.OUTBOUND,
            referenceType: 'FABRIC_RETURN_REVERSION',
            referenceId: tracker.id,
            rate,
          },
          tx,
          ctx,
        );
      }

      // 3. Delete the tracker
      await tx.fabricVendorTracker.delete({
        where: { id },
      });

      return { status: true, message: 'Fabric tracking record successfully deleted and stock reverted.' };
    });
  }
}
