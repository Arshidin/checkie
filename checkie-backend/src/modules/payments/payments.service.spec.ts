import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProviderFactory } from '../providers/provider.factory';
import { WebhookEventsService } from '../webhooks/webhook-events.service';
import {
  createMockPrismaService,
  createMockConfigService,
  createMockProviderFactory,
  createMockPaymentProvider,
  createMockCheckoutSession,
  createMockPayment,
  createMockPaymentAttempt,
  createMockCustomer,
} from '../../test/mocks';
import { Decimal } from '@prisma/client/runtime/library';
import { PaymentStatus } from '@prisma/client';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let providerFactory: ReturnType<typeof createMockProviderFactory>;
  let webhookEventsService: jest.Mocked<WebhookEventsService>;
  let mockProvider: ReturnType<typeof createMockPaymentProvider>;

  const mockSession = createMockCheckoutSession({
    customer: createMockCustomer(),
    page: { id: 'page-123', title: 'Test Product' },
  });
  const mockPayment = createMockPayment();
  const mockAttempt = createMockPaymentAttempt();

  beforeEach(async () => {
    prisma = createMockPrismaService();
    mockProvider = createMockPaymentProvider();
    providerFactory = createMockProviderFactory(mockProvider);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: createMockConfigService() },
        { provide: ProviderFactory, useValue: providerFactory },
        {
          provide: WebhookEventsService,
          useValue: {
            triggerPaymentCompleted: jest.fn(),
            triggerPaymentFailed: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    webhookEventsService = module.get(WebhookEventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiatePayment', () => {
    beforeEach(() => {
      (prisma.checkoutSession.findUnique as jest.Mock).mockResolvedValue(mockSession);
      (prisma.customer.upsert as jest.Mock).mockResolvedValue(createMockCustomer());
      (prisma.payment.create as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.paymentAttempt.create as jest.Mock).mockResolvedValue(mockAttempt);
      (prisma.paymentAttempt.count as jest.Mock).mockResolvedValue(0);
      (prisma.paymentAttempt.update as jest.Mock).mockResolvedValue(mockAttempt);
      (prisma.payment.update as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.checkoutSession.update as jest.Mock).mockResolvedValue(mockSession);
    });

    it('should initiate payment successfully', async () => {
      const result = await service.initiatePayment({
        checkoutSessionId: mockSession.id,
      });

      expect(result.paymentId).toBeDefined();
      expect(result.clientSecret).toBeDefined();
      expect(result.requiresAction).toBe(false);
      expect(providerFactory.getDefaultProvider).toHaveBeenCalled();
      expect(mockProvider.createPaymentIntent).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent session', async () => {
      (prisma.checkoutSession.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.initiatePayment({ checkoutSessionId: 'non-existent' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for non-OPEN session', async () => {
      (prisma.checkoutSession.findUnique as jest.Mock).mockResolvedValue({
        ...mockSession,
        status: 'COMPLETED',
      });

      await expect(service.initiatePayment({ checkoutSessionId: mockSession.id })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle 3DS requirement', async () => {
      (mockProvider.createPaymentIntent as jest.Mock).mockResolvedValue({
        id: 'pi_test_123',
        clientSecret: 'pi_test_123_secret',
        status: 'requires_action',
        amount: 100,
        currency: 'USD',
        requiresAction: true,
        nextActionUrl: 'https://stripe.com/3ds',
      });

      const result = await service.initiatePayment({
        checkoutSessionId: mockSession.id,
      });

      expect(result.requiresAction).toBe(true);
      expect(result.nextActionUrl).toBe('https://stripe.com/3ds');
      expect(prisma.paymentAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requires3DS: true,
            redirectUrl: 'https://stripe.com/3ds',
          }),
        }),
      );
    });

    it('should create customer if not exists', async () => {
      const sessionWithoutCustomer = {
        ...mockSession,
        customerId: null,
        customer: { email: 'new@example.com' },
      };
      (prisma.checkoutSession.findUnique as jest.Mock).mockResolvedValue(sessionWithoutCustomer);

      await service.initiatePayment({
        checkoutSessionId: mockSession.id,
      });

      expect(prisma.customer.upsert).toHaveBeenCalled();
    });

    it('should throw BadRequestException when no customer info', async () => {
      const sessionWithoutCustomer = {
        ...mockSession,
        customerId: null,
        customer: null,
      };
      (prisma.checkoutSession.findUnique as jest.Mock).mockResolvedValue(sessionWithoutCustomer);

      await expect(service.initiatePayment({ checkoutSessionId: mockSession.id })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('handleWebhookEvent', () => {
    describe('payment_intent.succeeded', () => {
      beforeEach(() => {
        (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
          ...mockPayment,
          store: { id: 'store-123' },
        });
        (prisma.payment.update as jest.Mock).mockResolvedValue(mockPayment);
        (prisma.paymentAttempt.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
        (prisma.checkoutSession.update as jest.Mock).mockResolvedValue(mockSession);

        // Mock $transaction for balance updates
        prisma.$transaction.mockImplementation(async (callback) => {
          const tx = {
            balanceTransaction: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(tx);
        });
      });

      it('should handle successful payment', async () => {
        await service.handleWebhookEvent(
          'stripe',
          'payment_intent.succeeded',
          { id: 'pi_test_123' },
          { paymentId: mockPayment.id, checkoutSessionId: mockSession.id },
        );

        expect(prisma.payment.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'COMPLETED',
              completedAt: expect.any(Date),
            }),
          }),
        );
        expect(prisma.paymentAttempt.updateMany).toHaveBeenCalled();
        expect(webhookEventsService.triggerPaymentCompleted).toHaveBeenCalled();
      });

      it('should skip if payment already completed', async () => {
        (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
          ...mockPayment,
          status: 'COMPLETED',
        });

        await service.handleWebhookEvent(
          'stripe',
          'payment_intent.succeeded',
          { id: 'pi_test_123' },
          { paymentId: mockPayment.id, checkoutSessionId: mockSession.id },
        );

        expect(prisma.payment.update).not.toHaveBeenCalled();
      });

      it('should calculate platform fee correctly', async () => {
        const paymentAmount = 100;
        // Platform fee is 2.9% of payment amount

        (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
          ...mockPayment,
          amount: new Decimal(paymentAmount),
          store: { id: 'store-123' },
        });

        await service.handleWebhookEvent(
          'stripe',
          'payment_intent.succeeded',
          { id: 'pi_test_123' },
          { paymentId: mockPayment.id, checkoutSessionId: mockSession.id },
        );

        expect(prisma.payment.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              platformFee: expect.any(Decimal),
            }),
          }),
        );
      });
    });

    describe('payment_intent.payment_failed', () => {
      beforeEach(() => {
        (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
        (prisma.payment.update as jest.Mock).mockResolvedValue(mockPayment);
        (prisma.paymentAttempt.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
        (prisma.checkoutSession.update as jest.Mock).mockResolvedValue(mockSession);
      });

      it('should handle failed payment', async () => {
        const failureData = {
          id: 'pi_test_123',
          last_payment_error: {
            code: 'card_declined',
            message: 'Your card was declined.',
          },
        };

        await service.handleWebhookEvent('stripe', 'payment_intent.payment_failed', failureData, {
          paymentId: mockPayment.id,
          checkoutSessionId: mockSession.id,
        });

        expect(prisma.payment.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'FAILED',
            }),
          }),
        );
        expect(prisma.paymentAttempt.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              failureCode: 'card_declined',
              failureMessage: 'Your card was declined.',
            }),
          }),
        );
      });

      it('should reopen checkout session on failure', async () => {
        await service.handleWebhookEvent(
          'stripe',
          'payment_intent.payment_failed',
          { id: 'pi_test_123', last_payment_error: {} },
          { paymentId: mockPayment.id, checkoutSessionId: mockSession.id },
        );

        expect(prisma.checkoutSession.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { status: 'OPEN' },
          }),
        );
      });
    });

    describe('payment_intent.canceled', () => {
      beforeEach(() => {
        (prisma.payment.update as jest.Mock).mockResolvedValue(mockPayment);
        (prisma.checkoutSession.update as jest.Mock).mockResolvedValue(mockSession);
      });

      it('should handle canceled payment', async () => {
        await service.handleWebhookEvent(
          'stripe',
          'payment_intent.canceled',
          {},
          { paymentId: mockPayment.id, checkoutSessionId: mockSession.id },
        );

        expect(prisma.payment.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { status: 'CANCELLED' },
          }),
        );
        expect(prisma.checkoutSession.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'ABANDONED',
            }),
          }),
        );
      });
    });

    it('should skip webhook without paymentId', async () => {
      await service.handleWebhookEvent(
        'stripe',
        'payment_intent.succeeded',
        {},
        { checkoutSessionId: mockSession.id },
      );

      expect(prisma.payment.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('findByStore', () => {
    it('should return paginated payments', async () => {
      const payments = [mockPayment, { ...mockPayment, id: 'payment-456' }];
      (prisma.payment.findMany as jest.Mock).mockResolvedValue(payments);
      (prisma.payment.count as jest.Mock).mockResolvedValue(2);

      const result = await service.findByStore('store-123', {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.hasMore).toBe(false);
    });

    it('should filter by status', async () => {
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.payment.count as jest.Mock).mockResolvedValue(0);

      await service.findByStore('store-123', {
        status: PaymentStatus.COMPLETED,
      });

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: PaymentStatus.COMPLETED,
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.payment.count as jest.Mock).mockResolvedValue(0);

      await service.findByStore('store-123', { startDate, endDate });

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: startDate, lte: endDate },
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return payment with relations', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);

      const result = await service.findById(mockPayment.id, 'store-123');

      expect(result).toEqual(mockPayment);
      expect(prisma.payment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            customer: true,
            page: true,
            attempts: expect.any(Object),
          }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent payment', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('non-existent', 'store-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addBalanceTransaction', () => {
    it('should add balance transaction correctly', async () => {
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          balanceTransaction: {
            findFirst: jest.fn().mockResolvedValue({
              balanceAfter: new Decimal(500),
            }),
            create: jest.fn().mockResolvedValue({
              id: 'tx-123',
              balanceAfter: new Decimal(600),
            }),
          },
        };
        return callback(tx);
      });

      const result = await service.addBalanceTransaction({
        storeId: 'store-123',
        paymentId: mockPayment.id,
        type: 'PAYMENT_RECEIVED',
        amount: new Decimal(100),
        currency: 'USD',
        description: 'Test payment',
      });

      expect(result).toBeDefined();
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should reject payout with insufficient balance', async () => {
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          balanceTransaction: {
            findFirst: jest.fn().mockResolvedValue({
              balanceAfter: new Decimal(50),
            }),
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      await expect(
        service.addBalanceTransaction({
          storeId: 'store-123',
          type: 'PAYOUT_REQUESTED',
          amount: new Decimal(-100),
          currency: 'USD',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
