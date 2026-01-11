import { RefundStatus, RefundReason, Currency } from '@prisma/client';

export interface RefundResponseDto {
  id: string;
  paymentId: string;
  amount: number;
  currency: Currency;
  reason: RefundReason;
  reasonDetails?: string;
  status: RefundStatus;
  providerRefundId?: string;
  requestedBy?: string;
  createdAt: Date;
  processedAt?: Date;
}

export interface RefundListResponseDto {
  data: RefundResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}
