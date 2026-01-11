import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import {
  CheckoutSessionContext,
  CheckoutSessionEvent,
  CheckoutSessionState,
} from '../checkout-session.machine';
import { CheckoutSession, CheckoutSessionStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

export interface CreateSessionParams {
  pageId: string;
  customerEmail?: string;
  customerId?: string;
  selectedVariants?: Record<string, string>;
  customFieldValues?: Record<string, string>;
  couponId?: string;
  metadata?: SessionMetadata;
}

interface StoredState {
  value: string;
  context: CheckoutSessionContext;
}

@Injectable()
export class CheckoutSessionService {
  private readonly logger = new Logger(CheckoutSessionService.name);
  private readonly REDIS_PREFIX = 'checkout:session:';
  private readonly STATE_TTL = 60 * 60 * 24; // 24 hours
  private readonly SESSION_TTL_MINUTES = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async createSession(params: CreateSessionParams): Promise<CheckoutSession> {
    const page = await this.prisma.page.findUnique({
      where: { id: params.pageId },
      include: {
        store: true,
        variants: {
          include: { options: true },
        },
        customFields: true,
      },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    if (page.status !== 'ACTIVE') {
      throw new BadRequestException('Page is not active');
    }

    // Calculate base amount from page price
    let amount = page.price ? Number(page.price) : 0;

    // Apply variant price modifiers
    if (params.selectedVariants) {
      for (const [variantId, optionId] of Object.entries(params.selectedVariants)) {
        const variant = page.variants.find((v) => v.id === variantId);
        if (variant) {
          const option = variant.options.find((o) => o.id === optionId);
          if (option?.priceModifier) {
            amount += Number(option.priceModifier);
          }
        }
      }
    }

    // Create pricing snapshot
    const pricingSnapshot = {
      price: page.price ? Number(page.price) : null,
      pricingType: page.pricingType,
      currency: page.currency,
      variants: page.variants.map((v) => ({
        id: v.id,
        name: v.name,
        isRequired: v.isRequired,
        options: v.options.map((o) => ({
          id: o.id,
          name: o.name,
          priceModifier: o.priceModifier ? Number(o.priceModifier) : null,
          isDefault: o.isDefault,
        })),
      })),
      customFields: page.customFields.map((f) => ({
        id: f.id,
        name: f.name,
        label: f.label,
        type: f.type,
        isRequired: f.isRequired,
      })),
      capturedAt: new Date().toISOString(),
    };

    // Calculate expiry
    const ttlMinutes = page.sessionTtlMinutes || this.SESSION_TTL_MINUTES;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    // Create session in database
    const session = await this.prisma.checkoutSession.create({
      data: {
        storeId: page.storeId,
        pageId: page.id,
        customerId: params.customerId,
        status: 'OPEN',
        amount: new Decimal(amount),
        currency: page.currency,
        pricingSnapshot,
        selectedVariants: params.selectedVariants || {},
        couponId: params.couponId,
        discountAmount: new Decimal(0),
        expiresAt,
        ipAddress: params.metadata?.ipAddress,
        userAgent: params.metadata?.userAgent,
        referrer: params.metadata?.referrer,
        utmSource: params.metadata?.utmSource,
        utmMedium: params.metadata?.utmMedium,
        utmCampaign: params.metadata?.utmCampaign,
        utmTerm: params.metadata?.utmTerm,
        utmContent: params.metadata?.utmContent,
      },
    });

    // Create custom field values if provided
    if (params.customFieldValues) {
      const fieldValueData = Object.entries(params.customFieldValues).map(([fieldId, value]) => ({
        customFieldId: fieldId,
        checkoutSessionId: session.id,
        value: String(value),
      }));

      if (fieldValueData.length > 0) {
        await this.prisma.customFieldValue.createMany({
          data: fieldValueData,
        });
      }
    }

    // Initialize state machine context
    const initialContext: CheckoutSessionContext = {
      sessionId: session.id,
      storeId: session.storeId,
      pageId: session.pageId,
      customerId: session.customerId,
      customerEmail: params.customerEmail || null,
      amount: Number(session.amount),
      currency: session.currency,
      selectedVariants: (session.selectedVariants as Record<string, string>) || {},
      customFieldValues: params.customFieldValues || {},
      couponId: session.couponId,
      discountAmount: Number(session.discountAmount),
      paymentId: null,
      attempts: [],
      error: null,
      redirectUrl: null,
      expiresAt: expiresAt.getTime(),
    };

    // Save initial state to Redis
    await this.saveState(session.id, 'open', initialContext);

    this.logger.log(`Created checkout session: ${session.id}`);

    return session;
  }

  async getSession(sessionId: string): Promise<CheckoutSession> {
    const session = await this.prisma.checkoutSession.findUnique({
      where: { id: sessionId },
      include: {
        page: true,
        customer: true,
        coupon: true,
        paymentAttempts: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Checkout session not found');
    }

    return session;
  }

  async updateSession(
    sessionId: string,
    data: Partial<{
      customerEmail: string;
      customerFirstName: string;
      customerLastName: string;
      selectedVariants: Record<string, string>;
      customFieldValues: Record<string, string>;
      amount: number;
    }>,
  ): Promise<CheckoutSession> {
    const session = await this.getSession(sessionId);

    if (session.status !== 'OPEN') {
      throw new BadRequestException('Cannot update session in current state');
    }

    if (new Date() > session.expiresAt) {
      await this.sendEvent(sessionId, { type: 'TIMEOUT' });
      throw new BadRequestException('Session has expired');
    }

    // Update database
    const updateData: Prisma.CheckoutSessionUpdateInput = {};

    if (data.selectedVariants !== undefined) {
      updateData.selectedVariants = data.selectedVariants;
    }
    if (data.amount !== undefined) {
      updateData.amount = new Decimal(data.amount);
    }

    const updatedSession = await this.prisma.checkoutSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    // Update custom field values
    if (data.customFieldValues) {
      for (const [fieldId, value] of Object.entries(data.customFieldValues)) {
        // Find existing value
        const existing = await this.prisma.customFieldValue.findFirst({
          where: {
            customFieldId: fieldId,
            checkoutSessionId: sessionId,
          },
        });

        if (existing) {
          await this.prisma.customFieldValue.update({
            where: { id: existing.id },
            data: { value: String(value) },
          });
        } else {
          await this.prisma.customFieldValue.create({
            data: {
              customFieldId: fieldId,
              checkoutSessionId: sessionId,
              value: String(value),
            },
          });
        }
      }
    }

    // Send update event to state machine
    await this.sendEvent(sessionId, {
      type: 'UPDATE_SESSION',
      data: {
        customerEmail: data.customerEmail,
        selectedVariants: data.selectedVariants,
        customFieldValues: data.customFieldValues,
        amount: data.amount,
      },
    });

    return updatedSession;
  }

  async sendEvent(
    sessionId: string,
    event: CheckoutSessionEvent,
  ): Promise<{ state: CheckoutSessionState; context: CheckoutSessionContext }> {
    // Load current state
    const storedState = await this.loadState(sessionId);

    // Get current state and context
    const currentState = storedState?.value || 'open';
    const currentContext = storedState?.context || (await this.getDefaultContext(sessionId));

    // Process event based on current state (simplified state machine logic)
    const { newState, newContext } = this.processEvent(
      currentState as CheckoutSessionState,
      currentContext,
      event,
    );

    // Save state
    await this.saveState(sessionId, newState, newContext);

    // Update database status if changed
    if (newState !== currentState) {
      await this.syncDatabaseStatus(sessionId, newState, newContext);
    }

    this.logger.debug(`Session ${sessionId}: ${event.type} -> ${newState}`);

    return { state: newState, context: newContext };
  }

  private async getDefaultContext(sessionId: string): Promise<CheckoutSessionContext> {
    const session = await this.getSession(sessionId);
    return this.reconstructContext(session);
  }

  private processEvent(
    currentState: CheckoutSessionState,
    context: CheckoutSessionContext,
    event: CheckoutSessionEvent,
  ): { newState: CheckoutSessionState; newContext: CheckoutSessionContext } {
    let newState = currentState;
    let newContext = { ...context };

    switch (currentState) {
      case 'open':
        if (event.type === 'UPDATE_SESSION') {
          newContext = { ...newContext, ...event.data, error: null };
        } else if (event.type === 'INITIATE_PAYMENT') {
          if (this.isValidForPayment(context)) {
            newState = 'processing';
          } else {
            newContext.error = 'Validation failed: missing required fields or session expired';
          }
        } else if (event.type === 'TIMEOUT') {
          newState = 'expired';
        } else if (event.type === 'ABANDON' || event.type === 'CANCEL') {
          newState = 'abandoned';
        }
        break;

      case 'processing':
        if (event.type === 'PAYMENT_SUCCEEDED') {
          if (this.isAmountValid(context, event.amount)) {
            newState = 'completed';
          } else {
            newContext.error = 'Amount mismatch between session and payment';
            newState = 'open';
          }
        } else if (event.type === 'PAYMENT_FAILED') {
          newContext = this.recordFailure(newContext, event.failureCode, event.failureMessage);
          if (this.canRetry(newContext)) {
            newState = 'open';
          } else {
            newState = 'expired';
          }
        } else if (event.type === 'REQUIRES_ACTION') {
          newState = 'awaiting_action';
          newContext.redirectUrl = event.redirectUrl;
        } else if (event.type === 'TIMEOUT') {
          newState = 'expired';
        }
        break;

      case 'awaiting_action':
        if (event.type === 'ACTION_COMPLETED') {
          newState = 'processing';
          newContext.redirectUrl = null;
        } else if (event.type === 'ACTION_FAILED') {
          newContext = this.recordFailure(newContext, 'action_failed', event.failureReason);
          newContext.redirectUrl = null;
          if (this.canRetry(newContext)) {
            newState = 'open';
          } else {
            newState = 'expired';
          }
        } else if (event.type === 'TIMEOUT') {
          newState = 'expired';
        } else if (event.type === 'ABANDON') {
          newState = 'abandoned';
        }
        break;

      // Final states - no transitions
      case 'completed':
      case 'expired':
      case 'abandoned':
        break;
    }

    return { newState, newContext };
  }

  private isValidForPayment(context: CheckoutSessionContext): boolean {
    if (!context.customerEmail && !context.customerId) return false;
    if (!context.amount || context.amount <= 0) return false;
    if (Date.now() > context.expiresAt) return false;
    return true;
  }

  private canRetry(context: CheckoutSessionContext): boolean {
    if (context.attempts.length >= 3) return false;
    if (Date.now() > context.expiresAt) return false;
    const lastAttempt = context.attempts[context.attempts.length - 1];
    if (lastAttempt) {
      const nonRetryableCodes = ['card_declined_fraud', 'stolen_card', 'lost_card'];
      if (nonRetryableCodes.includes(lastAttempt.failureCode || '')) return false;
    }
    return true;
  }

  private isAmountValid(context: CheckoutSessionContext, paymentAmount: number): boolean {
    const tolerance = 0.01;
    return Math.abs(context.amount - paymentAmount) <= tolerance;
  }

  private recordFailure(
    context: CheckoutSessionContext,
    failureCode: string,
    failureMessage: string,
  ): CheckoutSessionContext {
    const newAttempt = {
      id: `attempt_${context.attempts.length + 1}`,
      attemptNumber: context.attempts.length + 1,
      status: 'FAILED',
      failureCode,
      failureMessage,
    };
    return {
      ...context,
      attempts: [...context.attempts, newAttempt],
      error: failureMessage,
    };
  }

  async getSessionState(
    sessionId: string,
  ): Promise<{ state: CheckoutSessionState; context: CheckoutSessionContext }> {
    const storedState = await this.loadState(sessionId);

    if (!storedState) {
      // Reconstruct from database
      const session = await this.getSession(sessionId);
      const context = await this.reconstructContext(session);
      const state = session.status.toLowerCase() as CheckoutSessionState;

      await this.saveState(sessionId, state, context);

      return { state, context };
    }

    return {
      state: storedState.value as CheckoutSessionState,
      context: storedState.context,
    };
  }

  async handleWebhookEvent(provider: string, eventType: string, payload: any): Promise<void> {
    const sessionId = payload.metadata?.checkoutSessionId;
    if (!sessionId) {
      this.logger.warn('Webhook missing checkoutSessionId in metadata');
      return;
    }

    const event = this.mapWebhookToEvent(provider, eventType, payload);
    if (!event) {
      this.logger.debug(`Ignoring webhook event: ${provider}/${eventType}`);
      return;
    }

    await this.sendEvent(sessionId, event);
  }

  async expireSessions(): Promise<number> {
    const expiredSessions = await this.prisma.checkoutSession.findMany({
      where: {
        status: { in: ['OPEN', 'PROCESSING', 'AWAITING_ACTION'] },
        expiresAt: { lt: new Date() },
      },
      select: { id: true },
    });

    for (const session of expiredSessions) {
      try {
        await this.sendEvent(session.id, { type: 'TIMEOUT' });
      } catch (error) {
        this.logger.error(`Failed to expire session ${session.id}`, error);
      }
    }

    return expiredSessions.length;
  }

  private async saveState(
    sessionId: string,
    state: string,
    context: CheckoutSessionContext,
  ): Promise<void> {
    const redisKey = `${this.REDIS_PREFIX}${sessionId}:state`;
    const data: StoredState = { value: state, context };
    await this.redis.setJson(redisKey, data, this.STATE_TTL);
  }

  private async loadState(sessionId: string): Promise<StoredState | null> {
    const redisKey = `${this.REDIS_PREFIX}${sessionId}:state`;
    return this.redis.getJson<StoredState>(redisKey);
  }

  private async syncDatabaseStatus(
    sessionId: string,
    state: CheckoutSessionState,
    context: CheckoutSessionContext,
  ): Promise<void> {
    const statusMap: Record<CheckoutSessionState, CheckoutSessionStatus> = {
      open: 'OPEN',
      processing: 'PROCESSING',
      awaiting_action: 'AWAITING_ACTION',
      completed: 'COMPLETED',
      expired: 'EXPIRED',
      abandoned: 'ABANDONED',
    };

    const updateData: Prisma.CheckoutSessionUpdateInput = {
      status: statusMap[state],
    };

    if (state === 'completed') {
      updateData.completedAt = new Date();
      if (context.paymentId) {
        updateData.payment = { connect: { id: context.paymentId } };
      }
    }

    if (state === 'abandoned') {
      updateData.abandonedAt = new Date();
    }

    await this.prisma.checkoutSession.update({
      where: { id: sessionId },
      data: updateData,
    });
  }

  private async reconstructContext(
    session: CheckoutSession & { paymentAttempts?: any[] },
  ): Promise<CheckoutSessionContext> {
    const customFieldValues = await this.prisma.customFieldValue.findMany({
      where: { checkoutSessionId: session.id },
    });

    const cfvMap: Record<string, string> = {};
    for (const cfv of customFieldValues) {
      cfvMap[cfv.customFieldId] = cfv.value;
    }

    return {
      sessionId: session.id,
      storeId: session.storeId,
      pageId: session.pageId,
      customerId: session.customerId,
      customerEmail: null, // Would need to join with customer
      amount: Number(session.amount),
      currency: session.currency,
      selectedVariants: (session.selectedVariants as Record<string, string>) || {},
      customFieldValues: cfvMap,
      couponId: session.couponId,
      discountAmount: Number(session.discountAmount),
      paymentId: session.paymentId,
      attempts:
        session.paymentAttempts?.map((a) => ({
          id: a.id,
          attemptNumber: a.attemptNumber,
          status: a.status,
          failureCode: a.failureCode,
          failureMessage: a.failureMessage,
          requires3DS: a.requires3DS,
          redirectUrl: a.redirectUrl,
        })) || [],
      error: null,
      redirectUrl: null,
      expiresAt: session.expiresAt.getTime(),
    };
  }

  private mapWebhookToEvent(
    provider: string,
    eventType: string,
    payload: any,
  ): CheckoutSessionEvent | null {
    if (provider === 'stripe') {
      switch (eventType) {
        case 'payment_intent.succeeded':
          return {
            type: 'PAYMENT_SUCCEEDED',
            providerPaymentId: payload.id,
            amount: payload.amount / 100, // Stripe uses cents
            providerData: payload,
          };

        case 'payment_intent.payment_failed':
          return {
            type: 'PAYMENT_FAILED',
            failureCode: payload.last_payment_error?.code || 'unknown',
            failureMessage: payload.last_payment_error?.message || 'Payment failed',
          };

        case 'payment_intent.requires_action':
          return {
            type: 'REQUIRES_ACTION',
            actionType: payload.next_action?.type || '3ds',
            redirectUrl: payload.next_action?.redirect_to_url?.url || '',
          };

        case 'payment_intent.canceled':
          return {
            type: 'CANCEL',
          };

        default:
          return null;
      }
    }

    return null;
  }
}
