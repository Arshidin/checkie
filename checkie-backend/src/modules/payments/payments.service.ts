import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProviderFactory } from '../providers/provider.factory';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentStatus, Prisma, Currency } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface InitiatePaymentParams {
  checkoutSessionId: string;
  paymentMethodId?: string;
  returnUrl?: string;
}

export interface InitiatePaymentResult {
  paymentId: string;
  clientSecret: string;
  status: string;
  requiresAction: boolean;
  nextActionUrl?: string;
}

export interface AddBalanceTransactionParams {
  storeId: string;
  paymentId?: string;
  refundId?: string;
  payoutId?: string;
  type:
    | 'PAYMENT_RECEIVED'
    | 'REFUND'
    | 'PAYOUT_REQUESTED'
    | 'PAYOUT_COMPLETED'
    | 'ADJUSTMENT'
    | 'FEE';
  amount: Decimal | number;
  currency: Currency;
  description?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly platformFeePercent: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: ProviderFactory,
    private readonly config: ConfigService,
  ) {
    this.platformFeePercent = config.get<number>('platform.feePercent', 0.029);
  }

  async initiatePayment(
    params: InitiatePaymentParams,
  ): Promise<InitiatePaymentResult> {
    const session = await this.prisma.checkoutSession.findUnique({
      where: { id: params.checkoutSessionId },
      include: {
        customer: true,
        page: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Checkout session not found');
    }

    if (session.status !== 'OPEN') {
      throw new BadRequestException('Session is not in OPEN state');
    }

    // Create Payment record
    const payment = await this.createPayment(session);

    // Create PaymentAttempt
    const attempt = await this.createPaymentAttempt(payment.id, session.id);

    // Get provider and create PaymentIntent
    const provider = this.providerFactory.getDefaultProvider();

    const intentResult = await provider.createPaymentIntent({
      amount: Number(session.amount) - Number(session.discountAmount),
      currency: session.currency,
      customerEmail: session.customer?.email,
      metadata: {
        storeId: session.storeId,
        pageId: session.pageId,
        checkoutSessionId: session.id,
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

    // Update checkout session status
    await this.prisma.checkoutSession.update({
      where: { id: session.id },
      data: {
        status: intentResult.requiresAction ? 'AWAITING_ACTION' : 'PROCESSING',
      },
    });

    return {
      paymentId: payment.id,
      clientSecret: intentResult.clientSecret,
      status: intentResult.status,
      requiresAction: intentResult.requiresAction,
      nextActionUrl: intentResult.nextActionUrl,
    };
  }

  async handleWebhookEvent(
    provider: string,
    eventType: string,
    data: any,
    metadata: Record<string, string>,
  ): Promise<void> {
    const { checkoutSessionId, paymentId } = metadata;

    if (!paymentId) {
      this.logger.warn(`Webhook missing paymentId in metadata`);
      return;
    }

    this.logger.log(`Webhook: ${provider}/${eventType} for payment ${paymentId}`);

    switch (eventType) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(paymentId, checkoutSessionId, data);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(paymentId, checkoutSessionId, data);
        break;

      case 'payment_intent.canceled':
        await this.handlePaymentCanceled(paymentId, checkoutSessionId);
        break;

      default:
        this.logger.debug(`Unhandled webhook event: ${eventType}`);
    }
  }

  private async handlePaymentSuccess(
    paymentId: string,
    checkoutSessionId: string,
    providerData: any,
  ): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { store: true },
    });

    if (!payment || payment.status === 'COMPLETED') {
      return;
    }

    const amount = Number(payment.amount);
    const platformFee = new Decimal(amount * this.platformFeePercent);
    const processingFee = new Decimal(0);
    const netAmount = new Decimal(amount).minus(platformFee).minus(processingFee);

    // Update payment
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'COMPLETED',
        platformFee,
        processingFee,
        netAmount,
        completedAt: new Date(),
        providerData,
      },
    });

    // Update last attempt
    await this.prisma.paymentAttempt.updateMany({
      where: {
        paymentId,
        status: { in: ['PENDING', 'PROCESSING', 'REQUIRES_ACTION'] },
      },
      data: { status: 'SUCCEEDED', completedAt: new Date() },
    });

    // Add balance transactions
    await this.addBalanceTransaction({
      storeId: payment.storeId,
      paymentId: payment.id,
      type: 'PAYMENT_RECEIVED',
      amount: netAmount,
      currency: payment.currency,
      description: `Payment received`,
    });

    await this.addBalanceTransaction({
      storeId: payment.storeId,
      paymentId: payment.id,
      type: 'FEE',
      amount: platformFee.negated(),
      currency: payment.currency,
      description: `Platform fee (${this.platformFeePercent * 100}%)`,
    });

    // Update checkout session
    if (checkoutSessionId) {
      await this.prisma.checkoutSession.update({
        where: { id: checkoutSessionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          paymentId: payment.id,
        },
      });
    }

    this.logger.log(`Payment ${paymentId} completed successfully`);
  }

  private async handlePaymentFailure(
    paymentId: string,
    checkoutSessionId: string,
    providerData: any,
  ): Promise<void> {
    const failureCode = providerData.last_payment_error?.code || 'unknown';
    const failureMessage =
      providerData.last_payment_error?.message || 'Payment failed';

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'FAILED', providerData },
    });

    await this.prisma.paymentAttempt.updateMany({
      where: {
        paymentId,
        status: { in: ['PENDING', 'PROCESSING', 'REQUIRES_ACTION'] },
      },
      data: {
        status: 'FAILED',
        failureCode,
        failureMessage,
        completedAt: new Date(),
      },
    });

    if (checkoutSessionId) {
      await this.prisma.checkoutSession.update({
        where: { id: checkoutSessionId },
        data: { status: 'OPEN' },
      });
    }

    this.logger.warn(`Payment ${paymentId} failed: ${failureMessage}`);
  }

  private async handlePaymentCanceled(
    paymentId: string,
    checkoutSessionId: string,
  ): Promise<void> {
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'CANCELLED' },
    });

    if (checkoutSessionId) {
      await this.prisma.checkoutSession.update({
        where: { id: checkoutSessionId },
        data: { status: 'ABANDONED', abandonedAt: new Date() },
      });
    }
  }

  private async createPayment(session: any): Promise<Payment> {
    let customerId = session.customerId;

    if (!customerId && session.customer?.email) {
      const customer = await this.prisma.customer.upsert({
        where: {
          storeId_email: {
            storeId: session.storeId,
            email: session.customer.email,
          },
        },
        create: {
          storeId: session.storeId,
          email: session.customer.email,
        },
        update: {},
      });
      customerId = customer.id;
    }

    if (!customerId) {
      throw new BadRequestException('Customer information required');
    }

    return this.prisma.payment.create({
      data: {
        storeId: session.storeId,
        pageId: session.pageId,
        customerId,
        amount: session.amount,
        currency: session.currency,
        status: 'PENDING',
        paymentProvider: 'stripe',
        couponId: session.couponId,
        discountAmount: session.discountAmount,
      },
    });
  }

  private async createPaymentAttempt(paymentId: string, sessionId: string) {
    const existingAttempts = await this.prisma.paymentAttempt.count({
      where: { paymentId },
    });

    return this.prisma.paymentAttempt.create({
      data: {
        paymentId,
        checkoutSessionId: sessionId,
        attemptNumber: existingAttempts + 1,
        providerId: 'stripe',
        status: 'PENDING',
      },
    });
  }

  async addBalanceTransaction(params: AddBalanceTransactionParams) {
    return this.prisma.$transaction(async (tx) => {
      const lastTx = await tx.balanceTransaction.findFirst({
        where: { storeId: params.storeId, currency: params.currency },
        orderBy: { createdAt: 'desc' },
      });

      const currentBalance = lastTx?.balanceAfter ?? new Decimal(0);
      const amount = new Decimal(params.amount);
      const balanceAfter = currentBalance.plus(amount);

      if (params.type === 'PAYOUT_REQUESTED' && balanceAfter.lessThan(0)) {
        throw new BadRequestException('Insufficient balance for payout');
      }

      return tx.balanceTransaction.create({
        data: {
          storeId: params.storeId,
          paymentId: params.paymentId,
          refundId: params.refundId,
          payoutId: params.payoutId,
          type: params.type,
          amount,
          currency: params.currency,
          balanceAfter,
          description: params.description,
          metadata: params.metadata,
        },
      });
    });
  }

  async findByStore(
    storeId: string,
    filters?: {
      status?: PaymentStatus;
      pageId?: string;
      customerId?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    },
  ) {
    const where: Prisma.PaymentWhereInput = {
      storeId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.pageId && { pageId: filters.pageId }),
      ...(filters?.customerId && { customerId: filters.customerId }),
      ...((filters?.startDate || filters?.endDate) && {
        createdAt: {
          ...(filters?.startDate && { gte: filters.startDate }),
          ...(filters?.endDate && { lte: filters.endDate }),
        },
      }),
    };

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: { customer: true, page: true, coupon: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments,
      meta: { total, page, limit, hasMore: total > page * limit },
    };
  }

  async findById(paymentId: string, storeId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, storeId },
      include: {
        customer: true,
        page: true,
        coupon: true,
        attempts: { orderBy: { createdAt: 'desc' } },
        customFieldValues: { include: { customField: true } },
        refunds: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }
}
