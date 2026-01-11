import { Injectable, Logger, BadRequestException, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProvider,
  CreatePaymentIntentParams,
  PaymentIntentResult,
  ConfirmPaymentParams,
  RefundParams,
  RefundResult,
  WebhookEventResult,
  CreateSubscriptionParams,
  SubscriptionResult,
  UpdateSubscriptionParams,
} from '../interfaces/payment-provider.interface';
import { randomUUID } from 'crypto';

/**
 * Stripe Provider - STUB IMPLEMENTATION
 *
 * This is a mock implementation for development/testing.
 * Replace with real Stripe SDK integration for production.
 *
 * TODO: Install stripe package and implement real integration
 * npm install stripe
 */
@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly code = 'stripe';
  private readonly logger = new Logger(StripeProvider.name);
  private readonly isTestMode: boolean;

  constructor(private readonly config: ConfigService) {
    const secretKey = config.get<string>('stripe.secretKey', '');
    this.isTestMode = !secretKey || secretKey.startsWith('sk_test_');

    if (!secretKey) {
      this.logger.warn('Stripe secret key not configured. Running in STUB mode.');
    }
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    this.logger.log(`[STUB] Creating PaymentIntent: ${params.amount} ${params.currency}`);

    // Simulate processing delay
    await this.simulateDelay();

    const intentId = `pi_stub_${randomUUID().replace(/-/g, '').substring(0, 24)}`;
    const clientSecret = `${intentId}_secret_${randomUUID().replace(/-/g, '').substring(0, 24)}`;

    // Simulate 3DS for amounts > 100
    const requiresAction = params.amount > 100 && Math.random() > 0.7;

    return {
      id: intentId,
      clientSecret,
      status: requiresAction ? 'requires_action' : 'requires_payment_method',
      amount: params.amount,
      currency: params.currency.toUpperCase(),
      requiresAction,
      nextActionType: requiresAction ? 'redirect_to_url' : undefined,
      nextActionUrl: requiresAction ? `https://stripe.com/3ds-stub?pi=${intentId}` : undefined,
    };
  }

  async retrievePaymentIntent(id: string): Promise<PaymentIntentResult> {
    this.logger.log(`[STUB] Retrieving PaymentIntent: ${id}`);

    await this.simulateDelay();

    return {
      id,
      clientSecret: `${id}_secret_stub`,
      status: 'requires_payment_method',
      amount: 0,
      currency: 'USD',
      requiresAction: false,
    };
  }

  async confirmPaymentIntent(params: ConfirmPaymentParams): Promise<PaymentIntentResult> {
    this.logger.log(`[STUB] Confirming PaymentIntent: ${params.paymentIntentId}`);

    await this.simulateDelay();

    return {
      id: params.paymentIntentId,
      clientSecret: `${params.paymentIntentId}_secret_stub`,
      status: 'succeeded',
      amount: 0,
      currency: 'USD',
      requiresAction: false,
    };
  }

  async cancelPaymentIntent(id: string): Promise<void> {
    this.logger.log(`[STUB] Cancelling PaymentIntent: ${id}`);
    await this.simulateDelay();
  }

  async createRefund(params: RefundParams): Promise<RefundResult> {
    this.logger.log(
      `[STUB] Creating Refund for: ${params.paymentIntentId}, amount: ${params.amount}`,
    );

    await this.simulateDelay();

    const refundId = `re_stub_${randomUUID().replace(/-/g, '').substring(0, 24)}`;

    return {
      id: refundId,
      status: 'succeeded',
      amount: params.amount || 0,
      currency: 'USD',
    };
  }

  async createCustomer(email: string, _metadata?: Record<string, string>): Promise<string> {
    this.logger.log(`[STUB] Creating Customer: ${email}`);

    await this.simulateDelay();

    return `cus_stub_${randomUUID().replace(/-/g, '').substring(0, 14)}`;
  }

  constructWebhookEvent(payload: Buffer, signature: string): WebhookEventResult {
    this.logger.log(`[STUB] Constructing webhook event`);

    // In stub mode, parse the payload directly without signature verification
    if (!signature || signature === 'stub_signature') {
      try {
        const data = JSON.parse(payload.toString());
        return {
          type: data.type || 'payment_intent.succeeded',
          id: data.id || `evt_stub_${randomUUID().replace(/-/g, '').substring(0, 24)}`,
          data: data.data?.object || data,
          metadata: data.data?.object?.metadata || {},
        };
      } catch {
        throw new BadRequestException('Invalid webhook payload');
      }
    }

    // For real signature verification, throw not implemented
    throw new NotImplementedException(
      'Real Stripe webhook verification not implemented. Use stub mode or implement full Stripe integration.',
    );
  }

  // ==================== Subscription Methods ====================

  async createSubscription(params: CreateSubscriptionParams): Promise<SubscriptionResult> {
    this.logger.log(
      `[STUB] Creating Subscription: ${params.amount} ${params.currency} / ${params.interval}`,
    );

    await this.simulateDelay();

    const subscriptionId = `sub_stub_${randomUUID().replace(/-/g, '').substring(0, 14)}`;
    const now = new Date();
    const periodEnd = this.calculatePeriodEnd(now, params.interval, params.intervalCount || 1);

    // Calculate trial end if applicable
    let trialEnd: Date | undefined;
    let status: SubscriptionResult['status'] = 'active';

    if (params.trialPeriodDays && params.trialPeriodDays > 0) {
      trialEnd = new Date(now.getTime() + params.trialPeriodDays * 24 * 60 * 60 * 1000);
      status = 'trialing';
    }

    return {
      id: subscriptionId,
      status,
      customerId: params.customerId,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd || periodEnd,
      trialEnd,
      cancelAtPeriodEnd: params.cancelAtPeriodEnd || false,
      latestInvoiceId: `in_stub_${randomUUID().replace(/-/g, '').substring(0, 14)}`,
      latestInvoiceStatus: status === 'trialing' ? 'paid' : 'open',
      clientSecret:
        status === 'trialing'
          ? undefined
          : `seti_stub_${randomUUID().replace(/-/g, '').substring(0, 24)}_secret`,
    };
  }

  async retrieveSubscription(id: string): Promise<SubscriptionResult> {
    this.logger.log(`[STUB] Retrieving Subscription: ${id}`);

    await this.simulateDelay();

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      id,
      status: 'active',
      customerId: `cus_stub_${randomUUID().replace(/-/g, '').substring(0, 14)}`,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    };
  }

  async updateSubscription(params: UpdateSubscriptionParams): Promise<SubscriptionResult> {
    this.logger.log(`[STUB] Updating Subscription: ${params.subscriptionId}`);

    await this.simulateDelay();

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      id: params.subscriptionId,
      status: 'active',
      customerId: `cus_stub_${randomUUID().replace(/-/g, '').substring(0, 14)}`,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: params.cancelAtPeriodEnd || false,
    };
  }

  async cancelSubscription(id: string, cancelImmediately = false): Promise<SubscriptionResult> {
    this.logger.log(`[STUB] Cancelling Subscription: ${id}, immediately: ${cancelImmediately}`);

    await this.simulateDelay();

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      id,
      status: cancelImmediately ? 'canceled' : 'active',
      customerId: `cus_stub_${randomUUID().replace(/-/g, '').substring(0, 14)}`,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: !cancelImmediately,
      canceledAt: cancelImmediately ? now : undefined,
    };
  }

  async pauseSubscription(id: string): Promise<SubscriptionResult> {
    this.logger.log(`[STUB] Pausing Subscription: ${id}`);

    await this.simulateDelay();

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      id,
      status: 'paused',
      customerId: `cus_stub_${randomUUID().replace(/-/g, '').substring(0, 14)}`,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    };
  }

  async resumeSubscription(id: string): Promise<SubscriptionResult> {
    this.logger.log(`[STUB] Resuming Subscription: ${id}`);

    await this.simulateDelay();

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      id,
      status: 'active',
      customerId: `cus_stub_${randomUUID().replace(/-/g, '').substring(0, 14)}`,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    };
  }

  /**
   * Simulate a subscription webhook event for testing
   */
  createStubSubscriptionWebhookEvent(
    type: string,
    subscriptionId: string,
    metadata: Record<string, string>,
    status: SubscriptionResult['status'] = 'active',
  ): WebhookEventResult {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      type,
      id: `evt_stub_${randomUUID().replace(/-/g, '').substring(0, 24)}`,
      data: {
        id: subscriptionId,
        object: 'subscription',
        status,
        metadata,
        current_period_start: Math.floor(now.getTime() / 1000),
        current_period_end: Math.floor(periodEnd.getTime() / 1000),
        cancel_at_period_end: false,
        customer: `cus_stub_${randomUUID().replace(/-/g, '').substring(0, 14)}`,
      },
      metadata,
    };
  }

  /**
   * Simulate an invoice webhook event for testing
   */
  createStubInvoiceWebhookEvent(
    type: string,
    subscriptionId: string,
    metadata: Record<string, string>,
    status: 'paid' | 'payment_failed' = 'paid',
  ): WebhookEventResult {
    const invoiceId = `in_stub_${randomUUID().replace(/-/g, '').substring(0, 14)}`;
    const now = new Date();

    return {
      type,
      id: `evt_stub_${randomUUID().replace(/-/g, '').substring(0, 24)}`,
      data: {
        id: invoiceId,
        object: 'invoice',
        status,
        subscription: subscriptionId,
        amount_due: 1000,
        amount_paid: status === 'paid' ? 1000 : 0,
        currency: 'usd',
        customer: `cus_stub_${randomUUID().replace(/-/g, '').substring(0, 14)}`,
        period_start: Math.floor(now.getTime() / 1000),
        period_end: Math.floor((now.getTime() + 30 * 24 * 60 * 60 * 1000) / 1000),
        payment_intent: `pi_stub_${randomUUID().replace(/-/g, '').substring(0, 24)}`,
        metadata,
      },
      metadata,
    };
  }

  private calculatePeriodEnd(
    start: Date,
    interval: 'day' | 'week' | 'month' | 'year',
    count: number,
  ): Date {
    const result = new Date(start);
    switch (interval) {
      case 'day':
        result.setDate(result.getDate() + count);
        break;
      case 'week':
        result.setDate(result.getDate() + count * 7);
        break;
      case 'month':
        result.setMonth(result.getMonth() + count);
        break;
      case 'year':
        result.setFullYear(result.getFullYear() + count);
        break;
    }
    return result;
  }

  /**
   * Simulate a webhook event for testing
   */
  createStubWebhookEvent(
    type: string,
    paymentIntentId: string,
    metadata: Record<string, string>,
    status: 'succeeded' | 'failed' = 'succeeded',
  ): WebhookEventResult {
    return {
      type,
      id: `evt_stub_${randomUUID().replace(/-/g, '').substring(0, 24)}`,
      data: {
        id: paymentIntentId,
        object: 'payment_intent',
        status,
        metadata,
        amount: 1000,
        currency: 'usd',
        last_payment_error:
          status === 'failed'
            ? { code: 'card_declined', message: 'Your card was declined.' }
            : null,
      },
      metadata,
    };
  }

  private async simulateDelay(): Promise<void> {
    const delay = Math.random() * 100 + 50; // 50-150ms
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
