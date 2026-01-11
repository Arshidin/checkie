import { Controller, Post, Req, Headers, HttpCode, Logger, RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { StripeProvider } from '../../providers/stripe/stripe.provider';
import { PaymentsService } from '../payments.service';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';

@Controller('webhooks')
export class PspWebhookController {
  private readonly logger = new Logger(PspWebhookController.name);

  constructor(
    private readonly stripeProvider: StripeProvider,
    private readonly paymentsService: PaymentsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Post('stripe')
  @Public()
  @HttpCode(200)
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));

    if (!rawBody) {
      this.logger.error('Missing raw body in webhook request');
      return { received: false, error: 'Missing body' };
    }

    try {
      const event = this.stripeProvider.constructWebhookEvent(
        rawBody,
        signature || 'stub_signature',
      );

      // Route to appropriate handler based on event type
      await this.routeWebhookEvent(event.type, event.data, event.metadata || {});

      return { received: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Webhook error: ${message}`);
      return { received: false, error: message };
    }
  }

  private async routeWebhookEvent(
    eventType: string,
    data: any,
    metadata: Record<string, string>,
  ): Promise<void> {
    this.logger.log(`Routing webhook event: ${eventType}`);

    // Subscription events
    if (eventType.startsWith('customer.subscription.')) {
      await this.handleSubscriptionEvent(eventType, data);
      return;
    }

    // Invoice events (for subscription billing)
    if (eventType.startsWith('invoice.')) {
      await this.handleInvoiceEvent(eventType, data);
      return;
    }

    // Payment intent events
    if (eventType.startsWith('payment_intent.')) {
      await this.paymentsService.handleWebhookEvent('stripe', eventType, data, metadata);
      return;
    }

    this.logger.debug(`Unhandled webhook event type: ${eventType}`);
  }

  private async handleSubscriptionEvent(eventType: string, data: any): Promise<void> {
    const subscriptionId = data.id;

    switch (eventType) {
      case 'customer.subscription.created':
        await this.subscriptionsService.handleSubscriptionCreated(subscriptionId, data);
        break;

      case 'customer.subscription.updated':
        await this.subscriptionsService.handleSubscriptionUpdated(subscriptionId, data);
        break;

      case 'customer.subscription.deleted':
        await this.subscriptionsService.handleSubscriptionDeleted(subscriptionId, data);
        break;

      default:
        this.logger.debug(`Unhandled subscription event: ${eventType}`);
    }
  }

  private async handleInvoiceEvent(eventType: string, data: any): Promise<void> {
    const invoiceId = data.id;

    switch (eventType) {
      case 'invoice.payment_succeeded':
        await this.subscriptionsService.handleInvoicePaymentSucceeded(invoiceId, data);
        break;

      case 'invoice.payment_failed':
        await this.subscriptionsService.handleInvoicePaymentFailed(invoiceId, data);
        break;

      default:
        this.logger.debug(`Unhandled invoice event: ${eventType}`);
    }
  }

  /**
   * Test endpoint to simulate payment webhook events (only for development)
   */
  @Post('stripe/test')
  @Public()
  @HttpCode(200)
  async simulateStripeWebhook(@Req() req: Request) {
    const { type, paymentIntentId, metadata, status } = req.body;

    this.logger.log(`[TEST] Simulating webhook: ${type}`);

    const event = this.stripeProvider.createStubWebhookEvent(
      type || 'payment_intent.succeeded',
      paymentIntentId || 'pi_test',
      metadata || {},
      status || 'succeeded',
    );

    await this.routeWebhookEvent(event.type, event.data, event.metadata || {});

    return { received: true, event };
  }

  /**
   * Test endpoint to simulate subscription webhook events (only for development)
   */
  @Post('stripe/test/subscription')
  @Public()
  @HttpCode(200)
  async simulateSubscriptionWebhook(@Req() req: Request) {
    const { type, subscriptionId, metadata, status } = req.body;

    this.logger.log(`[TEST] Simulating subscription webhook: ${type}`);

    const event = this.stripeProvider.createStubSubscriptionWebhookEvent(
      type || 'customer.subscription.created',
      subscriptionId || 'sub_test',
      metadata || {},
      status || 'active',
    );

    await this.routeWebhookEvent(event.type, event.data, event.metadata || {});

    return { received: true, event };
  }

  /**
   * Test endpoint to simulate invoice webhook events (only for development)
   */
  @Post('stripe/test/invoice')
  @Public()
  @HttpCode(200)
  async simulateInvoiceWebhook(@Req() req: Request) {
    const { type, subscriptionId, metadata, status } = req.body;

    this.logger.log(`[TEST] Simulating invoice webhook: ${type}`);

    const event = this.stripeProvider.createStubInvoiceWebhookEvent(
      type || 'invoice.payment_succeeded',
      subscriptionId || 'sub_test',
      metadata || {},
      status || 'paid',
    );

    await this.routeWebhookEvent(event.type, event.data, event.metadata || {});

    return { received: true, event };
  }
}
