# CLAUDE.md — Checkie Backend Development Guide

> Этот файл содержит контекст и инструкции для разработки бэкенда Checkie.
> Claude Code должен прочитать этот файл перед началом работы.

---

## 🎯 Project Overview

**Checkie** — hosted checkout page platform (аналог Checkout Page / Gumroad).

**Цель:** Построить production-ready бэкенд для приёма платежей через кастомизируемые checkout-страницы.

### Бизнес-модель
- Продавцы (Merchants) создают магазины и checkout pages
- Покупатели (Buyers) оплачивают через эти страницы
- Платформа берёт комиссию (2.9%) с каждой транзакции
- Деньги накапливаются на балансе продавца

### MVP Scope
| Feature | Status |
|---------|--------|
| Checkout Pages (не Events, не Forms) | ✅ В скоупе |
| Pricing: Fixed, PWYW, Subscription | ✅ В скоупе |
| Product Variants | ✅ В скоупе |
| Custom Fields | ✅ В скоупе |
| Embeds (standalone, iframe, popup, button, QR) | ✅ В скоупе |
| Customer Portal | ✅ В скоупе |
| Coupons | ✅ В скоупе |
| Digital Products | ❌ Post-MVP |
| Cart Abandonment | ❌ Post-MVP |
| Analytics/Tracking | ❌ Post-MVP |
| Team Roles | ❌ Post-MVP (архитектура готова) |

---

## 🛠 Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Runtime | Node.js 20 LTS | |
| Framework | NestJS 10 | Modular, TypeScript |
| ORM | Prisma 5 | Type-safe, migrations |
| Database | PostgreSQL 16 | Primary data store |
| Cache | Redis 7 | Sessions, rate limiting, state machine |
| Queue | BullMQ | Background jobs |
| Auth | JWT + Refresh Tokens | Access: 15min, Refresh: 7d |
| Validation | class-validator + Zod | |
| State Machine | XState 5 | CheckoutSession lifecycle |
| Testing | Jest + Supertest | |

---

## 📁 Project Structure

```
checkie-backend/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── migrations/            # Migration files
│   └── seed.ts                # Seed data
│
├── src/
│   ├── main.ts                # Entry point
│   ├── app.module.ts          # Root module
│   │
│   ├── common/                # Shared utilities
│   │   ├── decorators/        # @CurrentUser, @StoreContext, @Public
│   │   ├── filters/           # Exception filters
│   │   ├── guards/            # JwtAuthGuard, StoreAccessGuard, RoleGuard
│   │   ├── interceptors/      # Transform, Logging
│   │   ├── pipes/             # Validation
│   │   └── utils/             # Helpers
│   │
│   ├── config/                # Configuration
│   │
│   ├── prisma/                # Prisma module
│   │
│   ├── modules/
│   │   ├── auth/              # Authentication
│   │   ├── users/             # User management
│   │   ├── stores/            # Store (merchant account)
│   │   ├── pages/             # Checkout pages + variants + fields + embeds
│   │   ├── checkout/          # ⭐ CheckoutSession & state machine
│   │   ├── payments/          # Payment processing
│   │   ├── subscriptions/     # Recurring billing
│   │   ├── customers/         # Buyer management + portal
│   │   ├── balance/           # Balance & ledger
│   │   ├── payouts/           # ⭐ Withdrawal requests
│   │   ├── refunds/           # ⭐ Refund processing
│   │   ├── coupons/           # Discount codes
│   │   ├── webhooks/          # ⭐ Webhook management & delivery
│   │   ├── providers/         # PSP integrations (Stripe)
│   │   ├── notifications/     # Email notifications
│   │   └── widget/            # Public checkout API
│   │
│   └── jobs/                  # Background processors
│
├── docs/specs/                # Technical specifications
├── docker-compose.yml
└── package.json
```

⭐ = Critical modules from architecture review

---

## 🔑 Key Entities

