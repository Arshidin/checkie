import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BalanceService } from '../balance/balance.service';
import { ProviderFactory } from '../providers/provider.factory';
import { WebhookEventsService } from '../webhooks/webhook-events.service';
import {
  createMockPrismaService,
  createMockProviderFactory,
  createMockPaymentProvider,
  createMockPayment,
  createMockRefund,
} from '../../test/mocks';
import { Decimal } from '@prisma/client/runtime/library';
import { RefundReason, Currency } from '@prisma/client';

describe('RefundsService', () => {
  let service: RefundsService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let balanceService: jest.Mocked<BalanceService>;
  let providerFactory: ReturnType<typeof createMockProviderFactory>;
  let webhookEventsService: jest.Mocked<WebhookEventsService>;
  let mockProvider: ReturnType<typeof createMockPaymentProvider>;

  const mockPayment = createMockPayment({
    status: 'COMPLETED',
    providerPaymentId: 'pi_test_123',
  });
  const mockRefund = createMockRefund();

  beforeEach(async () => {
    prisma = createMockPrismaService();
    mockProvider = createMockPaymentProvider();
    providerFactory = createMockProviderFactory(mockProvider);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProviderFactory, useValue: providerFactory },
        {
          provide: BalanceService,
          useValue: {
            addTransaction: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: WebhookEventsService,
          useValue: {
            triggerRefundEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RefundsService>(RefundsService);
    balanceService = module.get(BalanceService);
    webhookEventsService = module.get(WebhookEventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRefund', () => {
    beforeEach(() => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        ...mockPayment,
        refunds: [],
      });
      (prisma.refund.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: null },
      });
      (prisma.refund.create as jest.Mock).mockResolvedValue(mockRefund);
      (prisma.payment.update as jest.Mock).mockResolvedValue(mockPayment);
    });

    it('should create full refund successfully', async () => {
      const result = await service.createRefund({
        paymentId: mockPayment.id,
        storeId: 'store-123',
        reason: RefundReason.REQUESTED_BY_CUSTOMER,
      });

      expect(mockProvider.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentIntentId: mockPayment.providerPaymentId,
        }),
      );
      expect(prisma.refund.create).toHaveBeenCalled();
      expect(balanceService.addTransaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should create partial refund', async () => {
      await service.createRefund({
        paymentId: mockPayment.id,
        storeId: 'store-123',
        amount: 50,
        reason: RefundReason.REQUESTED_BY_CUSTOMER,
      });

      expect(mockProvider.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50,
        }),
      );
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PARTIALLY_REFUNDED',
          }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent payment', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createRefund({
          paymentId: 'non-existent',
          storeId: 'store-123',
          reason: RefundReason.REQUESTED_BY_CUSTOMER,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for non-completed payment', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        ...mockPayment,
        status: 'PENDING',
      });

      await expect(
        service.createRefund({
          paymentId: mockPayment.id,
          storeId: 'store-123',
          reason: RefundReason.REQUESTED_BY_CUSTOMER,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if refund exceeds payment amount', async () => {
      (prisma.refund.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: new Decimal(80) },
      });

      await expect(
        service.createRefund({
          paymentId: mockPayment.id,
          storeId: 'store-123',
          amount: 50,
          reason: RefundReason.REQUESTED_BY_CUSTOMER,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark payment as fully refunded', async () => {
      const paymentAmount = Number(mockPayment.amount);
      (prisma.refund.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: new Decimal(0) },
      });
      (prisma.refund.create as jest.Mock).mockResolvedValue({
        ...mockRefund,
        amount: new Decimal(paymentAmount),
      });

      await service.createRefund({
        paymentId: mockPayment.id,
        storeId: 'store-123',
        amount: paymentAmount,
        reason: RefundReason.REQUESTED_BY_CUSTOMER,
      });

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REFUNDED',
          }),
        }),
      );
    });

    it('should deduct from balance', async () => {
      await service.createRefund({
        paymentId: mockPayment.id,
        storeId: 'store-123',
        amount: 50,
        reason: RefundReason.REQUESTED_BY_CUSTOMER,
      });

      expect(balanceService.addTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'REFUND',
          amount: expect.any(Decimal),
        }),
      );
    });

    it('should trigger webhook on refund', async () => {
      await service.createRefund({
        paymentId: mockPayment.id,
        storeId: 'store-123',
        reason: RefundReason.REQUESTED_BY_CUSTOMER,
      });

      expect(webhookEventsService.triggerRefundEvent).toHaveBeenCalled();
    });

    it('should throw on provider failure', async () => {
      (mockProvider.createRefund as jest.Mock).mockRejectedValue(new Error('Provider error'));

      await expect(
        service.createRefund({
          paymentId: mockPayment.id,
          storeId: 'store-123',
          reason: RefundReason.REQUESTED_BY_CUSTOMER,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTotalRefunded', () => {
    it('should return total refunded amount', async () => {
      (prisma.refund.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: new Decimal(75) },
      });

      const result = await service.getTotalRefunded(mockPayment.id);

      expect(result).toBe(75);
    });

    it('should return 0 for no refunds', async () => {
      (prisma.refund.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: null },
      });

      const result = await service.getTotalRefunded(mockPayment.id);

      expect(result).toBe(0);
    });
  });

  describe('findByStore', () => {
    it('should return paginated refunds', async () => {
      const refunds = [mockRefund, { ...mockRefund, id: 'refund-456' }];
      (prisma.refund.findMany as jest.Mock).mockResolvedValue(refunds);
      (prisma.refund.count as jest.Mock).mockResolvedValue(2);

      const result = await service.findByStore('store-123', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should filter by reason', async () => {
      (prisma.refund.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.refund.count as jest.Mock).mockResolvedValue(0);

      await service.findByStore('store-123', {
        reason: RefundReason.FRAUDULENT,
      });

      expect(prisma.refund.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reason: RefundReason.FRAUDULENT,
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return refund with relations', async () => {
      (prisma.refund.findFirst as jest.Mock).mockResolvedValue(mockRefund);

      const result = await service.findById(mockRefund.id, 'store-123');

      expect(result).toEqual(mockRefund);
    });

    it('should throw NotFoundException for non-existent refund', async () => {
      (prisma.refund.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findById('non-existent', 'store-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByPayment', () => {
    it('should return refunds for payment', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.refund.findMany as jest.Mock).mockResolvedValue([mockRefund]);

      const result = await service.findByPayment(mockPayment.id, 'store-123');

      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundException for non-existent payment', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findByPayment('non-existent', 'store-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
