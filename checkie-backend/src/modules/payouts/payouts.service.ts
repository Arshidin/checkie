import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BalanceService } from '../balance/balance.service';
import { encryptObject, decryptObject } from '../../common/utils/crypto.util';
import {
  Payout,
  PayoutStatus,
  PayoutMethod,
  Currency,
  Prisma,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CreatePayoutDto, BankAccountDestination } from './dto';

export interface CreatePayoutParams {
  storeId: string;
  amount: number;
  currency: Currency;
  method: PayoutMethod;
  destination: BankAccountDestination;
}

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);
  private readonly encryptionKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceService: BalanceService,
    private readonly config: ConfigService,
  ) {
    this.encryptionKey = config.get<string>('ENCRYPTION_KEY', '');
  }

  async createPayout(params: CreatePayoutParams): Promise<Payout> {
    // Check available balance
    const balance = await this.balanceService.getBalance(
      params.storeId,
      params.currency,
    );
    const availableBalance = Number(balance.balance);

    if (params.amount > availableBalance) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${availableBalance} ${params.currency}, Requested: ${params.amount} ${params.currency}`,
      );
    }

    // Check for minimum payout amount
    const minPayoutAmount = 10;
    if (params.amount < minPayoutAmount) {
      throw new BadRequestException(
        `Minimum payout amount is ${minPayoutAmount} ${params.currency}`,
      );
    }

    // Check for pending payouts
    const pendingPayout = await this.prisma.payout.findFirst({
      where: {
        storeId: params.storeId,
        status: { in: ['PENDING', 'PROCESSING', 'IN_TRANSIT'] },
      },
    });

    if (pendingPayout) {
      throw new BadRequestException(
        'You already have a pending payout. Please wait for it to complete before requesting another.',
      );
    }

    // Encrypt destination data
    const encryptedDestination = encryptObject(
      params.destination,
      this.encryptionKey,
    );

    // Create payout record
    const payout = await this.prisma.payout.create({
      data: {
        storeId: params.storeId,
        amount: new Decimal(params.amount),
        currency: params.currency,
        status: 'PENDING',
        method: params.method,
        destinationEncrypted: encryptedDestination.encrypted,
        destinationIV: encryptedDestination.iv,
        destinationKeyId: encryptedDestination.keyId,
      },
    });

    // Add balance transaction (reserve the funds)
    await this.balanceService.addTransaction({
      storeId: params.storeId,
      payoutId: payout.id,
      type: 'PAYOUT_REQUESTED',
      amount: new Decimal(params.amount).negated(),
      currency: params.currency,
      description: `Payout requested: ${params.amount} ${params.currency}`,
    });

    this.logger.log(
      `Payout created: ${payout.id}, amount: ${params.amount} ${params.currency}`,
    );

    return payout;
  }

  async processPayout(payoutId: string): Promise<Payout> {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.status !== 'PENDING') {
      throw new BadRequestException(
        `Payout is not in PENDING state. Current status: ${payout.status}`,
      );
    }

    // Update status to PROCESSING
    const updatedPayout = await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'PROCESSING',
        processedAt: new Date(),
      },
    });

    this.logger.log(`Payout ${payoutId} is now PROCESSING`);

    return updatedPayout;
  }

  async completePayout(
    payoutId: string,
    providerPayoutId?: string,
  ): Promise<Payout> {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (!['PROCESSING', 'IN_TRANSIT'].includes(payout.status)) {
      throw new BadRequestException(
        `Cannot complete payout in ${payout.status} state`,
      );
    }

    // Update payout status
    const updatedPayout = await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        providerPayoutId,
      },
    });

    // Add balance transaction for completion
    await this.balanceService.addTransaction({
      storeId: payout.storeId,
      payoutId: payout.id,
      type: 'PAYOUT_COMPLETED',
      amount: new Decimal(0),
      currency: payout.currency,
      description: `Payout completed: ${payout.amount} ${payout.currency}`,
    });

    this.logger.log(`Payout ${payoutId} completed successfully`);

    return updatedPayout;
  }

  async failPayout(payoutId: string, reason: string): Promise<Payout> {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (!['PENDING', 'PROCESSING', 'IN_TRANSIT'].includes(payout.status)) {
      throw new BadRequestException(
        `Cannot fail payout in ${payout.status} state`,
      );
    }

    // Update payout status
    const updatedPayout = await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: reason,
      },
    });

    // Reverse the balance transaction (return funds to available balance)
    await this.balanceService.addTransaction({
      storeId: payout.storeId,
      payoutId: payout.id,
      type: 'ADJUSTMENT',
      amount: payout.amount,
      currency: payout.currency,
      description: `Payout failed - funds returned: ${payout.amount} ${payout.currency}. Reason: ${reason}`,
    });

    this.logger.warn(`Payout ${payoutId} failed: ${reason}`);

    return updatedPayout;
  }

  async cancelPayout(payoutId: string, storeId: string): Promise<Payout> {
    const payout = await this.prisma.payout.findFirst({
      where: { id: payoutId, storeId },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.status !== 'PENDING') {
      throw new BadRequestException(
        'Can only cancel payouts in PENDING state',
      );
    }

    // Update payout status
    const updatedPayout = await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'CANCELLED',
      },
    });

    // Reverse the balance transaction
    await this.balanceService.addTransaction({
      storeId: payout.storeId,
      payoutId: payout.id,
      type: 'ADJUSTMENT',
      amount: payout.amount,
      currency: payout.currency,
      description: `Payout cancelled - funds returned: ${payout.amount} ${payout.currency}`,
    });

    this.logger.log(`Payout ${payoutId} cancelled`);

    return updatedPayout;
  }

  async findByStore(
    storeId: string,
    filters?: {
      status?: PayoutStatus;
      method?: PayoutMethod;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    },
  ) {
    const where: Prisma.PayoutWhereInput = {
      storeId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.method && { method: filters.method }),
      ...((filters?.startDate || filters?.endDate) && {
        requestedAt: {
          ...(filters?.startDate && { gte: filters.startDate }),
          ...(filters?.endDate && { lte: filters.endDate }),
        },
      }),
    };

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;

    const [payouts, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        include: {
          balanceTransactions: true,
        },
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payout.count({ where }),
    ]);

    // Remove encrypted destination data from response
    const sanitizedPayouts = payouts.map((p) => ({
      ...p,
      destinationEncrypted: undefined,
      destinationIV: undefined,
      destinationKeyId: undefined,
    }));

    return {
      data: sanitizedPayouts,
      meta: { total, page, limit, hasMore: total > page * limit },
    };
  }

  async findById(payoutId: string, storeId: string): Promise<Payout> {
    const payout = await this.prisma.payout.findFirst({
      where: { id: payoutId, storeId },
      include: {
        balanceTransactions: true,
      },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    return payout;
  }

  async getPayoutDestination(
    payoutId: string,
    storeId: string,
  ): Promise<BankAccountDestination> {
    const payout = await this.prisma.payout.findFirst({
      where: { id: payoutId, storeId },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    return decryptObject<BankAccountDestination>(
      {
        encrypted: payout.destinationEncrypted,
        iv: payout.destinationIV,
        keyId: payout.destinationKeyId,
      },
      this.encryptionKey,
    );
  }
}