| Entity | Purpose | Priority |
|--------|---------|----------|
| User | Platform user (merchant) | P0 |
| Store | Merchant account/shop | P0 |
| StoreUser | User-Store membership with role | P0 |
| Page | Checkout page configuration | P0 |
| PageVariant / VariantOption | Product options | P0 |
| PageCustomField | Form fields | P0 |
| PageEmbed | Embed configurations | P1 |
| Customer | Buyer | P0 |
| **CheckoutSession** | ⭐ Runtime checkout lifecycle | **P0 Critical** |
| Payment | Completed transaction | P0 |
| **PaymentAttempt** | ⭐ Individual payment try | **P0 Critical** |
| Subscription | Recurring billing | P1 |
| **Refund** | ⭐ Separate refund entity | P1 |
| BalanceTransaction | Ledger entries | P0 |
| **Payout** | ⭐ Withdrawal requests | P1 |
| Coupon | Discount codes | P1 |
| **WebhookEndpoint** | ⭐ Merchant webhook config | P1 |
| **WebhookEvent** | ⭐ Event log | P1 |
| **WebhookDelivery** | ⭐ Delivery tracking | P1 |
| **IdempotencyKey** | ⭐ Duplicate prevention | **P0 Critical** |

---

## 🔄 CheckoutSession State Machine

```
OPEN → PROCESSING → AWAITING_ACTION → COMPLETED
  ↓         ↓              ↓
  └─────────┴──────────────┴───→ EXPIRED / ABANDONED
```

**States:**
- `OPEN` — Customer filling form (TTL: 60 min)
- `PROCESSING` — PSP processing (timeout: 5 min)
- `AWAITING_ACTION` — 3DS/redirect (timeout: 15 min)
- `COMPLETED` — Success (final)
- `EXPIRED` — Timeout (final)
- `ABANDONED` — Customer left (final)

**Guards:**
- `isValidForPayment` — email, amount, required fields
- `canRetry` — max 3 attempts, session not expired

**See:** `docs/specs/checkout-state-machine.md`

---

## 🔒 Security Requirements

1. **Authentication:** JWT (15min) + Refresh Token (7d, HttpOnly)
2. **Authorization:** StoreAccessGuard + RoleGuard
3. **Rate Limiting:** Auth 5/min, API 100/min, Widget 30/min
4. **Encryption:** AES-256 for PSP creds & payout destinations
5. **No PAN storage** — delegated to PSP

---

## 📋 Coding Conventions

### NestJS Patterns
```typescript
// Module structure
@Module({
  imports: [PrismaModule],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}

// Service with Prisma
@Injectable()
export class PagesService {
  constructor(private prisma: PrismaService) {}
  
  async findByStore(storeId: string) {
    return this.prisma.page.findMany({
      where: { storeId },
      include: { variants: true },
    });
  }
}

// Guard usage
@UseGuards(JwtAuthGuard, StoreAccessGuard)
@Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
@Controller('stores/:storeId/pages')
export class PagesController {}
```

### Naming
- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions: `camelCase`
- DB tables: `snake_case` (Prisma)

### Money
- Always use `Decimal(12,2)` for amounts
- Store in smallest unit consideration (but we use decimal)

---

## 🧪 Testing

```bash
npm run test          # Unit tests
npm run test:e2e      # E2E tests
npm run test:cov      # Coverage
```

Coverage targets:
- Auth: 90%
- Payments: 95%
- Business logic: 80%

---

## 📝 API Response Format

```typescript
// Success
{ data: {...}, meta: { timestamp } }

// Paginated
{ data: [...], meta: { total, page, limit, hasMore } }

// Error
{ statusCode, message, error, details?: [...] }
```

---

## ⚠️ Critical Rules

1. **CheckoutSession is mandatory** — all payments go through it
2. **PaymentAttempt for every try** — never modify Payment directly on webhook
3. **Balance is append-only** — never UPDATE, only INSERT
4. **Webhooks need retry** — exponential backoff (1m, 2m, 4m, 8m...)
5. **Encrypt sensitive data** — providerConfig, payout destinations
6. **Idempotency keys** — prevent duplicate payments
7. **Transactions for multi-table ops** — use `prisma.$transaction`

---

## 🚀 Commands

```bash
npm run start:dev           # Development
npx prisma migrate dev      # Run migrations
npx prisma generate         # Generate client
npx prisma studio           # DB GUI
npm run build               # Production build
```

---

## 📚 Reference Documents

| Document | Path |
|----------|------|
| Implementation Plan | `docs/IMPLEMENTATION_PLAN.md` |
| Prisma Schema | `docs/specs/schema.prisma` |
| State Machine | `docs/specs/checkout-state-machine.md` |
| API Endpoints | `docs/specs/api-endpoints.md` |
| Architecture Review | `docs/specs/architecture-review.md` |

---

*Last updated: January 11, 2026*
