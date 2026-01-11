import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CheckoutSessionService, CreateSessionParams } from './services/checkout-session.service';
import { IdempotencyService } from './services/idempotency.service';
import { ProviderFactory } from '../providers/provider.factory';
import {
  CreateCheckoutSessionDto,
  UpdateCheckoutSessionDto,
  InitiatePaymentDto,
  CheckoutSessionResponseDto,
  InitiatePaymentResponseDto,
} from './dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly platformFeePercent: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly sessionService: CheckoutSessionService,
    private readonly idempotencyService: IdempotencyService,
    private readonly providerFactory: ProviderFactory,
  ) {
    this.platformFeePercent = this.config.get<number>('PLATFORM_FEE_PERCENT', 0.029);
  }

  async createSession(dto: CreateCheckoutSessionDto): Promise<CheckoutSessionResponseDto> {
    const params: CreateSessionParams = {
      pageId: dto.pageId,
      customerEmail: dto.customerEmail,
      customerId: dto.customerId,
      selectedVariants: dto.selectedVariants,
      customFieldValues: dto.customFieldValues,
      metadata: {
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
        referrer: dto.referrer,
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
        utmTerm: dto.utmTerm,
        utmContent: dto.utmContent,
      },
    };

    // Apply coupon if provided
    if (dto.couponCode) {
      const page = await this.prisma.page.findUnique({
        where: { id: dto.pageId },
        select: { storeId: true },
      });

      if (page) {
        const coupon = await this.prisma.coupon.findUnique({
          where: {
            storeId_code: {
              storeId: page.storeId,
              code: dto.couponCode.toUpperCase(),
            },
          },
        });

        if (coupon && coupon.isActive) {
          params.couponId = coupon.id;
        }
      }
    }

    const session = await this.sessionService.createSession(params);
    const { state, context } = await this.sessionService.getSessionState(session.id);

    return this.mapToResponse(session, state, context);
  }

  async getSession(sessionId: string): Promise<CheckoutSessionResponseDto> {
    const session = await this.sessionService.getSession(sessionId);
    const { state, context } = await this.sessionService.getSessionState(sessionId);

    return this.mapToResponse(session, state, context);
  }

  async updateSession(
    sessionId: string,
    dto: UpdateCheckoutSessionDto,
  ): Promise<CheckoutSessionResponseDto> {
    const session = await this.sessionService.updateSession(sessionId, {
      customerEmail: dto.customerEmail,
      selectedVariants: dto.selectedVariants,
      customFieldValues: dto.customFieldValues,
      amount: dto.amount,
    });

    const { state, context } = await this.sessionService.getSessionState(sessionId);

    return this.mapToResponse(session, state, context);
  }

  async initiatePayment(dto: InitiatePaymentDto): Promise<InitiatePaymentResponseDto> {
    const { sessionId, idempotencyKey, paymentMethodId } = dto;

    // Check idempotency
    if (idempotencyKey) {
      const session = await this.sessionService.getSession(sessionId);
      const idempotencyResult = await this.idempotencyService.checkOrCreate(
        idempotencyKey,
        session.storeId,
        '/checkout/initiate',
        dto,
      );

      if (!idempotencyResult.isNew && idempotencyResult.existingResponse) {
        return idempotencyResult.existingResponse.body;
      }
    }

    // Validate session state
    const { state, context } = await this.sessionService.getSessionState(sessionId);

    if (state !== 'open') {
      throw new BadRequestException(`Cannot initiate payment in ${state} state`);
    }

    // Send initiate payment event
    const result = await this.sessionService.sendEvent(sessionId, {
      type: 'INITIATE_PAYMENT',
      paymentMethodId: paymentMethodId || '',
    });

    // If validation failed, return error
    if (result.state === 'open' && result.context.error) {
      const response: InitiatePaymentResponseDto = {
        sessionId,
        status: 'OPEN',
        requiresAction: false,
        error: result.context.error,
      };

      if (idempotencyKey) {
        await this.idempotencyService.setResponse(idempotencyKey, 400, response);
      }

      throw new BadRequestException(result.context.error);
    }

    // Create Payment and PaymentAttempt in database
    const session = await this.sessionService.getSession(sessionId);

    // Get or create customer
    let customerId = session.customerId;
    if (!customerId && context.customerEmail) {
      const customer = await this.prisma.customer.upsert({
        where: {
          storeId_email: {
            storeId: session.storeId,
            email: context.customerEmail,
          },
        },
        create: {
          storeId: session.storeId,
          email: context.customerEmail,
        },
        update: {},
      });
      customerId = customer.id;

      await this.prisma.checkoutSession.update({
        where: { id: sessionId },
        data: { customerId },
      });
    }

    if (!customerId) {
      throw new BadRequestException('Customer email is required');
    }

    // Calculate fees
    const amount = Number(session.amount);
    const platformFee = amount * this.platformFeePercent;
    const netAmount = amount - platformFee;

    // Create Payment
    const payment = await this.prisma.payment.create({
      data: {
        storeId: session.storeId,
        pageId: session.pageId,
        customerId,
        amount: session.amount,
        currency: session.currency,
        status: 'PENDING',
        paymentProvider: 'stripe', // TODO: Get from routing rules
        couponId: session.couponId,
        discountAmount: session.discountAmount,
        platformFee: new Decimal(platformFee),
        netAmount: new Decimal(netAmount),
      },
    });

    // Create PaymentAttempt
    const attemptNumber = (result.context.attempts?.length || 0) + 1;
    const attempt = await this.prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        checkoutSessionId: sessionId,
        attemptNumber,
        providerId: 'stripe',
        status: 'PENDING',
      },
    });

    // Update session with paymentId
    await this.prisma.checkoutSession.update({
      where: { id: sessionId },
      data: { paymentId: payment.id },
    });

    // Update state machine context
    await this.sessionService.sendEvent(sessionId, {
      type: 'UPDATE_SESSION',
      data: { paymentId: payment.id },
    });

    // Call PSP to create PaymentIntent
    const provider = this.providerFactory.getDefaultProvider();
    const finalAmount = Number(session.amount) - Number(session.discountAmount || 0);

    const intentResult = await provider.createPaymentIntent({
      amount: finalAmount,
      currency: session.currency,
      customerEmail: context.customerEmail || undefined,
      metadata: {
        storeId: session.storeId,
        pageId: session.pageId,
        checkoutSessionId: sessionId,
        paymentId: payment.id,
      },
    });

    // Update PaymentAttempt with provider data
    await this.prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        providerAttemptId: intentResult.id,
        status: intentResult.requiresAction ? 'REQUIRES_ACTION' : 'PROCESSING',
        requires3DS: intentResult.requiresAction,
        redirectUrl: intentResult.nextActionUrl,
      },
    });

    // Update Payment with provider ID
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: intentResult.id,
        status: 'PROCESSING',
      },
    });

    // If requires 3DS, send event to state machine
    if (intentResult.requiresAction) {
      await this.sessionService.sendEvent(sessionId, {
        type: 'REQUIRES_ACTION',
        actionType: intentResult.nextActionType || '3ds',
        redirectUrl: intentResult.nextActionUrl || '',
      });
    }

    const response: InitiatePaymentResponseDto = {
      sessionId,
      status: intentResult.requiresAction ? 'AWAITING_ACTION' : 'PROCESSING',
      paymentId: payment.id,
      requiresAction: intentResult.requiresAction,
      clientSecret: intentResult.clientSecret,
      redirectUrl: intentResult.nextActionUrl,
    };

    if (idempotencyKey) {
      await this.idempotencyService.setResponse(idempotencyKey, 200, response);
    }

    this.logger.log(
      `Payment initiated for session ${sessionId}, payment ${payment.id}, provider intent: ${intentResult.id}`,
    );

    return response;
  }

  async getSessionStatus(sessionId: string): Promise<{
    sessionId: string;
    status: string;
    paymentId: string | null;
    completedAt: Date | null;
    error: string | null;
  }> {
    const session = await this.sessionService.getSession(sessionId);
    const { context } = await this.sessionService.getSessionState(sessionId);

    return {
      sessionId: session.id,
      status: session.status,
      paymentId: session.paymentId,
      completedAt: session.completedAt,
      error: context.error,
    };
  }

  async abandonSession(sessionId: string, reason?: string): Promise<void> {
    await this.sessionService.sendEvent(sessionId, {
      type: 'ABANDON',
      reason,
    });
  }

  async handleWebhook(provider: string, eventType: string, payload: any): Promise<void> {
    await this.sessionService.handleWebhookEvent(provider, eventType, payload);
  }

  private mapToResponse(
    session: any,
    state: string,
    context: any,
  ): CheckoutSessionResponseDto {
    return {
      id: session.id,
      storeId: session.storeId,
      pageId: session.pageId,
      customerId: session.customerId,
      status: session.status,
      amount: Number(session.amount),
      currency: session.currency,
      discountAmount: Number(session.discountAmount),
      selectedVariants: session.selectedVariants as Record<string, string> | null,
      expiresAt: session.expiresAt,
      paymentId: session.paymentId,
      completedAt: session.completedAt,
      error: context?.error || null,
      redirectUrl: context?.redirectUrl || null,
      attemptsCount: context?.attempts?.length || 0,
      canRetry: state === 'open' && (context?.attempts?.length || 0) < 3,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
