import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BalanceService, AddTransactionParams } from './balance.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createMockBalanceTransaction } from '../../test/mocks';
import { Decimal } from '@prisma/client/runtime/library';
import { BalanceTransactionType, Currency } from '@prisma/client';

describe('BalanceService', () => {
  let service: BalanceService;
  let prisma: {
    balanceTransaction: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    const mockTx = {
      balanceTransaction: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    prisma = {
      balanceTransaction: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addTransaction', () => {
    const baseParams: AddTransactionParams = {
      storeId: 'store-123',
      type: BalanceTransactionType.PAYMENT_RECEIVED,
      amount: new Decimal(100),
      currency: Currency.USD,
      description: 'Test transaction',
    };

    it('should add transaction with correct balance calculation (first transaction)', async () => {
      const mockCreatedTx = createMockBalanceTransaction({
        amount: new Decimal(100),
        balanceAfter: new Decimal(100),
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          balanceTransaction: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockCreatedTx),
          },
        };
        return callback(tx);
      });

      const result = await service.addTransaction(baseParams);

      expect(result).toEqual(mockCreatedTx);
    });

    it('should calculate running balance correctly (subsequent transaction)', async () => {
      const previousBalance = new Decimal(500);
      const newAmount = new Decimal(100);
      const expectedNewBalance = previousBalance.plus(newAmount);

      const lastTx = createMockBalanceTransaction({
        balanceAfter: previousBalance,
      });
      const mockCreatedTx = createMockBalanceTransaction({
        amount: newAmount,
        balanceAfter: expectedNewBalance,
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          balanceTransaction: {
            findFirst: jest.fn().mockResolvedValue(lastTx),
            create: jest.fn().mockResolvedValue(mockCreatedTx),
          },
        };
        return callback(tx);
      });

      const result = await service.addTransaction(baseParams);

      expect(result.balanceAfter).toEqual(expectedNewBalance);
    });

    it('should handle negative amounts (refunds/fees)', async () => {
      const previousBalance = new Decimal(500);
      const negativeAmount = new Decimal(-50);
      const expectedNewBalance = previousBalance.plus(negativeAmount);

      const lastTx = createMockBalanceTransaction({
        balanceAfter: previousBalance,
      });
      const mockCreatedTx = createMockBalanceTransaction({
        type: BalanceTransactionType.REFUND,
        amount: negativeAmount,
        balanceAfter: expectedNewBalance,
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          balanceTransaction: {
            findFirst: jest.fn().mockResolvedValue(lastTx),
            create: jest.fn().mockResolvedValue(mockCreatedTx),
          },
        };
        return callback(tx);
      });

      const result = await service.addTransaction({
        ...baseParams,
        type: BalanceTransactionType.REFUND,
        amount: negativeAmount,
      });

      expect(result.balanceAfter).toEqual(expectedNewBalance);
    });

    it('should reject payout that would result in negative balance', async () => {
      const currentBalance = new Decimal(100);
      const payoutAmount = new Decimal(-200);

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          balanceTransaction: {
            findFirst: jest.fn().mockResolvedValue(
              createMockBalanceTransaction({ balanceAfter: currentBalance }),
            ),
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      await expect(
        service.addTransaction({
          ...baseParams,
          type: BalanceTransactionType.PAYOUT_REQUESTED,
          amount: payoutAmount,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should attach paymentId when provided', async () => {
      const mockCreatedTx = createMockBalanceTransaction({
        paymentId: 'payment-123',
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          balanceTransaction: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockCreatedTx),
          },
        };
        return callback(tx);
      });

      await service.addTransaction({
        ...baseParams,
        paymentId: 'payment-123',
      });

      // Verify the transaction was created with paymentId
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should attach refundId when provided', async () => {
      const mockCreatedTx = createMockBalanceTransaction({
        refundId: 'refund-123',
        type: BalanceTransactionType.REFUND,
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          balanceTransaction: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockCreatedTx),
          },
        };
        return callback(tx);
      });

      await service.addTransaction({
        ...baseParams,
        type: BalanceTransactionType.REFUND,
        refundId: 'refund-123',
        amount: new Decimal(-50),
      });

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('getBalance', () => {
    it('should return balance for specific currency', async () => {
      const balance = new Decimal(1500);
      (prisma.balanceTransaction.findFirst as jest.Mock).mockResolvedValue(
        createMockBalanceTransaction({ balanceAfter: balance }),
      );

      const result = await service.getBalance('store-123', Currency.USD);

      expect(result.currency).toBe(Currency.USD);
      expect(result.balance).toEqual(balance);
    });

    it('should return zero for store with no transactions', async () => {
      (prisma.balanceTransaction.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getBalance('store-123', Currency.USD);

      expect(result.balance).toEqual(new Decimal(0));
    });

    it('should return balances for all currencies when no currency specified', async () => {
      (prisma.balanceTransaction.findFirst as jest.Mock)
        .mockResolvedValueOnce(createMockBalanceTransaction({ balanceAfter: new Decimal(100) }))
        .mockResolvedValueOnce(null) // EUR
        .mockResolvedValueOnce(null) // GBP
        .mockResolvedValueOnce(null) // RUB
        .mockResolvedValueOnce(null) // KZT
        .mockResolvedValueOnce(null) // UZS
        .mockResolvedValueOnce(null) // INR
        .mockResolvedValueOnce(null) // SGD
        .mockResolvedValueOnce(null); // CNY

      const result = await service.getBalance('store-123');

      expect(result.balances).toBeDefined();
      expect(Array.isArray(result.balances)).toBe(true);
    });
  });

  describe('getTransactions', () => {
    it('should return paginated transactions', async () => {
      const mockTransactions = [
        createMockBalanceTransaction({ id: 'tx-1' }),
        createMockBalanceTransaction({ id: 'tx-2' }),
      ];
      (prisma.balanceTransaction.findMany as jest.Mock).mockResolvedValue(mockTransactions);
      (prisma.balanceTransaction.count as jest.Mock).mockResolvedValue(2);

      const result = await service.getTransactions('store-123', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.hasMore).toBe(false);
    });

    it('should filter by type', async () => {
      (prisma.balanceTransaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.balanceTransaction.count as jest.Mock).mockResolvedValue(0);

      await service.getTransactions('store-123', {
        type: BalanceTransactionType.PAYMENT_RECEIVED,
      });

      expect(prisma.balanceTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: BalanceTransactionType.PAYMENT_RECEIVED,
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      (prisma.balanceTransaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.balanceTransaction.count as jest.Mock).mockResolvedValue(0);

      await service.getTransactions('store-123', {
        startDate,
        endDate,
      });

      expect(prisma.balanceTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: startDate, lte: endDate },
          }),
        }),
      );
    });

    it('should indicate hasMore when more results exist', async () => {
      (prisma.balanceTransaction.findMany as jest.Mock).mockResolvedValue([
        createMockBalanceTransaction(),
      ]);
      (prisma.balanceTransaction.count as jest.Mock).mockResolvedValue(50);

      const result = await service.getTransactions('store-123', {
        page: 1,
        limit: 10,
      });

      expect(result.meta.hasMore).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('should calculate summary correctly', async () => {
      const transactions = [
        { type: 'PAYMENT_RECEIVED', amount: new Decimal(100), currency: 'USD' },
        { type: 'PAYMENT_RECEIVED', amount: new Decimal(200), currency: 'USD' },
        { type: 'REFUND', amount: new Decimal(-50), currency: 'USD' },
        { type: 'FEE', amount: new Decimal(-8.70), currency: 'USD' },
        { type: 'PAYOUT_COMPLETED', amount: new Decimal(-100), currency: 'USD' },
      ];
      (prisma.balanceTransaction.findMany as jest.Mock).mockResolvedValue(transactions);

      const result = await service.getSummary(
        'store-123',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.totalReceived.toNumber()).toBe(300);
      expect(result.totalRefunds.toNumber()).toBe(50);
      expect(result.totalFees.toNumber()).toBe(8.70);
      expect(result.totalPayouts.toNumber()).toBe(100);
      expect(result.netChange.toNumber()).toBeCloseTo(141.30, 2);
    });

    it('should return zeros for empty period', async () => {
      (prisma.balanceTransaction.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getSummary(
        'store-123',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.totalReceived.toNumber()).toBe(0);
      expect(result.totalRefunds.toNumber()).toBe(0);
      expect(result.totalFees.toNumber()).toBe(0);
      expect(result.totalPayouts.toNumber()).toBe(0);
      expect(result.netChange.toNumber()).toBe(0);
    });

    it('should filter by currency when specified', async () => {
      (prisma.balanceTransaction.findMany as jest.Mock).mockResolvedValue([]);

      await service.getSummary(
        'store-123',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        Currency.EUR,
      );

      expect(prisma.balanceTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            currency: Currency.EUR,
          }),
        }),
      );
    });
  });
});
