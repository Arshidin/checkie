import { Decimal } from '@prisma/client/runtime/library';
import {
  UserStatus,
  StoreUserRole,
  PageStatus,
  PricingType,
  CheckoutSessionStatus,
  PaymentStatus,
  SubscriptionStatus,
  RefundStatus,
  PayoutStatus,
  SubscriptionInterval,
  Currency,
  BalanceTransactionType,
} from '@prisma/client';

// User Factory
export function createMockUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    firstName: 'John',
    lastName: 'Doe',
    status: UserStatus.ACTIVE,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
    avatarUrl: null,
    ...overrides,
  };
}

// Store Factory
export function createMockStore(overrides: Record<string, any> = {}) {
  return {
    id: 'store-123',
    name: 'Test Store',
    slug: 'test-store',
    description: 'A test store',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    logoUrl: null,
    brandColor: '#000000',
    timezone: 'UTC',
    defaultCurrency: Currency.USD,
    providerConfig: null,
    ...overrides,
  };
}

// Page Factory
export function createMockPage(overrides: Record<string, any> = {}) {
  return {
    id: 'page-123',
    storeId: 'store-123',
    title: 'Test Product',
    slug: 'test-product',
    description: 'A test product',
    status: PageStatus.ACTIVE,
    pricingType: PricingType.FIXED,
    price: new Decimal(99.99),
    currency: Currency.USD,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: new Date(),
    subscriptionInterval: null,
    subscriptionIntervalCount: null,
    trialDays: null,
    minPrice: null,
    suggestedPrice: null,
    ...overrides,
  };
}

// Customer Factory
export function createMockCustomer(overrides: Record<string, any> = {}) {
  return {
    id: 'customer-123',
    storeId: 'store-123',
    email: 'customer@example.com',
    name: null,
    phone: null,
    providerCustomerId: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// CheckoutSession Factory
export function createMockCheckoutSession(overrides: Record<string, any> = {}) {
  return {
    id: 'session-123',
    storeId: 'store-123',
    pageId: 'page-123',
    customerId: null,
    status: CheckoutSessionStatus.OPEN,
    amount: new Decimal(99.99),
    currency: Currency.USD,
    discountAmount: new Decimal(0),
    couponId: null,
    selectedVariants: null,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    paymentId: null,
    subscriptionId: null,
    completedAt: null,
    abandonedAt: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Payment Factory
export function createMockPayment(overrides: Record<string, any> = {}) {
  return {
    id: 'payment-123',
    storeId: 'store-123',
    pageId: 'page-123',
    customerId: 'customer-123',
    amount: new Decimal(99.99),
    currency: Currency.USD,
    status: PaymentStatus.PENDING,
    paymentProvider: 'stripe',
    providerPaymentId: null,
    providerData: null,
    couponId: null,
    discountAmount: new Decimal(0),
    platformFee: new Decimal(2.90),
    processingFee: new Decimal(0),
    netAmount: new Decimal(97.09),
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// PaymentAttempt Factory
export function createMockPaymentAttempt(overrides: Record<string, any> = {}) {
  return {
    id: 'attempt-123',
    paymentId: 'payment-123',
    checkoutSessionId: 'session-123',
    attemptNumber: 1,
    providerId: 'stripe',
    providerAttemptId: null,
    status: 'PENDING',
    requires3DS: false,
    redirectUrl: null,
    failureCode: null,
    failureMessage: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Subscription Factory
export function createMockSubscription(overrides: Record<string, any> = {}) {
  return {
    id: 'subscription-123',
    storeId: 'store-123',
    pageId: 'page-123',
    customerId: 'customer-123',
    status: SubscriptionStatus.ACTIVE,
    amount: new Decimal(29.99),
    currency: Currency.USD,
    interval: SubscriptionInterval.MONTHLY,
    intervalCount: 1,
    providerSubscriptionId: 'sub_stripe_123',
    providerCustomerId: 'cus_stripe_123',
    providerData: null,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    trialEndsAt: null,
    canceledAt: null,
    cancelAtPeriodEnd: false,
    pausedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Refund Factory
export function createMockRefund(overrides: Record<string, any> = {}) {
  return {
    id: 'refund-123',
    paymentId: 'payment-123',
    storeId: 'store-123',
    amount: new Decimal(50.00),
    currency: Currency.USD,
    status: RefundStatus.PENDING,
    reason: 'Customer requested',
    providerRefundId: null,
    providerData: null,
    processedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Payout Factory
export function createMockPayout(overrides: Record<string, any> = {}) {
  return {
    id: 'payout-123',
    storeId: 'store-123',
    amount: new Decimal(1000.00),
    currency: Currency.USD,
    status: PayoutStatus.PENDING,
    destinationType: 'bank_account',
    destinationDetails: null,
    providerPayoutId: null,
    providerData: null,
    processedAt: null,
    failedAt: null,
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// BalanceTransaction Factory
export function createMockBalanceTransaction(overrides: Record<string, any> = {}) {
  return {
    id: 'balance-tx-123',
    storeId: 'store-123',
    paymentId: null,
    refundId: null,
    payoutId: null,
    type: BalanceTransactionType.PAYMENT_RECEIVED,
    amount: new Decimal(100.00),
    currency: Currency.USD,
    balanceAfter: new Decimal(100.00),
    description: 'Payment received',
    metadata: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// Coupon Factory
export function createMockCoupon(overrides: Record<string, any> = {}) {
  return {
    id: 'coupon-123',
    storeId: 'store-123',
    code: 'SAVE10',
    discountType: 'PERCENTAGE',
    discountValue: new Decimal(10),
    minPurchaseAmount: null,
    maxDiscountAmount: null,
    maxUsageCount: null,
    usageCount: 0,
    isActive: true,
    startsAt: null,
    expiresAt: null,
    applicablePageIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// WebhookEndpoint Factory
export function createMockWebhookEndpoint(overrides: Record<string, any> = {}) {
  return {
    id: 'webhook-endpoint-123',
    storeId: 'store-123',
    url: 'https://example.com/webhook',
    secret: 'whsec_test_secret',
    events: ['payment.completed', 'payment.failed'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// WebhookEvent Factory
export function createMockWebhookEvent(overrides: Record<string, any> = {}) {
  return {
    id: 'webhook-event-123',
    storeId: 'store-123',
    eventType: 'payment.completed',
    payload: { paymentId: 'payment-123' },
    createdAt: new Date(),
    ...overrides,
  };
}

// WebhookDelivery Factory
export function createMockWebhookDelivery(overrides: Record<string, any> = {}) {
  return {
    id: 'webhook-delivery-123',
    eventId: 'webhook-event-123',
    endpointId: 'webhook-endpoint-123',
    status: 'PENDING',
    attemptNumber: 1,
    httpStatus: null,
    responseBody: null,
    errorMessage: null,
    nextRetryAt: null,
    deliveredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// IdempotencyKey Factory
export function createMockIdempotencyKey(overrides: Record<string, any> = {}) {
  return {
    id: 'idempotency-123',
    key: 'idem_test_123',
    storeId: 'store-123',
    endpoint: '/checkout/initiate',
    requestHash: 'hash123',
    responseStatus: null,
    responseBody: null,
    usedAt: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    ...overrides,
  };
}
