import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

import { ActivityLogsService } from '../../activity-logs/activity-logs.service';
import { runInBackground } from '../../common/utils/run-in-background.util';
@Injectable()
export class SupplierService {
  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
  ) {}

  /**
   * Generates the next sequential supplier code under the 2001 series (Payables).
   * Scans both Supplier and ChartOfAccount tables to prevent any collision.
   */
  async getNextCode(): Promise<{ status: boolean; data: string; message?: string }> {
    try {
      const [suppliers, coaAccounts] = await Promise.all([
        this.prisma.supplier.findMany({
          where: { code: { startsWith: '2001' } },
          select: { code: true },
        }),
        this.prisma.chartOfAccount.findMany({
          where: { code: { startsWith: '2001' } },
          select: { code: true },
        }),
      ]);

      let maxNum = 0;
      const codeRegex = /^2001(\d{4})$/;

      for (const s of suppliers) {
        const match = s.code.match(codeRegex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }

      for (const c of coaAccounts) {
        const match = c.code.match(codeRegex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }

      const nextNum = maxNum + 1;
      const nextCode = `2001${String(nextNum).padStart(4, '0')}`;

      return {
        status: true,
        data: nextCode,
        message: 'Next sequential code generated successfully',
      };
    } catch (error: any) {
      return {
        status: false,
        data: '20010001',
        message: error.message || 'Failed to generate next code',
      };
    }
  }

  async create(createSupplierDto: CreateSupplierDto) {
    try {
      let { code, chartOfAccountIds, ...data } = createSupplierDto;

      // 1. If code not provided or empty, auto-generate sequential code
      if (!code || !code.trim()) {
        const nextRes = await this.getNextCode();
        code = nextRes.data;
      } else {
        code = code.trim();
      }

      // 2. Validate code uniqueness
      const existing = await this.prisma.supplier.findUnique({
        where: { code },
      });
      if (existing) {
        return {
          status: false,
          message: `Supplier with code "${code}" already exists`,
          data: null,
        };
      }

      // 3. Resolve or Auto-Create Linked Chart of Account
      let finalCoaIds = chartOfAccountIds ? [...chartOfAccountIds] : [];

      if (finalCoaIds.length === 0) {
        // Find parent Payable account (code = '2001')
        let parentPayable = await this.prisma.chartOfAccount.findFirst({
          where: { code: '2001' },
        });

        // Check if an account already exists with this code
        let matchingCoa = await this.prisma.chartOfAccount.findFirst({
          where: { code },
        });

        if (!matchingCoa && parentPayable) {
          matchingCoa = await this.prisma.chartOfAccount.create({
            data: {
              code,
              name: `${data.name} PAYABLE`,
              type: parentPayable.type, // 'LIABILITY'
              parentId: parentPayable.id,
              isGroup: false,
              isActive: true,
            },
          });
        }

        if (matchingCoa) {
          finalCoaIds.push(matchingCoa.id);
        }
      }

      // 4. Create Supplier with connected Chart of Accounts
      const supplier = await this.prisma.supplier.create({
        data: {
          ...data,
          code,
          chartOfAccounts: {
            connect: finalCoaIds.map((id) => ({ id })),
          },
        },
        include: {
          chartOfAccounts: {
            select: { id: true, code: true, name: true },
          },
        },
      });

      return {
        status: true,
        data: supplier,
        message: 'Supplier created successfully',
      };
    } catch (error: any) {
      return { status: false, message: error.message, data: null };
    }
  }

  async findAll() {
    try {
      const suppliers = await this.prisma.supplier.findMany({
        orderBy: { code: 'asc' },
        include: {
          chartOfAccounts: {
            select: { id: true, code: true, name: true },
          },
        },
      });
      return { status: true, data: suppliers };
    } catch (error: any) {
      return { status: false, message: error.message, data: null };
    }
  }

  async findOne(id: string) {
    try {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id },
        include: {
          chartOfAccounts: {
            select: { id: true, code: true, name: true },
          },
        },
      });
      if (!supplier) return { status: false, message: 'Supplier not found' };
      return { status: true, data: supplier };
    } catch (error: any) {
      return { status: false, message: error.message, data: null };
    }
  }

  async update(id: string, updateSupplierDto: UpdateSupplierDto) {
    try {
      const { chartOfAccountIds, ...data } = updateSupplierDto;
      const supplier = await this.prisma.supplier.update({
        where: { id },
        data: {
          ...data,
          chartOfAccounts: chartOfAccountIds
            ? {
                set: chartOfAccountIds.map((accId) => ({ id: accId })),
              }
            : undefined,
        },
        include: {
          chartOfAccounts: {
            select: { id: true, code: true, name: true },
          },
        },
      });
      return {
        status: true,
        data: supplier,
        message: 'Supplier updated successfully',
      };
    } catch (error: any) {
      return { status: false, message: error.message, data: null };
    }
  }

  async remove(id: string) {
    try {
      const supplier = await this.prisma.supplier.delete({
        where: { id },
      });
      return {
        status: true,
        data: supplier,
        message: 'Supplier deleted successfully',
      };
    } catch (error: any) {
      return { status: false, message: error.message, data: null };
    }
  }
}
