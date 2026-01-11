import { Test, TestingModule } from '@nestjs/testing';
import { WebhookEventsService, CreateWebhookEventParams } from './webhook-events.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhookEndpointsService } from './webhook-endpoints.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import {
  createMockPrismaService,
  createMockWebhookEvent,
  createMockWebhookEndpoint,
} from '../../test/mocks';
import { WebhookEventType } from './dto/webhook-event-types';

describe('WebhookEventsService', () => {
  let service: WebhookEventsService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let endpointsService: jest.Mocked<WebhookEndpointsService>;
  let deliveryService: jest.Mocked<WebhookDeliveryService>;

  const mockEvent = createMockWebhookEvent();
  const mockEndpoint = createMockWebhookEndpoint();

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookEventsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: WebhookEndpointsService,
          useValue: {
            getEndpointsForEvent: jest.fn().mockResolvedValue([mockEndpoint]),
          },
        },
        {
          provide: WebhookDeliveryService,
          useValue: {
            scheduleDelivery: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookEventsService>(WebhookEventsService);
    endpointsService = module.get(WebhookEndpointsService);
    deliveryService = module.get(WebhookDeliveryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createEvent', () => {
    const createParams: CreateWebhookEventParams = {
      storeId: 'store-123',
      type: WebhookEventType.PAYMENT_COMPLETED,
      resourceType: 'payment',
      resourceId: 'payment-123',
      payload: { amount: 100, currency: 'USD' },
    };

    it('should create event and schedule deliveries', async () => {
      (prisma.webhookEvent.create as jest.Mock).mockResolvedValue(mockEvent);

      const result = await service.createEvent(createParams);

      expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storeId: createParams.storeId,
          type: createParams.type,
          resourceType: createParams.resourceType,
          resourceId: createParams.resourceId,
        }),
      });
      expect(endpointsService.getEndpointsForEvent).toHaveBeenCalledWith(
        createParams.storeId,
        createParams.type,
      );
      expect(deliveryService.scheduleDelivery).toHaveBeenCalledWith(
        mockEvent.id,
        mockEndpoint.id,
      );
      expect(result).toEqual(mockEvent);
    });

    it('should not schedule deliveries if no endpoints subscribed', async () => {
      (prisma.webhookEvent.create as jest.Mock).mockResolvedValue(mockEvent);
      (endpointsService.getEndpointsForEvent as jest.Mock).mockResolvedValue([]);

      await service.createEvent(createParams);

      expect(deliveryService.scheduleDelivery).not.toHaveBeenCalled();
    });

    it('should schedule multiple deliveries for multiple endpoints', async () => {
      const endpoints = [
        mockEndpoint,
        { ...mockEndpoint, id: 'endpoint-456' },
        { ...mockEndpoint, id: 'endpoint-789' },
      ];
      (prisma.webhookEvent.create as jest.Mock).mockResolvedValue(mockEvent);
      (endpointsService.getEndpointsForEvent as jest.Mock).mockResolvedValue(endpoints);

      await service.createEvent(createParams);

      expect(deliveryService.scheduleDelivery).toHaveBeenCalledTimes(3);
    });
  });

  describe('getEvents', () => {
    it('should return paginated events', async () => {
      const events = [mockEvent, { ...mockEvent, id: 'event-456' }];
      (prisma.webhookEvent.findMany as jest.Mock).mockResolvedValue(events);
      (prisma.webhookEvent.count as jest.Mock).mockResolvedValue(2);

      const result = await service.getEvents('store-123', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.hasMore).toBe(false);
    });

    it('should filter by type', async () => {
      (prisma.webhookEvent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.webhookEvent.count as jest.Mock).mockResolvedValue(0);

      await service.getEvents('store-123', {
        type: WebhookEventType.PAYMENT_COMPLETED,
      });

      expect(prisma.webhookEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: WebhookEventType.PAYMENT_COMPLETED,
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      (prisma.webhookEvent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.webhookEvent.count as jest.Mock).mockResolvedValue(0);

      await service.getEvents('store-123', { startDate, endDate });

      expect(prisma.webhookEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: startDate, lte: endDate },
          }),
        }),
      );
    });
  });

  describe('getEvent', () => {
    it('should return single event with deliveries', async () => {
      (prisma.webhookEvent.findFirst as jest.Mock).mockResolvedValue(mockEvent);

      const result = await service.getEvent('store-123', mockEvent.id);

      expect(result).toEqual(mockEvent);
      expect(prisma.webhookEvent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockEvent.id, storeId: 'store-123' },
          include: expect.objectContaining({
            deliveries: expect.any(Object),
          }),
        }),
      );
    });

    it('should return null for non-existent event', async () => {
      (prisma.webhookEvent.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getEvent('store-123', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('resendEvent', () => {
    it('should resend event to all subscribed endpoints', async () => {
      const endpoints = [mockEndpoint, { ...mockEndpoint, id: 'endpoint-456' }];
      (prisma.webhookEvent.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (endpointsService.getEndpointsForEvent as jest.Mock).mockResolvedValue(endpoints);

      const result = await service.resendEvent('store-123', mockEvent.id);

      expect(result?.scheduledDeliveries).toBe(2);
      expect(deliveryService.scheduleDelivery).toHaveBeenCalledTimes(2);
    });

    it('should return null for non-existent event', async () => {
      (prisma.webhookEvent.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.resendEvent('store-123', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('triggerPaymentCompleted', () => {
    it('should create payment.completed event', async () => {
      (prisma.webhookEvent.create as jest.Mock).mockResolvedValue(mockEvent);

      await service.triggerPaymentCompleted({
        id: 'payment-123',
        storeId: 'store-123',
        amount: 100,
        currency: 'USD',
        customerId: 'customer-123',
        pageId: 'page-123',
        status: 'COMPLETED',
      });

      expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: WebhookEventType.PAYMENT_COMPLETED,
          resourceType: 'payment',
          resourceId: 'payment-123',
        }),
      });
    });
  });

  describe('triggerPaymentFailed', () => {
    it('should create payment.failed event', async () => {
      (prisma.webhookEvent.create as jest.Mock).mockResolvedValue(mockEvent);

      await service.triggerPaymentFailed({
        id: 'payment-123',
        storeId: 'store-123',
        amount: 100,
        currency: 'USD',
        failureCode: 'card_declined',
        failureMessage: 'Your card was declined',
      });

      expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: WebhookEventType.PAYMENT_FAILED,
          payload: expect.objectContaining({
            failureCode: 'card_declined',
            failureMessage: 'Your card was declined',
          }),
        }),
      });
    });
  });

  describe('triggerSubscriptionEvent', () => {
    it('should create subscription event', async () => {
      (prisma.webhookEvent.create as jest.Mock).mockResolvedValue(mockEvent);

      await service.triggerSubscriptionEvent(
        WebhookEventType.SUBSCRIPTION_CREATED,
        {
          id: 'subscription-123',
          storeId: 'store-123',
          customerId: 'customer-123',
          pageId: 'page-123',
          status: 'ACTIVE',
          amount: 29.99,
          currency: 'USD',
          interval: 'MONTHLY',
        },
      );

      expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: WebhookEventType.SUBSCRIPTION_CREATED,
          resourceType: 'subscription',
        }),
      });
    });
  });

  describe('triggerRefundEvent', () => {
    it('should create refund event', async () => {
      (prisma.webhookEvent.create as jest.Mock).mockResolvedValue(mockEvent);

      await service.triggerRefundEvent(
        WebhookEventType.PAYMENT_REFUNDED,
        {
          id: 'refund-123',
          paymentId: 'payment-123',
          amount: 50,
          currency: 'USD',
          status: 'SUCCEEDED',
          reason: 'Customer requested',
        },
        'store-123',
      );

      expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: WebhookEventType.PAYMENT_REFUNDED,
          resourceType: 'refund',
        }),
      });
    });
  });
});
