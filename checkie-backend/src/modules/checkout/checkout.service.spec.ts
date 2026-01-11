import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CheckoutSessionService } from './services/checkout-session.service';
import { IdempotencyService } from './services/idempotency.service';
import { ProviderFactory } from '../providers/provider.factory';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  createMockPrismaService,
  createMockConfigService,
  createMockProviderFactory,
  createMockPage,
  createMockCheckoutSession,
  createMockCustomer,
  createMockPayment,
} from '../../test/mocks';
import { Decimal } from '@prisma/client/runtime/library';
import { PricingType } from '@prisma/client';

describe('CheckoutService', () => {
  let service: CheckoutService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let sessionService: jest.Mocked<CheckoutSessionService>;
  let idempotencyService: jest.Mocked<IdempotencyService>;
  let providerFactory: ReturnType<typeof createMockProviderFactory>;
  let subscriptionsService: jest.Mocked<SubscriptionsService>;

  const mockPage = createMockPage();
  const mockSession = createMockCheckoutSession();
  const mockCustomer = createMockCustomer();
  const mockPayment = createMockPayment();

  beforeEach(async () => {
    prisma = createMockPrismaService();
    providerFactory = createMockProviderFactory();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: createMockConfigService() },
        {
          provide: CheckoutSessionService,
          useValue: {
            createSession: jest.fn().mockResolvedValue(mockSession),
            getSession: jest.fn().mockResolvedValue(mockSession),
            getSessionState: jest.fn().mockResolvedValue({
              state: 'open',
              context: {
                sessionId: mockSession.id,
                customerEmail: 'test@example.com',
                amount: 99.99,
                currency: 'USD',
                attempts: [],
                error: null,
              },
            }),
            updateSession: jest.fn().mockResolvedValue(mockSession),
            sendEvent: jest.fn().mockResolvedValue({
              state: 'processing',
              context: { attempts: [], error: null },
            }),
            handleWebhookEvent: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: IdempotencyService,
          useValue: {
            checkOrCreate: jest.fn().mockResolvedValue({ isNew: true }),
            setResponse: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: ProviderFactory, useValue: providerFactory },
        {
          provide: SubscriptionsService,
          useValue: {
            createSubscription: jest.fn().mockResolvedValue({
              id: 'subscription-123',
              status: 'ACTIVE',
              providerSubscriptionId: 'sub_test_123',
              providerData: { clientSecret: 'secret' },
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CheckoutService>(CheckoutService);
    sessionService = module.get(CheckoutSessionService);
    idempotencyService = module.get(IdempotencyService);
    subscriptionsService = module.get(SubscriptionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a checkout session successfully', async () => {
      (prisma.page.findUnique as jest.Mock).mockResolvedValue(mockPage);

      const result = await service.createSession({
        pageId: mockPage.id,
        customerEmail: 'test@example.com',
      });

      expect(sessionService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          pageId: mockPage.id,
          customerEmail: 'test@example.com',
        }),
      );
      expect(result).toBeDefined();
      expect(result.id).toBe(mockSession.id);
    });

    it('should apply coupon if provided', async () => {
      const mockCoupon = { id: 'coupon-123', code: 'SAVE10', isActive: true };
      (prisma.page.findUnique as jest.Mock).mockResolvedValue(mockPage);
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon);

      await service.createSession({
        pageId: mockPage.id,
        customerEmail: 'test@example.com',
        couponCode: 'SAVE10',
      });

      expect(prisma.coupon.findUnique).toHaveBeenCalledWith({
        where: {
          storeId_code: {
            storeId: mockPage.storeId,
            code: 'SAVE10',
          },
        },
      });
      expect(sessionService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          couponId: mockCoupon.id,
        }),
      );
    });
  });

  describe('getSession', () => {
    it('should return session with state', async () => {
      const result = await service.getSession(mockSession.id);

      expect(sessionService.getSession).toHaveBeenCalledWith(mockSession.id);
      expect(result.id).toBe(mockSession.id);
      expect(result.status).toBeDefined();
    });
  });

  describe('updateSession', () => {
    it('should update session data', async () => {
      const updateData = {
        customerEmail: 'new@example.com',
        amount: 149.99,
      };

      const result = await service.updateSession(mockSession.id, updateData);

      expect(sessionService.updateSession).toHaveBeenCalledWith(
        mockSession.id,
        expect.objectContaining({
          customerEmail: updateData.customerEmail,
          amount: updateData.amount,
        }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('initiatePayment', () => {
    beforeEach(() => {
      (prisma.page.findUnique as jest.Mock).mockResolvedValue(mockPage);
      (prisma.customer.upsert as jest.Mock).mockResolvedValue(mockCustomer);
      (prisma.payment.create as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.paymentAttempt.create as jest.Mock).mockResolvedValue({
        id: 'attempt-123',
        attemptNumber: 1,
      });
      (prisma.checkoutSession.update as jest.Mock).mockResolvedValue(mockSession);
      (prisma.paymentAttempt.update as jest.Mock).mockResolvedValue({});
      (prisma.payment.update as jest.Mock).mockResolvedValue(mockPayment);
    });

    it('should initiate payment successfully for one-time payment', async () => {
      const result = await service.initiatePayment({
        sessionId: mockSession.id,
      });

      expect(sessionService.sendEvent).toHaveBeenCalledWith(
        mockSession.id,
        expect.objectContaining({ type: 'INITIATE_PAYMENT' }),
      );
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(result.status).toBeDefined();
      expect(result.clientSecret).toBeDefined();
    });

    it('should check idempotency key and return cached response', async () => {
      const cachedResponse = {
        sessionId: mockSession.id,
        status: 'PROCESSING',
        paymentId: 'payment-123',
        requiresAction: false,
      };
      (idempotencyService.checkOrCreate as jest.Mock).mockResolvedValue({
        isNew: false,
        existingResponse: { body: cachedResponse },
      });

      const result = await service.initiatePayment({
        sessionId: mockSession.id,
        idempotencyKey: 'idempotency-123',
      });

      expect(result).toEqual(cachedResponse);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('should throw error if session is not in OPEN state', async () => {
      (sessionService.getSessionState as jest.Mock).mockResolvedValue({
        state: 'completed',
        context: { attempts: [], error: null },
      });
      (sessionService.sendEvent as jest.Mock).mockResolvedValue({
        state: 'open',
        context: { error: 'Cannot initiate payment in completed state' },
      });

      await expect(service.initiatePayment({ sessionId: mockSession.id })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle subscription page type', async () => {
      const subscriptionPage = {
        ...mockPage,
        pricingType: PricingType.SUBSCRIPTION,
        subscriptionInterval: 'MONTH',
        subscriptionIntervalCount: 1,
        trialDays: 7,
      };
      (prisma.page.findUnique as jest.Mock).mockResolvedValue(subscriptionPage);
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({
        ...mockCustomer,
        providerCustomerId: 'cus_test_123',
      });

      const result = await service.initiatePayment({
        sessionId: mockSession.id,
      });

      expect(subscriptionsService.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          interval: 'MONTH',
          intervalCount: 1,
          trialPeriodDays: 7,
        }),
      );
      expect(result.subscriptionId).toBeDefined();
    });

    it('should calculate platform fee correctly', async () => {
      await service.initiatePayment({
        sessionId: mockSession.id,
      });

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            platformFee: expect.any(Decimal),
            netAmount: expect.any(Decimal),
          }),
        }),
      );
    });
  });

  describe('getSessionStatus', () => {
    it('should return session status', async () => {
      const result = await service.getSessionStatus(mockSession.id);

      expect(result.sessionId).toBe(mockSession.id);
      expect(result.status).toBeDefined();
    });
  });

  describe('abandonSession', () => {
    it('should send abandon event', async () => {
      await service.abandonSession(mockSession.id, 'User closed browser');

      expect(sessionService.sendEvent).toHaveBeenCalledWith(mockSession.id, {
        type: 'ABANDON',
        reason: 'User closed browser',
      });
    });
  });

  describe('handleWebhook', () => {
    it('should delegate to session service', async () => {
      await service.handleWebhook('stripe', 'payment_intent.succeeded', {});

      expect(sessionService.handleWebhookEvent).toHaveBeenCalledWith(
        'stripe',
        'payment_intent.succeeded',
        {},
      );
    });
  });
});
