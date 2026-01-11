import { PayoutStatus, PayoutMethod, Currency } from '@prisma/client';

export interface PayoutResponseDto {
  id: string;
  storeId: string;
  amount: number;
  currency: Currency;
  status: PayoutStatus;
  method: PayoutMethod;
  providerPayoutId?: string;
  requestedAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
}

export interface PayoutListResponseDto {
  data: PayoutResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}
