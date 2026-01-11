import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhookEndpointsService } from './webhook-endpoints.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookEventType } from './dto/webhook-event-types';

export interface CreateWebhookEventParams {
  storeId: string;
  type: WebhookEventType;
  resourceType: string;
  resourceId: string;
  payload: Record<string, any>;
}

@Injectable()
export class WebhookEventsService {
  private readonly logger = new Logger(WebhookEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly endpointsService: WebhookEndpointsService,
    private readonly deliveryService: WebhookDeliveryService,
  ) {}

  /**
   * Create a webhook event and schedule deliveries to all subscribed endpoints
   */
  async createEvent(params: CreateWebhookEventParams) {
    const { storeId, type, resourceType, resourceId, payload } = params;

    // Create the event record
    const event = await this.prisma.webhookEvent.create({
      data: {
        storeId,
        type,
        resourceType,
        resourceId,
        payload,
      },
    });

    this.logger.log(
      `Created webhook event ${event.id}: ${type} for ${resourceType}/${resourceId}`,
    );

    // Get all active endpoints subscribed to this event type
    const endpoints = await this.endpointsService.getEndpointsForEvent(
      storeId,
      type,
    );

    if (endpoints.length === 0) {
      this.logger.debug(`No endpoints subscribed to ${type} for store ${storeId}`);
      return event;
    }

    // Schedule deliveries for each endpoint
    for (const endpoint of endpoints) {
      await this.deliveryService.scheduleDelivery(event.id, endpoint.id);
    }

    this.logger.log(
      `Scheduled ${endpoints.length} deliveries for event ${event.id}`,
    );

    return event;
  }

  /**
   * Get events for a store with filtering
   */
  async getEvents(
    storeId: string,
    options?: {
      type?: string;
      resourceType?: string;
      resourceId?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const where: any = { storeId };

    if (options?.type) {
      where.type = options.type;
    }
    if (options?.resourceType) {
      where.resourceType = options.resourceType;
    }
    if (options?.resourceId) {
      where.resourceId = options.resourceId;
    }
    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options?.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options?.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    const [events, total] = await Promise.all([
      this.prisma.webhookEvent.findMany({
        where,
        include: {
          deliveries: {
            select: {
              id: true,
              status: true,
              attemptNumber: true,
              httpStatus: true,
              attemptedAt: true,
              endpoint: {
                select: {
                  id: true,
                  url: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.webhookEvent.count({ where }),
    ]);

    return {
      data: events,
      meta: {
        total,
        page,
        limit,
        hasMore: total > page * limit,
      },
    };
  }

  /**
   * Get a single event with deliveries
   */
  async getEvent(storeId: string, eventId: string) {
    const event = await this.prisma.webhookEvent.findFirst({
      where: {
        id: eventId,
        storeId,
      },
      include: {
        deliveries: {
          include: {
            endpoint: {
              select: {
                id: true,
                url: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return event;
  }

  /**
   * Resend an event to all subscribed endpoints
   */
  async resendEvent(storeId: string, eventId: string) {
    const event = await this.prisma.webhookEvent.findFirst({
      where: {
        id: eventId,
        storeId,
      },
    });

    if (!event) {
      return null;
    }

    const endpoints = await this.endpointsService.getEndpointsForEvent(
      storeId,
      event.type,
    );

    for (const endpoint of endpoints) {
      await this.deliveryService.scheduleDelivery(event.id, endpoint.id);
    }

    this.logger.log(
      `Resent event ${eventId} to ${endpoints.length} endpoints`,
    );

    return { scheduledDeliveries: endpoints.length };
  }

  // === Convenience methods for triggering specific events ===

  /**
   * Trigger payment.completed event
   */
  async triggerPaymentCompleted(payment: {
    id: string;
    storeId: string;
    amount: any;
    currency: string;
    customerId: string;
    pageId: string;
    status: string;
  }) {
    return this.createEvent({
      storeId: payment.storeId,
      type: WebhookEventType.PAYMENT_COMPLETED,
      resourceType: 'payment',
      resourceId: payment.id,
      payload: {
        id: payment.id,
        object: 'payment',
        amount: Number(payment.amount),
        currency: payment.currency,
        status: payment.status,
        customerId: payment.customerId,
        pageId: payment.pageId,
        createdAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Trigger payment.failed event
   */
  async triggerPaymentFailed(payment: {
    id: string;
    storeId: string;
    amount: any;
    currency: string;
    failureCode?: string;
    failureMessage?: string;
  }) {
    return this.createEvent({
      storeId: payment.storeId,
      type: WebhookEventType.PAYMENT_FAILED,
      resourceType: 'payment',
      resourceId: payment.id,
      payload: {
        id: payment.id,
        object: 'payment',
        amount: Number(payment.amount),
        currency: payment.currency,
        status: 'failed',
        failureCode: payment.failureCode,
        failureMessage: payment.failureMessage,
        createdAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Trigger subscription events
   */
  async triggerSubscriptionEvent(
    type: WebhookEventType,
    subscription: {
      id: string;
      storeId: string;
      customerId: string;
      pageId: string;
      status: string;
      amount: any;
      currency: string;
      interval: string;
    },
  ) {
    return this.createEvent({
      storeId: subscription.storeId,
      type,
      resourceType: 'subscription',
      resourceId: subscription.id,
      payload: {
        id: subscription.id,
        object: 'subscription',
        status: subscription.status,
        amount: Number(subscription.amount),
        currency: subscription.currency,
        interval: subscription.interval,
        customerId: subscription.customerId,
        pageId: subscription.pageId,
        createdAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Trigger refund events
   */
  async triggerRefundEvent(
    type: WebhookEventType,
    refund: {
      id: string;
      paymentId: string;
      amount: any;
      currency: string;
      status: string;
      reason: string;
    },
    storeId: string,
  ) {
    return this.createEvent({
      storeId,
      type,
      resourceType: 'refund',
      resourceId: refund.id,
      payload: {
        id: refund.id,
        object: 'refund',
        paymentId: refund.paymentId,
        amount: Number(refund.amount),
        currency: refund.currency,
        status: refund.status,
        reason: refund.reason,
        createdAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Trigger payout events
   */
  async triggerPayoutEvent(
    type: WebhookEventType,
    payout: {
      id: string;
      storeId: string;
      amount: any;
      currency: string;
      status: string;
      method: string;
    },
  ) {
    return this.createEvent({
      storeId: payout.storeId,
      type,
      resourceType: 'payout',
      resourceId: payout.id,
      payload: {
        id: payout.id,
        object: 'payout',
        amount: Number(payout.amount),
        currency: payout.currency,
        status: payout.status,
        method: payout.method,
        createdAt: new Date().toISOString(),
      },
    });
  }
}
