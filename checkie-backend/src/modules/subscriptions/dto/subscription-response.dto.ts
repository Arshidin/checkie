import { SubscriptionStatus, SubscriptionInterval, Currency } from '@prisma/client';

export class SubscriptionResponseDto {
  id!: string;
  storeId!: string;
  pageId!: string;
  customerId!: string;
  status!: SubscriptionStatus;
  amount!: string;
  currency!: Currency;
  interval!: SubscriptionInterval;
  intervalCount!: number;
  trialEndAt?: Date;
  currentPeriodStart!: Date;
  currentPeriodEnd!: Date;
  cancelledAt?: Date;
  cancelAtPeriodEnd!: boolean;
  paymentProvider!: string;
  providerSubscriptionId?: string;
  createdAt!: Date;
  updatedAt!: Date;

  customer?: {
    id: string;
    email: string;
  };

  page?: {
    id: string;
    name: string;
    slug: string;
  };
}

export class SubscriptionListResponseDto {
  data!: SubscriptionResponseDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}
