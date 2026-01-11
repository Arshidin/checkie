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

export interface PaymentProvider {
  readonly code: string;

  createPaymentIntent(
    params: CreatePaymentIntentParams,
  ): Promise<PaymentIntentResult>;
  retrievePaymentIntent(id: string): Promise<PaymentIntentResult>;
  confirmPaymentIntent(params: ConfirmPaymentParams): Promise<PaymentIntentResult>;
  cancelPaymentIntent(id: string): Promise<void>;

  createRefund(params: RefundParams): Promise<RefundResult>;

  createCustomer(
    email: string,
    metadata?: Record<string, string>,
  ): Promise<string>;

  constructWebhookEvent(payload: Buffer, signature: string): WebhookEventResult;
}
