import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOpeningBalanceDto } from './dto/create-opening-balance.dto';
import { AccountingService } from '../accounting/accounting.service';

@Injectable()
export class OpeningBalanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService,
  ) {}

  async createOpeningBalance(dto: CreateOpeningBalanceDto) {
    const { accountId, type, amount, date } = dto;

    return await this.prisma.$transaction(async (tx) => {
      // Validate account exists
      const account = await tx.chartOfAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new BadRequestException('Account not found');
      }

      if (account.isGroup) {
        throw new BadRequestException('Cannot set opening balance for group accounts');
      }

      const isNormalDebit = account.type === 'ASSET' || account.type === 'EXPENSE';

      // Find any existing opening balance transaction(s) for this account
      const existingTxs = await tx.accountTransaction.findMany({
        where: {
          accountId,
          sourceType: 'OPENING_BALANCE',
        },
      });

      // Revert existing opening balance transaction effects
      for (const existingTx of existingTxs) {
        const oldDelta = isNormalDebit
          ? Number(existingTx.debit) - Number(existingTx.credit)
          : Number(existingTx.credit) - Number(existingTx.debit);

        if (oldDelta !== 0) {
          await tx.chartOfAccount.update({
            where: { id: accountId },
            data: { balance: { decrement: oldDelta } },
          });
        }

        await tx.accountTransaction.delete({
          where: { id: existingTx.id },
        });
      }

      // If amount > 0, post the new opening balance
      if (amount > 0) {
        const transactionDate = date ? new Date(date) : new Date();
        const debit = type === 'DEBIT' ? amount : 0;
        const credit = type === 'CREDIT' ? amount : 0;

        await this.accountingService.postLines(
          [
            {
              accountId,
              debit,
              credit,
            },
          ],
          {
            sourceType: 'OPENING_BALANCE',
            sourceId: accountId,
            sourceRef: `Opening Balance - ${account.code}`,
            description: `Opening Balance for ${account.name}`,
            transactionDate,
          },
          tx,
        );
      }

      return {
        status: true,
        message: amount > 0 ? 'Opening balance saved successfully' : 'Opening balance reset to 0',
      };
    });
  }

  async getOpeningBalances() {
    const transactions = await this.prisma.accountTransaction.findMany({
      where: {
        sourceType: 'OPENING_BALANCE',
      },
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        transactionDate: 'desc',
      },
    });

    return {
      status: true,
      data: transactions,
    };
  }
}
