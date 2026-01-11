export enum WebhookEventType {
  // Payment events
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',
  PAYMENT_PARTIALLY_REFUNDED = 'payment.partially_refunded',

  // Subscription events
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_ACTIVATED = 'subscription.activated',
  SUBSCRIPTION_RENEWED = 'subscription.renewed',
  SUBSCRIPTION_PAUSED = 'subscription.paused',
  SUBSCRIPTION_RESUMED = 'subscription.resumed',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  SUBSCRIPTION_EXPIRED = 'subscription.expired',
  SUBSCRIPTION_PAYMENT_FAILED = 'subscription.payment_failed',

  // Refund events
  REFUND_CREATED = 'refund.created',
  REFUND_COMPLETED = 'refund.completed',
  REFUND_FAILED = 'refund.failed',

  // Payout events
  PAYOUT_CREATED = 'payout.created',
  PAYOUT_COMPLETED = 'payout.completed',
  PAYOUT_FAILED = 'payout.failed',

  // Customer events
  CUSTOMER_CREATED = 'customer.created',
  CUSTOMER_UPDATED = 'customer.updated',

  // Checkout events
  CHECKOUT_COMPLETED = 'checkout.completed',
  CHECKOUT_ABANDONED = 'checkout.abandoned',
}

export const ALL_WEBHOOK_EVENT_TYPES = Object.values(WebhookEventType);

export const WEBHOOK_EVENT_DESCRIPTIONS: Record<WebhookEventType, string> = {
  [WebhookEventType.PAYMENT_COMPLETED]: 'A payment was successfully completed',
  [WebhookEventType.PAYMENT_FAILED]: 'A payment attempt failed',
  [WebhookEventType.PAYMENT_REFUNDED]: 'A payment was fully refunded',
  [WebhookEventType.PAYMENT_PARTIALLY_REFUNDED]: 'A payment was partially refunded',
  [WebhookEventType.SUBSCRIPTION_CREATED]: 'A new subscription was created',
  [WebhookEventType.SUBSCRIPTION_ACTIVATED]: 'A subscription became active',
  [WebhookEventType.SUBSCRIPTION_RENEWED]: 'A subscription was renewed',
  [WebhookEventType.SUBSCRIPTION_PAUSED]: 'A subscription was paused',
  [WebhookEventType.SUBSCRIPTION_RESUMED]: 'A subscription was resumed',
  [WebhookEventType.SUBSCRIPTION_CANCELLED]: 'A subscription was cancelled',
  [WebhookEventType.SUBSCRIPTION_EXPIRED]: 'A subscription expired',
  [WebhookEventType.SUBSCRIPTION_PAYMENT_FAILED]: 'A subscription payment failed',
  [WebhookEventType.REFUND_CREATED]: 'A refund was requested',
  [WebhookEventType.REFUND_COMPLETED]: 'A refund was successfully processed',
  [WebhookEventType.REFUND_FAILED]: 'A refund attempt failed',
  [WebhookEventType.PAYOUT_CREATED]: 'A payout was requested',
  [WebhookEventType.PAYOUT_COMPLETED]: 'A payout was completed',
  [WebhookEventType.PAYOUT_FAILED]: 'A payout failed',
  [WebhookEventType.CUSTOMER_CREATED]: 'A new customer was created',
  [WebhookEventType.CUSTOMER_UPDATED]: 'A customer was updated',
  [WebhookEventType.CHECKOUT_COMPLETED]: 'A checkout session was completed',
  [WebhookEventType.CHECKOUT_ABANDONED]: 'A checkout session was abandoned',
};
