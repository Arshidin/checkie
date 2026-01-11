import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  Logger,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { StripeProvider } from '../../providers/stripe/stripe.provider';
import { PaymentsService } from '../payments.service';

@Controller('webhooks')
export class PspWebhookController {
  private readonly logger = new Logger(PspWebhookController.name);

  constructor(
    private readonly stripeProvider: StripeProvider,
    private readonly paymentsService: PaymentsService,
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

      await this.paymentsService.handleWebhookEvent(
        'stripe',
        event.type,
        event.data,
        event.metadata || {},
      );

      return { received: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Webhook error: ${message}`);
      return { received: false, error: message };
    }
  }

  /**
   * Test endpoint to simulate webhook events (only for development)
   */
  @Post('stripe/test')
  @Public()
  @HttpCode(200)
  async simulateStripeWebhook(
    @Req() req: Request,
  ) {
    const { type, paymentIntentId, metadata, status } = req.body;

    this.logger.log(`[TEST] Simulating webhook: ${type}`);

    const event = this.stripeProvider.createStubWebhookEvent(
      type || 'payment_intent.succeeded',
      paymentIntentId || 'pi_test',
      metadata || {},
      status || 'succeeded',
    );

    await this.paymentsService.handleWebhookEvent(
      'stripe',
      event.type,
      event.data,
      event.metadata || {},
    );

    return { received: true, event };
  }
}
