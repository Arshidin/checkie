import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ProviderFactory } from '../providers/provider.factory';
import { BalanceService } from '../balance/balance.service';
import {
  Subscription,
  SubscriptionStatus,
  SubscriptionInterval,
  Prisma,
  Currency,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SubscriptionFilterDto } from './dto';
import { WebhookEventsService } from '../webhooks/webhook-events.service';
import { WebhookEventType } from '../webhooks/dto/webhook-event-types';

export interface CreateSubscriptionParams {
  storeId: string;
  pageId: string;
  customerId: string;
  customerEmail: string;
  providerCustomerId: string;
  amount: number;
  currency: Currency;
  interval: SubscriptionInterval;
  intervalCount?: number;
  trialPeriodDays?: number;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly platformFeePercent: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: ProviderFactory,
    private readonly balanceService: BalanceService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => WebhookEventsService))
    private readonly webhookEventsService: WebhookEventsService,
  ) {
    this.platformFeePercent = config.get('platform.feePercent', 0.029);
  }

  async createSubscription(
    params: CreateSubscriptionParams,
  ): Promise<Subscription> {
    const provider = this.providerFactory.getDefaultProvider();

    // Create subscription record first (INCOMPLETE status)
    const subscription = await this.prisma.subscription.create({
      data: {
        storeId: params.storeId,
        pageId: params.pageId,
        customerId: params.customerId,
        status: 'INCOMPLETE',
        amount: new Decimal(params.amount),
        currency: params.currency,
        interval: params.interval,
        intervalCount: params.intervalCount || 1,
        paymentProvider: 'stripe',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      },
    });

    try {
      // Create subscription in provider
      const providerResult = await provider.createSubscription({
        customerId: params.providerCustomerId,
        amount: params.amount,
        currency: params.currency,
        interval: this.mapInterval(params.interval),
        intervalCount: params.intervalCount || 1,
        trialPeriodDays: params.trialPeriodDays,
        metadata: {
          storeId: params.storeId,
          pageId: params.pageId,
          subscriptionId: subscription.id,
        },
      });

      // Update with provider data
      const updatedSubscription = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: this.mapProviderStatus(providerResult.status),
          providerSubscriptionId: providerResult.id,
          currentPeriodStart: providerResult.currentPeriodStart,
          currentPeriodEnd: providerResult.currentPeriodEnd,
          trialEndAt: providerResult.trialEnd,
          providerData: {
            latestInvoiceId: providerResult.latestInvoiceId,
            latestInvoiceStatus: providerResult.latestInvoiceStatus,
            clientSecret: providerResult.clientSecret,
          },
        },
      });

      this.logger.log(`Subscription ${subscription.id} created with provider`);
      return updatedSubscription;
    } catch (error) {
      // Clean up on failure
      await this.prisma.subscription.delete({
        where: { id: subscription.id },
      });
      throw error;
    }
  }

  async findByStore(storeId: string, filters: SubscriptionFilterDto) {
    const where: Prisma.SubscriptionWhereInput = {
      storeId,
      ...(filters.status && { status: filters.status }),
      ...(filters.pageId && { pageId: filters.pageId }),
      ...(filters.customerId && { customerId: filters.customerId }),
      ...((filters.startDate || filters.endDate) && {
        createdAt: {
          ...(filters.startDate && { gte: new Date(filters.startDate) }),
          ...(filters.endDate && { lte: new Date(filters.endDate) }),
        },
      }),
    };

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);

    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        include: {
          customer: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          page: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      data: subscriptions,
      meta: {
        total,
        page,
        limit,
        hasMore: total > page * limit,
      },
    };
  }

  async findById(subscriptionId: string, storeId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, storeId },
      include: {
        customer: true,
        page: true,
        customFieldValues: {
          include: { customField: true },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async cancelSubscription(
    subscriptionId: string,
    storeId: string,
    cancelImmediately = false,
    reason?: string,
  ): Promise<Subscription> {
    const subscription = await this.findById(subscriptionId, storeId);

    if (subscription.status === 'CANCELLED') {
      throw new BadRequestException('Subscription is already cancelled');
    }

    if (!subscription.providerSubscriptionId) {
      throw new BadRequestException('Subscription has no provider ID');
    }

    const provider = this.providerFactory.getDefaultProvider();

    // Cancel in provider
    const providerResult = await provider.cancelSubscription(
      subscription.providerSubscriptionId,
      cancelImmediately,
    );

    // Update in database
    const updatedSubscription = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: cancelImmediately ? 'CANCELLED' : subscription.status,
        cancelAtPeriodEnd: !cancelImmediately,
        cancelledAt: cancelImmediately ? new Date() : null,
        providerData: {
          ...(subscription.providerData as object || {}),
          cancellationReason: reason,
        },
      },
    });

    this.logger.log(
      `Subscription ${subscriptionId} cancelled: immediately=${cancelImmediately}`,
    );

    // Trigger webhook
    try {
      await this.webhookEventsService.triggerSubscriptionEvent(
        WebhookEventType.SUBSCRIPTION_CANCELLED,
        {
          id: updatedSubscription.id,
          storeId: updatedSubscription.storeId,
          customerId: updatedSubscription.customerId,
          pageId: updatedSubscription.pageId,
          status: updatedSubscription.status,
          amount: updatedSubscription.amount,
          currency: updatedSubscription.currency,
          interval: updatedSubscription.interval,
        },
      );
    } catch (error: any) {
      this.logger.error(`Failed to trigger webhook: ${error.message}`);
    }

    return updatedSubscription;
  }

  async pauseSubscription(
    subscriptionId: string,
    storeId: string,
  ): Promise<Subscription> {
    const subscription = await this.findById(subscriptionId, storeId);

    if (subscription.status !== 'ACTIVE') {
      throw new BadRequestException('Only active subscriptions can be paused');
    }

    if (!subscription.providerSubscriptionId) {
      throw new BadRequestException('Subscription has no provider ID');
    }

    const provider = this.providerFactory.getDefaultProvider();

    await provider.pauseSubscription(subscription.providerSubscriptionId);

    const updatedSubscription = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'PAUSED' },
    });

    this.logger.log(`Subscription ${subscriptionId} paused`);

    return updatedSubscription;
  }

  async resumeSubscription(
    subscriptionId: string,
    storeId: string,
  ): Promise<Subscription> {
    const subscription = await this.findById(subscriptionId, storeId);

    if (subscription.status !== 'PAUSED') {
      throw new BadRequestException('Only paused subscriptions can be resumed');
    }

    if (!subscription.providerSubscriptionId) {
      throw new BadRequestException('Subscription has no provider ID');
    }

    const provider = this.providerFactory.getDefaultProvider();

    const providerResult = await provider.resumeSubscription(
      subscription.providerSubscriptionId,
    );

    const updatedSubscription = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: providerResult.currentPeriodStart,
        currentPeriodEnd: providerResult.currentPeriodEnd,
      },
    });

    this.logger.log(`Subscription ${subscriptionId} resumed`);

    return updatedSubscription;
  }

  // ==================== Webhook Handlers ====================

  async handleSubscriptionCreated(
    providerSubscriptionId: string,
    data: any,
  ): Promise<void> {
    const subscriptionId = data.metadata?.subscriptionId;

    if (!subscriptionId) {
      this.logger.warn(
        `Subscription created webhook missing subscriptionId: ${providerSubscriptionId}`,
      );
      return;
    }

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: this.mapProviderStatus(data.status),
        providerSubscriptionId,
        currentPeriodStart: new Date(data.current_period_start * 1000),
        currentPeriodEnd: new Date(data.current_period_end * 1000),
        providerData: data,
      },
    });

    this.logger.log(`Subscription ${subscriptionId} created via webhook`);
  }

  async handleSubscriptionUpdated(
    providerSubscriptionId: string,
    data: any,
  ): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { providerSubscriptionId },
    });

    if (!subscription) {
      this.logger.warn(
        `Subscription not found for provider ID: ${providerSubscriptionId}`,
      );
      return;
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: this.mapProviderStatus(data.status),
        currentPeriodStart: new Date(data.current_period_start * 1000),
        currentPeriodEnd: new Date(data.current_period_end * 1000),
        cancelAtPeriodEnd: data.cancel_at_period_end || false,
        cancelledAt: data.canceled_at
          ? new Date(data.canceled_at * 1000)
          : null,
        providerData: data,
      },
    });

    this.logger.log(`Subscription ${subscription.id} updated via webhook`);
  }

  async handleSubscriptionDeleted(
    providerSubscriptionId: string,
    data: any,
  ): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { providerSubscriptionId },
    });

    if (!subscription) {
      this.logger.warn(
        `Subscription not found for provider ID: ${providerSubscriptionId}`,
      );
      return;
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        providerData: data,
      },
    });

    this.logger.log(`Subscription ${subscription.id} deleted via webhook`);
  }

  async handleInvoicePaymentSucceeded(
    invoiceId: string,
    data: any,
  ): Promise<void> {
    const providerSubscriptionId = data.subscription;

    if (!providerSubscriptionId) {
      this.logger.debug(`Invoice ${invoiceId} is not for a subscription`);
      return;
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { providerSubscriptionId },
      include: { store: true },
    });

    if (!subscription) {
      this.logger.warn(
        `Subscription not found for invoice: ${invoiceId}`,
      );
      return;
    }

    // Calculate amounts
    const amount = new Decimal(data.amount_paid / 100);
    const platformFee = amount.mul(this.platformFeePercent);
    const netAmount = amount.minus(platformFee);

    // Update subscription status
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: new Date(data.period_start * 1000),
        currentPeriodEnd: new Date(data.period_end * 1000),
      },
    });

    // Add balance transaction for subscription payment
    await this.balanceService.addTransaction({
      storeId: subscription.storeId,
      type: 'PAYMENT_RECEIVED',
      amount: netAmount,
      currency: subscription.currency,
      description: `Subscription payment - ${subscription.id}`,
      metadata: {
        subscriptionId: subscription.id,
        invoiceId,
      },
    });

    // Deduct platform fee
    await this.balanceService.addTransaction({
      storeId: subscription.storeId,
      type: 'FEE',
      amount: platformFee.negated(),
      currency: subscription.currency,
      description: `Platform fee (${this.platformFeePercent * 100}%)`,
      metadata: {
        subscriptionId: subscription.id,
        invoiceId,
      },
    });

    this.logger.log(
      `Invoice ${invoiceId} payment succeeded for subscription ${subscription.id}`,
    );

    // Trigger webhook for subscription renewed
    try {
      await this.webhookEventsService.triggerSubscriptionEvent(
        WebhookEventType.SUBSCRIPTION_RENEWED,
        {
          id: subscription.id,
          storeId: subscription.storeId,
          customerId: subscription.customerId,
          pageId: subscription.pageId,
          status: 'ACTIVE',
          amount: subscription.amount,
          currency: subscription.currency,
          interval: subscription.interval,
        },
      );
    } catch (error: any) {
      this.logger.error(`Failed to trigger webhook: ${error.message}`);
    }
  }

  async handleInvoicePaymentFailed(
    invoiceId: string,
    data: any,
  ): Promise<void> {
    const providerSubscriptionId = data.subscription;

    if (!providerSubscriptionId) {
      return;
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { providerSubscriptionId },
    });

    if (!subscription) {
      this.logger.warn(
        `Subscription not found for failed invoice: ${invoiceId}`,
      );
      return;
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'PAST_DUE',
        providerData: {
          ...(subscription.providerData as object || {}),
          lastFailedInvoiceId: invoiceId,
        },
      },
    });

    this.logger.warn(
      `Invoice ${invoiceId} payment failed for subscription ${subscription.id}`,
    );

    // Trigger webhook for payment failure
    try {
      await this.webhookEventsService.triggerSubscriptionEvent(
        WebhookEventType.SUBSCRIPTION_PAYMENT_FAILED,
        {
          id: subscription.id,
          storeId: subscription.storeId,
          customerId: subscription.customerId,
          pageId: subscription.pageId,
          status: 'PAST_DUE',
          amount: subscription.amount,
          currency: subscription.currency,
          interval: subscription.interval,
        },
      );
    } catch (error: any) {
      this.logger.error(`Failed to trigger webhook: ${error.message}`);
    }
  }

  // ==================== Helper Methods ====================

  private mapInterval(
    interval: SubscriptionInterval,
  ): 'day' | 'week' | 'month' | 'year' {
    const mapping: Record<
      SubscriptionInterval,
      'day' | 'week' | 'month' | 'year'
    > = {
      DAILY: 'day',
      WEEKLY: 'week',
      MONTHLY: 'month',
      YEARLY: 'year',
    };
    return mapping[interval];
  }

  private mapProviderStatus(status: string): SubscriptionStatus {
    const mapping: Record<string, SubscriptionStatus> = {
      incomplete: 'INCOMPLETE',
      incomplete_expired: 'INCOMPLETE',
      trialing: 'TRIALING',
      active: 'ACTIVE',
      past_due: 'PAST_DUE',
      canceled: 'CANCELLED',
      unpaid: 'UNPAID',
      paused: 'PAUSED',
    };
    return mapping[status] || 'INCOMPLETE';
  }
}
