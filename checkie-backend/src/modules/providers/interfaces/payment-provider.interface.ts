export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  customerId?: string;
  customerEmail?: string;
  metadata: {
    storeId: string;
    pageId: string;
    checkoutSessionId: string;
    paymentId: string;
  };
  paymentMethodTypes?: string[];
  setupFutureUsage?: 'on_session' | 'off_session';
  statementDescriptor?: string;
}

export interface PaymentIntentResult {
  id: string;
  clientSecret: string;
  status: PaymentIntentStatus;
  amount: number;
  currency: string;
  requiresAction: boolean;
  nextActionType?: string;
  nextActionUrl?: string;
}

export type PaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'canceled';

export interface ConfirmPaymentParams {
  paymentIntentId: string;
  paymentMethodId?: string;
  returnUrl?: string;
}

export interface RefundParams {
  paymentIntentId: string;
  amount?: number;
  reason?: 'requested_by_customer' | 'duplicate' | 'fraudulent';
  metadata?: Record<string, string>;
}

export interface RefundResult {
  id: string;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';
  amount: number;
  currency: string;
}

export interface WebhookEventResult {
  type: string;
  id: string;
  data: any;
  metadata?: Record<string, string>;
}

// ==================== Subscription Interfaces ====================

export interface CreateSubscriptionParams {
  customerId: string;
  priceId?: string;
  amount: number;
  currency: string;
  interval: 'day' | 'week' | 'month' | 'year';
  intervalCount?: number;
  trialPeriodDays?: number;
  metadata: {
    storeId: string;
    pageId: string;
    subscriptionId: string;
  };
  paymentMethodId?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface SubscriptionResult {
  id: string;
  status: SubscriptionStatus;
  customerId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  latestInvoiceId?: string;
  latestInvoiceStatus?: string;
  clientSecret?: string;
}

export type SubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

export interface UpdateSubscriptionParams {
  subscriptionId: string;
  cancelAtPeriodEnd?: boolean;
  priceId?: string;
  metadata?: Record<string, string>;
}

export interface InvoiceResult {
  id: string;
  subscriptionId: string;
  customerId: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  amountDue: number;
  amountPaid: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  paymentIntentId?: string;
}

export interface PaymentProvider {
  readonly code: string;

  // Payment Intents
  createPaymentIntent(
    params: CreatePaymentIntentParams,
  ): Promise<PaymentIntentResult>;
  retrievePaymentIntent(id: string): Promise<PaymentIntentResult>;
  confirmPaymentIntent(params: ConfirmPaymentParams): Promise<PaymentIntentResult>;
  cancelPaymentIntent(id: string): Promise<void>;

  // Refunds
  createRefund(params: RefundParams): Promise<RefundResult>;

  // Customers
  createCustomer(
    email: string,
    metadata?: Record<string, string>,
  ): Promise<string>;

  // Subscriptions
  createSubscription(params: CreateSubscriptionParams): Promise<SubscriptionResult>;
  retrieveSubscription(id: string): Promise<SubscriptionResult>;
  updateSubscription(params: UpdateSubscriptionParams): Promise<SubscriptionResult>;
  cancelSubscription(id: string, cancelImmediately?: boolean): Promise<SubscriptionResult>;
  pauseSubscription(id: string): Promise<SubscriptionResult>;
  resumeSubscription(id: string): Promise<SubscriptionResult>;

  // Webhooks
  constructWebhookEvent(payload: Buffer, signature: string): WebhookEventResult;
}
