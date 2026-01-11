import { CheckoutSessionStatus, Currency } from '@prisma/client';

export class CheckoutSessionResponseDto {
  id!: string;
  storeId!: string;
  pageId!: string;
  customerId!: string | null;
  status!: CheckoutSessionStatus;
  amount!: number;
  currency!: Currency;
  discountAmount!: number;
  selectedVariants!: Record<string, string> | null;
  expiresAt!: Date;
  paymentId!: string | null;
  completedAt!: Date | null;
  error!: string | null;
  redirectUrl!: string | null;
  attemptsCount!: number;
  canRetry!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

export class InitiatePaymentResponseDto {
  sessionId!: string;
  status!: string;
  clientSecret?: string;
  redirectUrl?: string;
  requiresAction!: boolean;
  paymentId?: string;
  subscriptionId?: string;
  error?: string;
}

export class SessionStatusResponseDto {
  sessionId!: string;
  status!: CheckoutSessionStatus;
  paymentId!: string | null;
  completedAt!: Date | null;
  error!: string | null;
}
