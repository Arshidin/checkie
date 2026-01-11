import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionsService, CreateSubscriptionParams } from './subscriptions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProviderFactory } from '../providers/provider.factory';
import { BalanceService } from '../balance/balance.service';
import { WebhookEventsService } from '../webhooks/webhook-events.service';
import {
  createMockPrismaService,
  createMockConfigService,
  createMockProviderFactory,
  createMockPaymentProvider,
  createMockSubscription,
} from '../../test/mocks';
import { Decimal } from '@prisma/client/runtime/library';
import { SubscriptionInterval, SubscriptionStatus, Currency } from '@prisma/client';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let providerFactory: ReturnType<typeof createMockProviderFactory>;
  let balanceService: jest.Mocked<BalanceService>;
  let webhookEventsService: jest.Mocked<WebhookEventsService>;
  let mockProvider: ReturnType<typeof createMockPaymentProvider>;

  const mockSubscription = createMockSubscription();

  beforeEach(async () => {
    prisma = createMockPrismaService();
    mockProvider = createMockPaymentProvider();
    providerFactory = createMockProviderFactory(mockProvider);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: createMockConfigService() },
        { provide: ProviderFactory, useValue: providerFactory },
        {
          provide: BalanceService,
          useValue: {
            addTransaction: jest.fn().mockResolvedValue({}),
            getBalance: jest.fn().mockResolvedValue({ balance: new Decimal(1000) }),
          },
        },
        {
          provide: WebhookEventsService,
          useValue: {
            triggerSubscriptionEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    balanceService = module.get(BalanceService);
    webhookEventsService = module.get(WebhookEventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSubscription', () => {
    const createParams: CreateSubscriptionParams = {
      storeId: 'store-123',
      pageId: 'page-123',
      customerId: 'customer-123',
      customerEmail: 'customer@example.com',
      providerCustomerId: 'cus_stripe_123',
      amount: 29.99,
      currency: Currency.USD,
      interval: SubscriptionInterval.MONTHLY,
      intervalCount: 1,
    };

    it('should create subscription successfully', async () => {
      (prisma.subscription.create as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'INCOMPLETE',
      });
      (prisma.subscription.update as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await service.createSubscription(createParams);

      expect(prisma.subscription.create).toHaveBeenCalled();
      expect(mockProvider.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: createParams.providerCustomerId,
          amount: createParams.amount,
        }),
      );
      expect(result.status).toBeDefined();
    });

    it('should create subscription with trial period', async () => {
      const paramsWithTrial = { ...createParams, trialPeriodDays: 14 };
      (prisma.subscription.create as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'INCOMPLETE',
      });
      (prisma.subscription.update as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'TRIALING',
      });

      await service.createSubscription(paramsWithTrial);

      expect(mockProvider.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          trialPeriodDays: 14,
        }),
      );
    });

    it('should cleanup subscription on provider failure', async () => {
      (prisma.subscription.create as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        id: 'sub-to-delete',
      });
      (mockProvider.createSubscription as jest.Mock).mockRejectedValue(new Error('Provider error'));

      await expect(service.createSubscription(createParams)).rejects.toThrow();

      expect(prisma.subscription.delete).toHaveBeenCalledWith({
        where: { id: 'sub-to-delete' },
      });
    });
  });

  describe('findByStore', () => {
    it('should return paginated subscriptions', async () => {
      const subscriptions = [mockSubscription, { ...mockSubscription, id: 'sub-456' }];
      (prisma.subscription.findMany as jest.Mock).mockResolvedValue(subscriptions);
      (prisma.subscription.count as jest.Mock).mockResolvedValue(2);

      const result = await service.findByStore('store-123', {});

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should filter by status', async () => {
      (prisma.subscription.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.subscription.count as jest.Mock).mockResolvedValue(0);

      await service.findByStore('store-123', { status: SubscriptionStatus.ACTIVE });

      expect(prisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: SubscriptionStatus.ACTIVE,
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return subscription with relations', async () => {
      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await service.findById(mockSubscription.id, 'store-123');

      expect(result).toEqual(mockSubscription);
    });

    it('should throw NotFoundException for non-existent subscription', async () => {
      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('non-existent', 'store-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancelSubscription', () => {
    beforeEach(() => {
      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.subscription.update as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'CANCELLED',
        cancelledAt: new Date(),
      });
    });

    it('should cancel subscription immediately', async () => {
      await service.cancelSubscription(
        mockSubscription.id,
        'store-123',
        true,
        'Customer requested',
      );

      expect(mockProvider.cancelSubscription).toHaveBeenCalledWith(
        mockSubscription.providerSubscriptionId,
        true,
      );
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cancelledAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should cancel subscription at period end', async () => {
      (prisma.subscription.update as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: true,
      });

      await service.cancelSubscription(mockSubscription.id, 'store-123', false);

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cancelAtPeriodEnd: true,
            cancelledAt: null,
          }),
        }),
      );
    });

    it('should throw error for already cancelled subscription', async () => {
      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'CANCELLED',
      });

      await expect(service.cancelSubscription(mockSubscription.id, 'store-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should trigger webhook on cancellation', async () => {
      await service.cancelSubscription(mockSubscription.id, 'store-123', true);

      expect(webhookEventsService.triggerSubscriptionEvent).toHaveBeenCalled();
    });
  });

  describe('pauseSubscription', () => {
    it('should pause active subscription', async () => {
      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.subscription.update as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'PAUSED',
      });

      const result = await service.pauseSubscription(mockSubscription.id, 'store-123');

      expect(mockProvider.pauseSubscription).toHaveBeenCalled();
      expect(result.status).toBe('PAUSED');
    });

    it('should throw error for non-active subscription', async () => {
      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'PAUSED',
      });

      await expect(service.pauseSubscription(mockSubscription.id, 'store-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('resumeSubscription', () => {
    it('should resume paused subscription', async () => {
      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'PAUSED',
      });
      (prisma.subscription.update as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'ACTIVE',
      });
      (mockProvider.resumeSubscription as jest.Mock).mockResolvedValue({
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      });

      const result = await service.resumeSubscription(mockSubscription.id, 'store-123');

      expect(mockProvider.resumeSubscription).toHaveBeenCalled();
      expect(result.status).toBe('ACTIVE');
    });

    it('should throw error for non-paused subscription', async () => {
      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue(mockSubscription);

      await expect(service.resumeSubscription(mockSubscription.id, 'store-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('handleInvoicePaymentSucceeded', () => {
    it('should process successful invoice payment', async () => {
      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        store: { id: 'store-123' },
      });
      (prisma.subscription.update as jest.Mock).mockResolvedValue(mockSubscription);

      await service.handleInvoicePaymentSucceeded('inv_123', {
        subscription: mockSubscription.providerSubscriptionId,
        amount_paid: 2999,
        period_start: Math.floor(Date.now() / 1000),
        period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      });

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACTIVE',
          }),
        }),
      );
      expect(balanceService.addTransaction).toHaveBeenCalledTimes(2);
    });

    it('should skip non-subscription invoices', async () => {
      await service.handleInvoicePaymentSucceeded('inv_123', {
        subscription: null,
      });

      expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('handleInvoicePaymentFailed', () => {
    it('should mark subscription as PAST_DUE', async () => {
      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.subscription.update as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'PAST_DUE',
      });

      await service.handleInvoicePaymentFailed('inv_123', {
        subscription: mockSubscription.providerSubscriptionId,
      });

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PAST_DUE',
          }),
        }),
      );
    });
  });
});
