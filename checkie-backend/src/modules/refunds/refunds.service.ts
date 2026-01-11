import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BalanceService } from '../balance/balance.service';
import { ProviderFactory } from '../providers/provider.factory';
import { Refund, RefundStatus, RefundReason, Prisma, Currency } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CreateRefundDto } from './dto';
import { WebhookEventsService } from '../webhooks/webhook-events.service';
import { WebhookEventType } from '../webhooks/dto/webhook-event-types';

export interface CreateRefundParams {
  paymentId: string;
  storeId: string;
  amount?: number;
  reason: RefundReason;
  reasonDetails?: string;
  requestedBy?: string;
}

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceService: BalanceService,
    private readonly providerFactory: ProviderFactory,
    @Inject(forwardRef(() => WebhookEventsService))
    private readonly webhookEventsService: WebhookEventsService,
  ) {}

  async createRefund(params: CreateRefundParams): Promise<Refund> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: params.paymentId, storeId: params.storeId },
      include: { refunds: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== 'COMPLETED') {
      throw new BadRequestException('Can only refund completed payments');
    }

    const paymentAmount = Number(payment.amount);
    const totalRefunded = await this.getTotalRefunded(params.paymentId);
    const refundAmount = params.amount ?? paymentAmount - totalRefunded;

    if (refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be positive');
    }

    if (totalRefunded + refundAmount > paymentAmount) {
      throw new BadRequestException(
        `Refund amount exceeds refundable balance. Payment: ${paymentAmount}, Already refunded: ${totalRefunded}, Requested: ${refundAmount}`,
      );
    }

    // Create refund in PSP
    const provider = this.providerFactory.getDefaultProvider();
    let providerRefundId: string | undefined;
    let providerData: any = {};

    try {
      const refundResult = await provider.createRefund({
        paymentIntentId: payment.providerPaymentId!,
        amount: refundAmount,
        reason: this.mapRefundReason(params.reason),
        metadata: {
          storeId: params.storeId,
          paymentId: params.paymentId,
        },
      });

      providerRefundId = refundResult.id;
      providerData = refundResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create refund with provider: ${errorMessage}`);
      throw new BadRequestException('Failed to process refund with payment provider');
    }

    // Create refund record
    const refund = await this.prisma.refund.create({
      data: {
        paymentId: params.paymentId,
        amount: new Decimal(refundAmount),
        currency: payment.currency,
        reason: params.reason,
        reasonDetails: params.reasonDetails,
        status: 'SUCCEEDED',
        providerRefundId,
        providerData,
        requestedBy: params.requestedBy,
        processedAt: new Date(),
      },
    });

    // Update balance (deduct the refund amount)
    await this.balanceService.addTransaction({
      storeId: params.storeId,
      refundId: refund.id,
      type: 'REFUND',
      amount: new Decimal(refundAmount).negated(),
      currency: payment.currency,
      description: `Refund for payment ${params.paymentId}`,
      metadata: {
        reason: params.reason,
        reasonDetails: params.reasonDetails,
      },
    });

    // Update payment status
    const newTotalRefunded = totalRefunded + refundAmount;
    const isFullyRefunded = Math.abs(newTotalRefunded - paymentAmount) < 0.01;

    await this.prisma.payment.update({
      where: { id: params.paymentId },
      data: {
        status: isFullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      },
    });

    this.logger.log(
      `Refund created: ${refund.id} for payment ${params.paymentId}, amount: ${refundAmount}`,
    );

    // Trigger webhook
    try {
      const eventType = isFullyRefunded
        ? WebhookEventType.PAYMENT_REFUNDED
        : WebhookEventType.PAYMENT_PARTIALLY_REFUNDED;

      await this.webhookEventsService.triggerRefundEvent(
        eventType,
        {
          id: refund.id,
          paymentId: params.paymentId,
          amount: refund.amount,
          currency: refund.currency,
          status: refund.status,
          reason: refund.reason,
        },
        params.storeId,
      );
    } catch (error: any) {
      this.logger.error(`Failed to trigger webhook: ${error.message}`);
    }

    return refund;
  }

  async getTotalRefunded(paymentId: string): Promise<number> {
    const result = await this.prisma.refund.aggregate({
      where: {
        paymentId,
        status: { in: ['SUCCEEDED', 'PROCESSING'] },
      },
      _sum: { amount: true },
    });

    return Number(result._sum.amount ?? 0);
  }

  async findByStore(
    storeId: string,
    filters?: {
      paymentId?: string;
      status?: RefundStatus;
      reason?: RefundReason;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    },
  ) {
    const where: Prisma.RefundWhereInput = {
      payment: { storeId },
      ...(filters?.paymentId && { paymentId: filters.paymentId }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.reason && { reason: filters.reason }),
      ...((filters?.startDate || filters?.endDate) && {
        createdAt: {
          ...(filters?.startDate && { gte: filters.startDate }),
          ...(filters?.endDate && { lte: filters.endDate }),
        },
      }),
    };

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;

    const [refunds, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        include: {
          payment: {
            include: {
              customer: true,
              page: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.refund.count({ where }),
    ]);

    return {
      data: refunds,
      meta: { total, page, limit, hasMore: total > page * limit },
    };
  }

  async findById(refundId: string, storeId: string): Promise<Refund> {
    const refund = await this.prisma.refund.findFirst({
      where: {
        id: refundId,
        payment: { storeId },
      },
      include: {
        payment: {
          include: {
            customer: true,
            page: true,
          },
        },
        balanceTransaction: true,
      },
    });

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    return refund;
  }

  async findByPayment(paymentId: string, storeId: string): Promise<Refund[]> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, storeId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.prisma.refund.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async handleWebhookEvent(
    eventType: string,
    data: any,
    metadata: Record<string, string>,
  ): Promise<void> {
    const { paymentId } = metadata;

    switch (eventType) {
      case 'charge.refunded':
      case 'refund.created':
        this.logger.log(`Refund webhook received for payment ${paymentId}`);
        break;

      case 'charge.refund.updated':
        await this.handleRefundUpdate(data);
        break;

      default:
        this.logger.debug(`Unhandled refund webhook event: ${eventType}`);
    }
  }

  private async handleRefundUpdate(data: any): Promise<void> {
    const providerRefundId = data.id;

    const refund = await this.prisma.refund.findFirst({
      where: { providerRefundId },
    });

    if (!refund) {
      this.logger.warn(`Refund not found for provider ID: ${providerRefundId}`);
      return;
    }

    const status = this.mapProviderStatus(data.status);

    await this.prisma.refund.update({
      where: { id: refund.id },
      data: {
        status,
        providerData: data,
        processedAt: status === 'SUCCEEDED' ? new Date() : undefined,
      },
    });
  }

  private mapRefundReason(
    reason: RefundReason,
  ): 'requested_by_customer' | 'duplicate' | 'fraudulent' | undefined {
    switch (reason) {
      case 'REQUESTED_BY_CUSTOMER':
        return 'requested_by_customer';
      case 'DUPLICATE':
        return 'duplicate';
      case 'FRAUDULENT':
        return 'fraudulent';
      default:
        return 'requested_by_customer';
    }
  }

  private mapProviderStatus(providerStatus: string): RefundStatus {
    switch (providerStatus) {
      case 'succeeded':
        return 'SUCCEEDED';
      case 'pending':
        return 'PROCESSING';
      case 'failed':
        return 'FAILED';
      case 'canceled':
        return 'CANCELLED';
      default:
        return 'PENDING';
    }
  }
}
