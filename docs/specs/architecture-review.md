# Checkie Architecture Review
## Independent CTO Assessment for Hosted Checkout Platform

**Review Date:** January 11, 2026  
**Reviewer:** Independent System Architect  
**Scope:** ERD, Backend Architecture, Payment Orchestration Fitness

---

## 1. Product & Business Interpretation

### 1.1 What Checkie Is Building

Based on the ERD and architecture documents, Checkie is a **hosted checkout page platform** (similar to Checkout Page, Gumroad, or Paddle's checkout layer), NOT a payment processor. The platform enables:

- **Merchants (Sellers)** to create and configure checkout pages
- **End-customers (Buyers)** to complete purchases via those pages
- **Platform** to aggregate transactions and manage merchant balances

### 1.2 Core Business Model

| Component | Implementation |
|-----------|----------------|
| Revenue Model | Transaction fees (platformFee in Payment entity) |
| Payment Flow | Platform as Merchant of Record (funds to platform, then payout to merchant) |
| Product Types | One-time payments, Subscriptions, Pay-What-You-Want |
| PSP Strategy | Multi-provider support via StorePaymentMethod |

### 1.3 Comparison to Checkout Page

| Feature | Checkout Page | Checkie ERD |
|---------|---------------|-------------|
| Checkout Pages | ✅ | ✅ (Page entity) |
| Event Pages | ✅ | ❌ Not in MVP |
| Form Pages | ✅ | ❌ Not in MVP |
| Product Variants | ✅ | ✅ (PageVariant, VariantOption) |
| Custom Fields | ✅ | ✅ (PageCustomField) |
| Customer Portal | ✅ | ✅ (portalToken in Customer) |
| Subscriptions | ✅ | ✅ (Subscription entity) |
| Webhooks | ✅ | ⚠️ Implied but no entity |
| Embeds | ✅ | ✅ (PageEmbed) |
| Coupons | ✅ | ✅ (Coupon, PageCoupon) |

---

## 2. ERD & Architecture ↔ Checkout Logic Alignment

### 2.1 Critical Gap: Missing Checkout Session Entity

**SEVERITY: CRITICAL**

The current ERD conflates **configuration** (Page) with **runtime transactions** (Payment). Industry-standard checkout platforms separate these clearly:

| Platform | Config Entity | Runtime Entity |
|----------|---------------|----------------|
| Stripe | Product/Price | Checkout Session → PaymentIntent |
| Checkout.com | — | Payment Session |
| Checkout Page | Page | Implied session |
| **Checkie** | Page | ❌ **MISSING** |

**Impact:**
- Cannot track abandoned checkouts
- Cannot implement cart recovery
- No clear state machine for checkout lifecycle
- Cannot support multi-step checkouts
- No idempotency boundary for payment attempts

**Required Entity:**

```prisma
model CheckoutSession {
  id                String   @id @default(cuid())
  pageId            String
  customerId        String?  // May be null until customer enters email
  
  // Session state
  status            CheckoutSessionStatus  // OPEN, PROCESSING, COMPLETED, EXPIRED, ABANDONED
  expiresAt         DateTime
  
  // Pricing snapshot (important: prices may change)
  amount            Decimal  @db.Decimal(12, 2)
  currency          Currency
  pricingSnapshot   Json     // Frozen pricing at session creation
  
  // Selected options
  selectedVariants  Json?
  customFieldValues Json?
  couponId          String?
  
  // Tracking
  ipAddress         String?
  userAgent         String?
  referrer          String?
  utmParams         Json?
  
  // Completion
  paymentId         String?  @unique
  completedAt       DateTime?
  abandonedAt       DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([pageId, status])
  @@index([expiresAt])
}

enum CheckoutSessionStatus {
  OPEN        // Customer browsing
  PROCESSING  // Payment in progress
  COMPLETED   // Payment successful
  EXPIRED     // Session timed out
  ABANDONED   // Customer left without completing
}
```

### 2.2 Critical Gap: Missing Payment Attempt Entity

**SEVERITY: CRITICAL**

A single Payment may require multiple attempts (card declined, 3DS retry, fallback provider). Current design cannot:

- Track individual payment attempts
- Implement smart retry logic
- Record reason codes per attempt
- Support fallback routing
- Maintain audit trail for disputes

**Required Entity:**

```prisma
model PaymentAttempt {
  id                String   @id @default(cuid())
  paymentId         String
  checkoutSessionId String
  
  // Attempt details
  attemptNumber     Int
  provider          String   // stripe, paypal, etc.
  providerAttemptId String?
  
  // Status
  status            PaymentAttemptStatus
  failureCode       String?
  failureMessage    String?
  
  // 3DS / SCA
  requires3DS       Boolean  @default(false)
  threeDSStatus     String?
  
  // Response data
  providerResponse  Json?
  
  createdAt         DateTime @default(now())
  
  payment           Payment  @relation(fields: [paymentId], references: [id])
  
  @@index([paymentId])
  @@index([checkoutSessionId])
}

enum PaymentAttemptStatus {
  PENDING
  REQUIRES_ACTION   // 3DS, redirect
  PROCESSING
  SUCCEEDED
  FAILED
  CANCELLED
}
```

### 2.3 High Gap: No Webhook Delivery Tracking

**SEVERITY: HIGH**

Webhooks are mentioned in architecture but no entities exist for:

- Webhook endpoint configuration per store
- Webhook event logging
- Delivery attempts and retries
- Signature verification tracking

**Required Entities:**

```prisma
model WebhookEndpoint {
  id          String   @id @default(cuid())
  storeId     String
  url         String
  secret      String   // For HMAC signature
  events      String[] // ["payment.completed", "subscription.cancelled"]
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  
  store       Store    @relation(fields: [storeId], references: [id])
  deliveries  WebhookDelivery[]
  
  @@index([storeId])
}

model WebhookEvent {
  id          String   @id @default(cuid())
  storeId     String
  type        String   // payment.completed, subscription.cancelled
  payload     Json
  resourceId  String   // paymentId, subscriptionId, etc.
  createdAt   DateTime @default(now())
  
  deliveries  WebhookDelivery[]
  
  @@index([storeId, type])
  @@index([createdAt])
}

model WebhookDelivery {
  id              String   @id @default(cuid())
  webhookEventId  String
  endpointId      String
  
  // Delivery tracking
  attemptNumber   Int
  status          WebhookDeliveryStatus
  httpStatus      Int?
  responseBody    String?
  errorMessage    String?
  
  // Timing
  scheduledAt     DateTime
  attemptedAt     DateTime?
  nextRetryAt     DateTime?
  
  createdAt       DateTime @default(now())
  
  event           WebhookEvent    @relation(fields: [webhookEventId], references: [id])
  endpoint        WebhookEndpoint @relation(fields: [endpointId], references: [id])
  
  @@index([webhookEventId])
  @@index([endpointId, status])
  @@index([nextRetryAt])
}

enum WebhookDeliveryStatus {
  PENDING
  DELIVERED
  FAILED
  RETRYING
}
```

### 2.4 Medium Gap: Idempotency Keys Missing

**SEVERITY: MEDIUM**

No idempotency tracking for:
- Checkout initiation
- Payment creation
- Refund requests

This creates risk of duplicate payments during network issues or client retries.

**Required:**

```prisma
model IdempotencyKey {
  id          String   @id @default(cuid())
  key         String   @unique
  storeId     String
  endpoint    String   // /checkout, /refund
  requestHash String   // Hash of request body
  responseStatus Int
  responseBody Json?
  createdAt   DateTime @default(now())
  expiresAt   DateTime
  
  @@index([key])
  @@index([expiresAt])
}
```

### 2.5 Checkout Flow Mapping

**Current Flow (from architecture):**

```
Buyer → Widget → POST /widget/checkout → Create Payment → PSP → Webhook → Update Payment
```

**Issues:**
1. No session creation step
2. Payment created before PSP confirmation (risky)
3. No state machine for checkout lifecycle
4. No distinction between payment intent and payment confirmation

**Recommended Flow:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CORRECTED CHECKOUT FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

1. GET /widget/pages/:slug
   → Return Page config + create CheckoutSession(status=OPEN)
   
2. POST /widget/sessions/:sessionId/update
   → Update session with variant selections, custom fields
   
3. POST /widget/sessions/:sessionId/initiate-payment
   → Validate session
   → Create Payment(status=PENDING)
   → Create PaymentAttempt(attemptNumber=1)
   → Call PSP to create PaymentIntent
   → Return clientSecret for frontend
   
4. Frontend: Stripe.js confirmPayment
   → PSP handles 3DS if needed
   
5. PSP Webhook → POST /webhooks/stripe
   → Update PaymentAttempt(status=SUCCEEDED or FAILED)
   → If SUCCEEDED:
     - Update Payment(status=COMPLETED)
     - Update CheckoutSession(status=COMPLETED)
     - Create BalanceTransaction
     - Queue merchant notification
     - Queue WebhookEvent
   → If FAILED:
     - Update PaymentAttempt(status=FAILED, failureCode=...)
     - Maybe create new PaymentAttempt for retry
     
6. GET /widget/sessions/:sessionId/status
   → Return completion status for frontend polling
```

---

## 3. Architectural Strengths

### 3.1 Well-Designed Aspects

| Aspect | Assessment |
|--------|------------|
| **Multi-store architecture** | ✅ Excellent. User → StoreUser → Store allows proper multi-tenancy |
| **Role-based access** | ✅ Good foundation with StoreUserRole enum, ready for expansion |
| **Variant/Option modeling** | ✅ Proper normalized structure (PageVariant → VariantOption) |
| **Custom fields** | ✅ Flexible with type enum, validation patterns, conditional logic JSON |
| **Balance ledger** | ✅ Correct approach with BalanceTransaction as append-only ledger |
| **Coupon system** | ✅ Solid with PageCoupon junction table for selective application |
| **Embed types** | ✅ Good coverage (standalone, iframe, popup, button, QR) |
| **Currency support** | ✅ Proper enum with regional coverage |
| **Module structure** | ✅ Clean NestJS modular architecture |

### 3.2 Scalability Foundations

- **Prisma ORM** with proper indexes
- **Redis** for caching and rate limiting
- **BullMQ** for async processing (emails, webhooks)
- **Proper separation** of public (widget) and private (dashboard) APIs

### 3.3 Security Considerations

- JWT + Refresh Token pattern
- Store-scoped authorization guards
- Rate limiting per endpoint type
- No PAN storage (delegated to PSP)

---

## 4. Gaps, Risks, and Anti-Patterns

### 4.1 Critical Issues

| Issue | Risk Level | Impact |
|-------|------------|--------|
| Missing CheckoutSession | 🔴 CRITICAL | Cannot track checkout lifecycle, no cart recovery |
| Missing PaymentAttempt | 🔴 CRITICAL | No retry logic, no audit trail for disputes |
| Payment created before confirmation | 🔴 CRITICAL | Orphan payments, inconsistent state |
| No idempotency mechanism | 🔴 CRITICAL | Duplicate payments possible |

### 4.2 High-Priority Issues

| Issue | Risk Level | Impact |
|-------|------------|--------|
| No webhook entities | 🟠 HIGH | Cannot guarantee delivery, no retry logic |
| providerConfig as JSON | 🟠 HIGH | Security risk if not encrypted at rest |
| No PSP credentials rotation | 🟠 HIGH | Operational risk |
| Denormalized stats on Page | 🟠 HIGH | Race conditions, stale data |
| No payout entity | 🟠 HIGH | Cannot track merchant withdrawals |

### 4.3 Medium-Priority Issues

| Issue | Risk Level | Impact |
|-------|------------|--------|
| Customer.portalToken single column | 🟡 MEDIUM | Only one active session |
| No email verification flow entity | 🟡 MEDIUM | Missing audit trail |
| No soft delete on Page | 🟡 MEDIUM | Data loss risk |
| No currency conversion tracking | 🟡 MEDIUM | Cannot reconcile multi-currency |
| No refund entity (embedded in Payment) | 🟡 MEDIUM | Cannot track partial refunds properly |

### 4.4 Anti-Patterns Detected

**1. Stats Denormalization on Page**
```prisma
// Current (problematic)
model Page {
  viewCount       Int @default(0)
  conversionCount Int @default(0)
  totalRevenue    Decimal @default(0)
}
```

**Problem:** Race conditions when multiple concurrent checkouts complete. Updates require SELECT + UPDATE, creating race window.

**Solution:** Use separate stats table or compute on-demand:
```prisma
model PageStats {
  pageId          String   @unique
  viewCount       Int      @default(0)
  conversionCount Int      @default(0)
  totalRevenue    Decimal  @default(0) @db.Decimal(12, 2)
  updatedAt       DateTime @updatedAt
}
// Update via: UPDATE page_stats SET conversion_count = conversion_count + 1 WHERE page_id = ?
```

**2. Provider Config as Plain JSON**
```prisma
model StorePaymentMethod {
  providerConfig  Json  // Contains API keys!
}
```

**Problem:** API keys stored in plain JSON. Even with DB encryption, this is a PCI DSS concern.

**Solution:**
```prisma
model StorePaymentMethod {
  providerConfigEncrypted  String  // AES-256 encrypted
  providerConfigIV         String  // Initialization vector
  providerConfigKeyId      String  // Key rotation support
}
```

**3. Missing Refund Entity**
Current design embeds refund data in Payment:
```prisma
model Payment {
  refundedAmount  Decimal
  refundReason    String?
}
```

**Problem:** Cannot track multiple partial refunds with different reasons/timestamps.

**Solution:**
```prisma
model Refund {
  id              String   @id @default(cuid())
  paymentId       String
  amount          Decimal  @db.Decimal(12, 2)
  reason          String?
  status          RefundStatus
  providerRefundId String?
  createdAt       DateTime @default(now())
  completedAt     DateTime?
  
  payment         Payment  @relation(fields: [paymentId], references: [id])
  
  @@index([paymentId])
}
```

---

## 5. Improvement Proposals

### 5.1 Immediate (Before MVP Launch)

#### 5.1.1 Add CheckoutSession Entity
**Priority: P0**

As detailed in Section 2.1, this is foundational for:
- Tracking checkout lifecycle
- Cart abandonment recovery (post-MVP but architecture needed now)
- Idempotent payment initiation
- Proper state machine

#### 5.1.2 Add PaymentAttempt Entity
**Priority: P0**

As detailed in Section 2.2, required for:
- Payment retry logic
- Failure reason tracking
- 3DS state management
- Dispute evidence

#### 5.1.3 Add Webhook Entities
**Priority: P1**

As detailed in Section 2.3, required for:
- Reliable event delivery
- Retry with exponential backoff
- Delivery logging

#### 5.1.4 Encrypt Provider Credentials
**Priority: P0**

```typescript
// services/encryption.service.ts
@Injectable()
export class EncryptionService {
  encrypt(data: object): { encrypted: string; iv: string; keyId: string }
  decrypt(encrypted: string, iv: string, keyId: string): object
}
```

### 5.2 Short-Term (1-3 Months Post-MVP)

#### 5.2.1 Separate Refund Entity

```prisma
model Refund {
  id              String       @id @default(cuid())
  paymentId       String
  amount          Decimal      @db.Decimal(12, 2)
  currency        Currency
  reason          RefundReason
  reasonDetails   String?
  status          RefundStatus
  providerRefundId String?
  requestedBy     String?      // userId
  createdAt       DateTime     @default(now())
  processedAt     DateTime?
  
  payment         Payment      @relation(fields: [paymentId], references: [id])
  balanceTransaction BalanceTransaction?
}

enum RefundReason {
  REQUESTED_BY_CUSTOMER
  DUPLICATE
  FRAUDULENT
  PRODUCT_NOT_RECEIVED
  PRODUCT_UNACCEPTABLE
  OTHER
}

enum RefundStatus {
  PENDING
  PROCESSING
  SUCCEEDED
  FAILED
  CANCELLED
}
```

#### 5.2.2 Add Payout Entity

Currently, BalanceTransaction tracks PAYOUT_REQUESTED and PAYOUT_COMPLETED, but no dedicated entity exists.

```prisma
model Payout {
  id              String       @id @default(cuid())
  storeId         String
  amount          Decimal      @db.Decimal(12, 2)
  currency        Currency
  status          PayoutStatus
  method          PayoutMethod
  destination     Json         // Bank account details (encrypted)
  providerPayoutId String?
  
  requestedAt     DateTime     @default(now())
  processedAt     DateTime?
  completedAt     DateTime?
  failedAt        DateTime?
  failureReason   String?
  
  store           Store        @relation(fields: [storeId], references: [id])
  balanceTransactions BalanceTransaction[]
}

enum PayoutStatus {
  PENDING
  PROCESSING
  IN_TRANSIT
  COMPLETED
  FAILED
  CANCELLED
}

enum PayoutMethod {
  BANK_TRANSFER
  STRIPE_CONNECT
  PAYPAL
}
```

#### 5.2.3 Event Sourcing for Balance

Current append-only BalanceTransaction is good, but add:

```prisma
model BalanceTransaction {
  // ... existing fields
  
  // Add for reconciliation
  externalReference String?    // PSP transaction ID
  reconciledAt      DateTime?
  reconciledBy      String?    // System or admin userId
}

// Add balance snapshot for faster queries
model BalanceSnapshot {
  id        String   @id @default(cuid())
  storeId   String
  balance   Decimal  @db.Decimal(12, 2)
  currency  Currency
  asOfDate  DateTime
  lastTransactionId String
  
  @@unique([storeId, asOfDate])
  @@index([storeId])
}
```

### 5.3 Medium-Term (3-6 Months)

#### 5.3.1 PSP Abstraction Layer

Current StorePaymentMethod is a start, but needs:

```prisma
// Provider capabilities and routing rules
model PaymentProvider {
  id              String   @id @default(cuid())
  code            String   @unique  // stripe, paypal, razorpay
  name            String
  isActive        Boolean  @default(true)
  
  // Capabilities
  supportedCurrencies    Currency[]
  supportedPaymentMethods String[]  // card, bank_transfer, wallet
  supportedCountries     String[]
  
  // Routing
  defaultPriority Int      @default(0)
  
  // Health
  lastHealthCheck DateTime?
  isHealthy       Boolean  @default(true)
}

model ProviderRoutingRule {
  id              String   @id @default(cuid())
  storeId         String?  // null = global rule
  
  // Conditions
  currency        Currency?
  country         String?
  amountMin       Decimal? @db.Decimal(12, 2)
  amountMax       Decimal? @db.Decimal(12, 2)
  paymentMethod   String?
  
  // Action
  providerId      String
  priority        Int      @default(0)
  
  isActive        Boolean  @default(true)
  
  @@index([storeId])
}
```

#### 5.3.2 State Machine for Checkout

Implement proper state machine:

```typescript
// checkout-session.state-machine.ts
const checkoutSessionMachine = createMachine({
  id: 'checkoutSession',
  initial: 'open',
  states: {
    open: {
      on: {
        INITIATE_PAYMENT: 'processing',
        EXPIRE: 'expired',
        ABANDON: 'abandoned'
      }
    },
    processing: {
      on: {
        PAYMENT_SUCCEEDED: 'completed',
        PAYMENT_FAILED: 'open',  // Allow retry
        PAYMENT_REQUIRES_ACTION: 'awaiting_action'
      }
    },
    awaiting_action: {
      on: {
        ACTION_COMPLETED: 'processing',
        ACTION_FAILED: 'open',
        EXPIRE: 'expired'
      }
    },
    completed: { type: 'final' },
    expired: { type: 'final' },
    abandoned: { type: 'final' }
  }
});
```

---

## 6. Evolution Roadmap (12-24 Months)

### Phase 1: Foundation Fixes (Months 1-2)

```
✅ Add CheckoutSession entity
✅ Add PaymentAttempt entity  
✅ Add Webhook entities
✅ Encrypt provider credentials
✅ Add idempotency keys
✅ Fix stats denormalization
```

### Phase 2: Payment Robustness (Months 3-4)

```
✅ Separate Refund entity
✅ Add Payout entity
✅ Implement webhook retry with exponential backoff
✅ Add balance snapshots
✅ Implement provider health checks
```

### Phase 3: Multi-Provider Orchestration (Months 5-8)

```
✅ PaymentProvider entity
✅ ProviderRoutingRule entity
✅ Smart routing based on:
   - Currency
   - Geographic region
   - Amount
   - Provider health
   - Cost optimization
✅ Automatic failover to backup provider
```

### Phase 4: Enterprise Features (Months 9-12)

```
✅ Multi-currency support with FX tracking
✅ Split payments (marketplace model)
✅ Subscription plan changes (upgrades/downgrades)
✅ Usage-based billing support
✅ Consolidated invoicing
✅ SOC 2 compliance audit trail
```

### Phase 5: Scale Optimization (Months 13-18)

```
✅ Event-driven architecture (Kafka/SQS)
✅ CQRS for read-heavy analytics
✅ Database sharding by store
✅ Global edge deployment
✅ Real-time fraud scoring
```

### Phase 6: Platform Ecosystem (Months 19-24)

```
✅ Public API for third-party integrations
✅ App marketplace
✅ White-label solution
✅ Enterprise SLA tiers
```

---

## 7. Summary of Critical Actions

### Must Fix Before MVP

| # | Action | Effort | Risk if Not Done |
|---|--------|--------|------------------|
| 1 | Add CheckoutSession entity | 3 days | Cannot track lifecycle, no cart recovery foundation |
| 2 | Add PaymentAttempt entity | 2 days | No retry logic, dispute evidence gaps |
| 3 | Add Webhook entities | 3 days | Unreliable integrations, support burden |
| 4 | Encrypt providerConfig | 1 day | PCI compliance risk |
| 5 | Add idempotency keys | 2 days | Duplicate payment risk |

### Should Fix Within 3 Months

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 6 | Separate Refund entity | 2 days | Better audit trail, partial refund support |
| 7 | Add Payout entity | 2 days | Proper withdrawal tracking |
| 8 | Fix stats denormalization | 1 day | Eliminate race conditions |
| 9 | Add balance snapshots | 1 day | Faster balance queries |

---

## Appendix: Revised ERD Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REVISED CHECKIE ERD                                  │
└─────────────────────────────────────────────────────────────────────────────┘

AUTHENTICATION & USERS
├── User
├── RefreshToken
├── PasswordReset
└── IdempotencyKey [NEW]

MERCHANT CONFIGURATION
├── Store
├── StoreUser
├── StorePaymentMethod (encrypted credentials)
├── PaymentProvider [NEW]
├── ProviderRoutingRule [NEW]
└── WebhookEndpoint [NEW]

CHECKOUT CONFIGURATION
├── Page
├── PageVariant → VariantOption
├── PageCustomField
├── PageEmbed
├── Coupon → PageCoupon
└── PageStats [NEW - separate from Page]

RUNTIME / TRANSACTIONAL
├── CheckoutSession [NEW - critical]
├── Customer
├── Payment
├── PaymentAttempt [NEW - critical]
├── PaymentItem
├── CustomFieldValue
├── Subscription
├── Refund [NEW]
└── Payout [NEW]

BALANCE & LEDGER
├── BalanceTransaction
└── BalanceSnapshot [NEW]

WEBHOOKS & EVENTS
├── WebhookEvent [NEW]
└── WebhookDelivery [NEW]
```

---

**Review Conclusion:**

The Checkie ERD and architecture provide a solid foundation for a hosted checkout platform, but contain critical gaps in checkout session lifecycle management and payment attempt tracking. These must be addressed before MVP launch to ensure reliable payment processing, proper audit trails, and foundation for future features like cart recovery.

The modular NestJS architecture, proper multi-tenancy design, and balance ledger approach are strengths to preserve and build upon.

---

*End of Architectural Review*
