import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BalanceTransactionType, Currency, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface AddTransactionParams {
  storeId: string;
  paymentId?: string;
  refundId?: string;
  payoutId?: string;
  type: BalanceTransactionType;
  amount: Decimal | number;
  currency: Currency;
  description?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async addTransaction(params: AddTransactionParams) {
    return this.prisma.$transaction(async (tx) => {
      const lastTx = await tx.balanceTransaction.findFirst({
        where: { storeId: params.storeId, currency: params.currency },
        orderBy: { createdAt: 'desc' },
      });

      const currentBalance = lastTx?.balanceAfter ?? new Decimal(0);
      const amount = new Decimal(params.amount);
      const balanceAfter = currentBalance.plus(amount);

      if (params.type === 'PAYOUT_REQUESTED' && balanceAfter.lessThan(0)) {
        throw new BadRequestException('Insufficient balance for payout');
      }

      const transaction = await tx.balanceTransaction.create({
        data: {
          storeId: params.storeId,
          paymentId: params.paymentId,
          refundId: params.refundId,
          payoutId: params.payoutId,
          type: params.type,
          amount,
          currency: params.currency,
          balanceAfter,
          description: params.description,
          metadata: params.metadata,
        },
      });

      this.logger.log(
        `Balance transaction: ${params.type} ${amount} ${params.currency}, new balance: ${balanceAfter}`,
      );

      return transaction;
    });
  }

  async getBalance(storeId: string, currency?: Currency) {
    if (currency) {
      const lastTx = await this.prisma.balanceTransaction.findFirst({
        where: { storeId, currency },
        orderBy: { createdAt: 'desc' },
        select: { balanceAfter: true, currency: true },
      });

      return {
        currency,
        balance: lastTx?.balanceAfter ?? new Decimal(0),
      };
    }

    // Get balances for all currencies
    const currencies: Currency[] = ['USD', 'EUR', 'GBP', 'RUB', 'KZT', 'UZS', 'INR', 'SGD', 'CNY'];
    const balances: { currency: Currency; balance: Decimal }[] = [];

    for (const curr of currencies) {
      const lastTx = await this.prisma.balanceTransaction.findFirst({
        where: { storeId, currency: curr },
        orderBy: { createdAt: 'desc' },
        select: { balanceAfter: true },
      });

      if (lastTx) {
        balances.push({
          currency: curr,
          balance: lastTx.balanceAfter,
        });
      }
    }

    return { balances };
  }

  async getTransactions(
    storeId: string,
    filters?: {
      type?: BalanceTransactionType;
      currency?: Currency;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    },
  ) {
    const where: Prisma.BalanceTransactionWhereInput = {
      storeId,
      ...(filters?.type && { type: filters.type }),
      ...(filters?.currency && { currency: filters.currency }),
      ...((filters?.startDate || filters?.endDate) && {
        createdAt: {
          ...(filters?.startDate && { gte: filters.startDate }),
          ...(filters?.endDate && { lte: filters.endDate }),
        },
      }),
    };

    const page = filters?.page || 1;
    const limit = filters?.limit || 50;

    const [transactions, total] = await Promise.all([
      this.prisma.balanceTransaction.findMany({
        where,
        include: { payment: true, refund: true, payout: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.balanceTransaction.count({ where }),
    ]);

    return {
      data: transactions,
      meta: { total, page, limit, hasMore: total > page * limit },
    };
  }

  async getSummary(
    storeId: string,
    startDate: Date,
    endDate: Date,
    currency?: Currency,
  ) {
    const where: Prisma.BalanceTransactionWhereInput = {
      storeId,
      createdAt: { gte: startDate, lte: endDate },
      ...(currency && { currency }),
    };

    const transactions = await this.prisma.balanceTransaction.findMany({
      where,
      select: { type: true, amount: true, currency: true },
    });

    const summary = {
      totalReceived: new Decimal(0),
      totalRefunds: new Decimal(0),
      totalFees: new Decimal(0),
      totalPayouts: new Decimal(0),
      netChange: new Decimal(0),
    };

    for (const tx of transactions) {
      const amount = new Decimal(tx.amount);
      switch (tx.type) {
        case 'PAYMENT_RECEIVED':
          summary.totalReceived = summary.totalReceived.plus(amount);
          break;
        case 'REFUND':
          summary.totalRefunds = summary.totalRefunds.plus(amount.abs());
          break;
        case 'FEE':
          summary.totalFees = summary.totalFees.plus(amount.abs());
          break;
        case 'PAYOUT_COMPLETED':
          summary.totalPayouts = summary.totalPayouts.plus(amount.abs());
          break;
      }
      summary.netChange = summary.netChange.plus(amount);
    }

    return summary;
  }
}
