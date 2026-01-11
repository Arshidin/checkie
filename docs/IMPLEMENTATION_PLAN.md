# IMPLEMENTATION_PLAN.md — Пошаговый план реализации Checkie Backend

> Этот документ содержит детальный план реализации всех доработок.
> Выполняй шаги последовательно, не пропуская.

---

## 📋 Обзор фаз

| Фаза | Название | Длительность | Статус |
|------|----------|--------------|--------|
| 0 | Project Setup | 1 день | ✅ Готово |
| 1 | Foundation (Auth + Users + Stores) | 3 дня | ✅ Готово |
| 2 | Pages & Configuration | 3 дня | ✅ Готово |
| 3 | Checkout Session & State Machine | 3 дня | ✅ Готово |
| 4 | Payments & PSP Integration | 3 дня | ✅ Готово (Stripe как заглушка) |
| 5 | Subscriptions | 2 дня | ⬜ Не начато |
| 6 | Refunds & Payouts | 2 дня | ⬜ Не начато |
| 7 | Webhooks System | 2 дня | ⬜ Не начато |
| 8 | Widget API & Customer Portal | 2 дня | ⬜ Не начато |
| 9 | Testing & Polish | 2 дня | ⬜ Не начато |

---

## Phase 0: Project Setup

### Step 0.1: Инициализация проекта
```bash
# Создать NestJS проект
nest new checkie-backend --strict --skip-git
cd checkie-backend

# Установить зависимости
npm install @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt
npm install @prisma/client prisma
npm install ioredis @nestjs/bullmq bullmq
npm install class-validator class-transformer
npm install xstate @xstate/fsm
npm install bcrypt uuid slugify
npm install stripe
npm install @nestjs/throttler
npm install helmet
npm install -D @types/passport-jwt @types/bcrypt @types/uuid
```

### Step 0.2: Структура папок
```bash
mkdir -p src/{common,config,prisma,modules,jobs}
mkdir -p src/common/{decorators,filters,guards,interceptors,pipes,utils}
mkdir -p src/modules/{auth,users,stores,pages,checkout,payments,subscriptions,customers,balance,payouts,refunds,coupons,webhooks,providers,notifications,widget}
mkdir -p src/modules/pages/{variants,custom-fields,embeds}
mkdir -p src/modules/customers/portal
mkdir -p src/modules/providers/stripe
mkdir -p src/jobs/processors
mkdir -p docs/specs
mkdir -p test
```

### Step 0.3: Docker Compose
```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: checkie
      POSTGRES_PASSWORD: checkie_dev
      POSTGRES_DB: checkie
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Step 0.4: Environment файл
```env
# .env
DATABASE_URL="postgresql://checkie:checkie_dev@localhost:5432/checkie"
REDIS_URL="redis://localhost:6379"

JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRATION="15m"
REFRESH_TOKEN_EXPIRATION="7d"

ENCRYPTION_KEY="32-byte-encryption-key-here-!!"
ENCRYPTION_IV_LENGTH=16

STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

APP_URL="http://localhost:3000"
WIDGET_URL="http://localhost:3001"
API_URL="http://localhost:3000/api"

PLATFORM_FEE_PERCENT=0.029
```

### Step 0.5: Prisma Schema
Скопировать `docs/specs/schema.prisma` в `prisma/schema.prisma`

```bash
npx prisma generate
npx prisma migrate dev --name init
```

**Чеклист Phase 0:**
- [x] NestJS проект создан
- [x] Зависимости установлены
- [x] Docker Compose работает (postgres + redis)
- [x] Prisma schema применена
- [x] .env настроен

---

## Phase 1: Foundation

### Step 1.1: Config Module
```typescript
// src/config/config.module.ts
// src/config/app.config.ts
// src/config/database.config.ts
// src/config/jwt.config.ts
// src/config/redis.config.ts
```

Реализовать ConfigModule с валидацией через Joi.

### Step 1.2: Prisma Module
```typescript
// src/prisma/prisma.module.ts
// src/prisma/prisma.service.ts
```

Реализовать PrismaService с onModuleInit и enableShutdownHooks.

### Step 1.3: Common Utilities
```typescript
// src/common/utils/slug.util.ts - генерация slug
// src/common/utils/crypto.util.ts - шифрование AES-256
// src/common/utils/pagination.util.ts - пагинация
// src/common/filters/http-exception.filter.ts
// src/common/interceptors/transform.interceptor.ts
// src/common/pipes/validation.pipe.ts
```

### Step 1.4: Auth Module
```typescript
// src/modules/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── strategies/
│   └── jwt.strategy.ts
├── guards/
│   ├── jwt-auth.guard.ts
│   └── refresh-token.guard.ts
├── decorators/
│   ├── current-user.decorator.ts
│   └── public.decorator.ts
└── dto/
    ├── register.dto.ts
    ├── login.dto.ts
    └── refresh-token.dto.ts
```

**Endpoints:**
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`

### Step 1.5: Users Module
```typescript
// src/modules/users/
├── users.module.ts
├── users.controller.ts
├── users.service.ts
└── dto/
    ├── update-user.dto.ts
    └── change-password.dto.ts
```

**Endpoints:**
- `GET /api/users/me`
- `PATCH /api/users/me`
- `PATCH /api/users/me/password`
- `DELETE /api/users/me`

### Step 1.6: Stores Module
```typescript
// src/modules/stores/
├── stores.module.ts
├── stores.controller.ts
├── stores.service.ts
├── guards/
│   ├── store-access.guard.ts
│   └── store-role.guard.ts
├── decorators/
│   ├── store-context.decorator.ts
│   └── roles.decorator.ts
└── dto/
    ├── create-store.dto.ts
    └── update-store.dto.ts
```

**Endpoints:**
- `GET /api/stores`
- `POST /api/stores`
- `GET /api/stores/:storeId`
- `PATCH /api/stores/:storeId`
- `DELETE /api/stores/:storeId`
- `GET /api/stores/:storeId/stats`

**Чеклист Phase 1:**
- [x] ConfigModule работает
- [x] PrismaService подключается к БД
- [x] Auth endpoints работают (register, login, refresh)
- [x] JWT guard защищает роуты
- [x] Users CRUD работает
- [x] Stores CRUD работает
- [x] StoreAccessGuard проверяет доступ к store

---

## Phase 2: Pages & Configuration

### Step 2.1: Pages Module
```typescript
// src/modules/pages/
├── pages.module.ts
├── pages.controller.ts
├── pages.service.ts
├── variants/
│   ├── variants.controller.ts
│   ├── variants.service.ts
│   └── dto/
├── custom-fields/
│   ├── custom-fields.controller.ts
│   ├── custom-fields.service.ts
│   └── dto/
├── embeds/
│   ├── embeds.controller.ts
│   ├── embeds.service.ts
│   └── dto/
└── dto/
    ├── create-page.dto.ts
    └── update-page.dto.ts
```

**Page Endpoints:**
- `GET /api/stores/:storeId/pages`
- `POST /api/stores/:storeId/pages`
- `GET /api/stores/:storeId/pages/:pageId`
- `PATCH /api/stores/:storeId/pages/:pageId`
- `DELETE /api/stores/:storeId/pages/:pageId`
- `POST /api/stores/:storeId/pages/:pageId/publish`
- `POST /api/stores/:storeId/pages/:pageId/archive`
- `POST /api/stores/:storeId/pages/:pageId/duplicate`

**Variants Endpoints:**
- `GET /api/stores/:storeId/pages/:pageId/variants`
- `POST /api/stores/:storeId/pages/:pageId/variants`
- `PATCH .../variants/:variantId`
- `DELETE .../variants/:variantId`
- `POST .../variants/:variantId/options`
- `PATCH .../options/:optionId`
- `DELETE .../options/:optionId`

**Custom Fields Endpoints:**
- `GET /api/stores/:storeId/pages/:pageId/custom-fields`
- `POST /api/stores/:storeId/pages/:pageId/custom-fields`
- `PATCH .../custom-fields/:fieldId`
- `DELETE .../custom-fields/:fieldId`
- `PATCH .../custom-fields/reorder`

**Embeds Endpoints:**
- `GET /api/stores/:storeId/pages/:pageId/embeds`
- `POST /api/stores/:storeId/pages/:pageId/embeds`
- `GET .../embeds/:embedId/code`

### Step 2.2: Coupons Module
```typescript
// src/modules/coupons/
├── coupons.module.ts
├── coupons.controller.ts
├── coupons.service.ts
└── dto/
```

**Endpoints:**
- `GET /api/stores/:storeId/coupons`
- `POST /api/stores/:storeId/coupons`
- `PATCH /api/stores/:storeId/coupons/:couponId`
- `DELETE /api/stores/:storeId/coupons/:couponId`

### Step 2.3: PageStats (отдельная таблица)
Реализовать сервис для атомарного обновления статистики:
```typescript
async incrementConversion(pageId: string, amount: Decimal) {
  await this.prisma.$executeRaw`
    UPDATE page_stats
    SET conversion_count = conversion_count + 1,
        total_revenue = total_revenue + ${amount},
        last_conversion_at = NOW()
    WHERE page_id = ${pageId}
  `;
}
```

**Чеклист Phase 2:**
- [x] Pages CRUD работает
- [x] Variants CRUD работает
- [x] Custom Fields CRUD работает
- [x] Embeds генерируют код
- [x] Coupons CRUD работает
- [x] PageStats обновляется атомарно

---

## Phase 3: Checkout Session & State Machine

### Step 3.1: Checkout Module Structure
```typescript
// src/modules/checkout/
├── checkout.module.ts
├── checkout.controller.ts
├── checkout.service.ts
├── checkout-session.machine.ts      // XState machine
├── checkout-session.service.ts      // State management
├── checkout-session.guards.ts       // State guards
├── checkout-session.actions.ts      // State actions
└── dto/
    ├── create-session.dto.ts
    ├── update-session.dto.ts
    └── initiate-payment.dto.ts
```

### Step 3.2: XState Machine
```typescript
// checkout-session.machine.ts
import { createMachine } from 'xstate';

export const checkoutSessionMachine = createMachine({
  id: 'checkoutSession',
  initial: 'open',
  states: {
    open: {
      on: {
        UPDATE_SESSION: { target: 'open', actions: 'updateSessionData' },
        INITIATE_PAYMENT: { target: 'processing', cond: 'isValidForPayment' },
        TIMEOUT: { target: 'expired' },
        ABANDON: { target: 'abandoned' },
      },
    },
    processing: {
      on: {
        PAYMENT_SUCCEEDED: { target: 'completed', cond: 'isAmountValid' },
        PAYMENT_FAILED: [
          { target: 'open', cond: 'canRetry' },
          { target: 'expired' },
        ],
        REQUIRES_ACTION: { target: 'awaiting_action' },
        TIMEOUT: { target: 'expired' },
      },
    },
    awaiting_action: {
      on: {
        ACTION_COMPLETED: { target: 'processing' },
        ACTION_FAILED: [
          { target: 'open', cond: 'canRetry' },
          { target: 'expired' },
        ],
        TIMEOUT: { target: 'expired' },
        ABANDON: { target: 'abandoned' },
      },
    },
    completed: { type: 'final' },
    expired: { type: 'final' },
    abandoned: { type: 'final' },
  },
});
```

### Step 3.3: Session Service
Реализовать:
- `createSession(pageId, metadata)` — создание сессии
- `updateSession(sessionId, data)` — обновление данных
- `sendEvent(sessionId, event)` — отправка события в машину
- `getSessionState(sessionId)` — получение состояния
- State persistence в Redis + PostgreSQL fallback

### Step 3.4: Guards Implementation
```typescript
// checkout-session.guards.ts
export const guards = {
  isValidForPayment: (context) => {
    if (!context.customerEmail && !context.customerId) return false;
    if (!context.amount || context.amount <= 0) return false;
    // Check required fields
    return true;
  },
  canRetry: (context) => context.attempts.length < 3,
  isAmountValid: (context, event) => 
    Math.abs(context.amount - event.amount) <= 0.01,
};
```

### Step 3.5: Actions Implementation
```typescript
// checkout-session.actions.ts
export const actions = {
  updateSessionData: async (context, event) => { ... },
  createPayment: async (context) => { ... },
  createPaymentAttempt: async (context, payment) => { ... },
  completePayment: async (context, event) => { ... },
  updateBalance: async (context, payment) => { ... },
  sendNotifications: async (context, payment) => { ... },
  triggerWebhooks: async (context, payment) => { ... },
};
```

### Step 3.6: IdempotencyKey Service
```typescript
// src/common/services/idempotency.service.ts
@Injectable()
export class IdempotencyService {
  async checkOrCreate(key: string, storeId: string, endpoint: string) { ... }
  async setResponse(key: string, status: number, body: any) { ... }
}
```

**Чеклист Phase 3:**
- [x] CheckoutSession entity создаётся
- [x] State machine работает
- [x] State сохраняется в Redis
- [x] Guards проверяют условия
- [x] Actions выполняются при переходах
- [x] IdempotencyKey предотвращает дубли
- [x] Session expiry работает

---

## Phase 4: Payments & PSP Integration

### Step 4.1: Providers Module
```typescript
// src/modules/providers/
├── providers.module.ts
├── provider.interface.ts
├── provider.factory.ts
└── stripe/
    ├── stripe.provider.ts
    └── stripe.webhook.handler.ts
```

### Step 4.2: Provider Interface
```typescript
// provider.interface.ts
export interface PaymentProvider {
  createPaymentIntent(params: CreatePaymentParams): Promise<PaymentIntentResult>;
  confirmPayment(intentId: string): Promise<PaymentResult>;
  cancelPaymentIntent(intentId: string): Promise<void>;
  createRefund(params: RefundParams): Promise<RefundResult>;
  handleWebhook(payload: any, signature: string): Promise<WebhookEvent>;
}
```

### Step 4.3: Stripe Provider
```typescript
// stripe/stripe.provider.ts
@Injectable()
export class StripeProvider implements PaymentProvider {
  private stripe: Stripe;
  
  constructor(private config: ConfigService) {
    this.stripe = new Stripe(config.get('STRIPE_SECRET_KEY'));
  }
  
  async createPaymentIntent(params) {
    return this.stripe.paymentIntents.create({
      amount: Math.round(params.amount * 100), // cents
      currency: params.currency.toLowerCase(),
      metadata: params.metadata,
      automatic_payment_methods: { enabled: true },
    });
  }
  // ... other methods
}
```

### Step 4.4: Payments Module
```typescript
// src/modules/payments/
├── payments.module.ts
├── payments.controller.ts
├── payments.service.ts
├── webhooks/
│   └── psp-webhook.controller.ts
└── dto/
```

**Endpoints:**
- `GET /api/stores/:storeId/payments`
- `GET /api/stores/:storeId/payments/:paymentId`
- `POST /api/stores/:storeId/payments/:paymentId/refund` (redirect to refunds)
- `GET /api/stores/:storeId/payments/export`
- `POST /api/webhooks/stripe` (PSP webhook)

### Step 4.5: Webhook Controller
```typescript
// psp-webhook.controller.ts
@Controller('webhooks')
export class PspWebhookController {
  @Post('stripe')
  @Public()
  async handleStripeWebhook(
    @Body() body: Buffer,
    @Headers('stripe-signature') signature: string,
  ) {
    const event = await this.stripeProvider.handleWebhook(body, signature);
    await this.checkoutService.handleWebhook('stripe', event.type, event.data);
    return { received: true };
  }
}
```

### Step 4.6: Balance Module
```typescript
// src/modules/balance/
├── balance.module.ts
├── balance.controller.ts
├── balance.service.ts
└── dto/
```

**Endpoints:**
- `GET /api/stores/:storeId/balance`
- `GET /api/stores/:storeId/balance/transactions`
- `GET /api/stores/:storeId/balance/report`

**BalanceService:**
```typescript
async addTransaction(params: AddTransactionParams) {
  return this.prisma.$transaction(async (tx) => {
    const lastTx = await tx.balanceTransaction.findFirst({
      where: { storeId: params.storeId },
      orderBy: { createdAt: 'desc' },
    });
    
    const balanceAfter = (lastTx?.balanceAfter ?? new Decimal(0))
      .plus(params.amount);
    
    return tx.balanceTransaction.create({
      data: { ...params, balanceAfter },
    });
  });
}
```

**Чеклист Phase 4:**
- [x] Stripe provider работает (STUB для разработки)
- [x] PaymentIntent создаётся
- [x] Webhook обрабатывается
- [x] Payment создаётся при успехе
- [x] PaymentAttempt логирует попытки
- [x] Balance обновляется
- [x] 3DS redirect работает (симуляция для сумм > $100)

---

## Phase 5: Subscriptions

### Step 5.1: Subscriptions Module
```typescript
// src/modules/subscriptions/
├── subscriptions.module.ts
├── subscriptions.controller.ts
├── subscriptions.service.ts
└── dto/
```

**Endpoints:**
- `GET /api/stores/:storeId/subscriptions`
- `GET /api/stores/:storeId/subscriptions/:subscriptionId`
- `POST .../subscriptions/:subscriptionId/cancel`
- `POST .../subscriptions/:subscriptionId/pause`
- `POST .../subscriptions/:subscriptionId/resume`

### Step 5.2: Stripe Subscription Integration
```typescript
// Extend StripeProvider
async createSubscription(params) {
  return this.stripe.subscriptions.create({
    customer: params.stripeCustomerId,
    items: [{ price: params.stripePriceId }],
    trial_period_days: params.trialDays,
    metadata: params.metadata,
  });
}
```

### Step 5.3: Subscription Webhooks
Обрабатывать события:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

**Чеклист Phase 5:**
- [ ] Subscription создаётся в Stripe
- [ ] Subscription сохраняется в БД
- [ ] Webhooks обновляют статус
- [ ] Cancel/Pause/Resume работают
- [ ] Trial период работает

---

## Phase 6: Refunds & Payouts

### Step 6.1: Refunds Module
```typescript
// src/modules/refunds/
├── refunds.module.ts
├── refunds.controller.ts
├── refunds.service.ts
└── dto/
    ├── create-refund.dto.ts
    └── refund-response.dto.ts
```

**Endpoints:**
- `GET /api/stores/:storeId/refunds`
- `POST /api/stores/:storeId/payments/:paymentId/refund`
- `GET /api/stores/:storeId/refunds/:refundId`

**RefundsService:**
```typescript
async createRefund(paymentId: string, params: CreateRefundDto) {
  const payment = await this.prisma.payment.findUnique({ ... });
  
  // Validate refund amount
  const totalRefunded = await this.getTotalRefunded(paymentId);
  if (totalRefunded + params.amount > payment.amount) {
    throw new BadRequestException('Refund exceeds payment amount');
  }
  
  // Create refund in Stripe
  const stripeRefund = await this.stripeProvider.createRefund({
    paymentIntentId: payment.providerPaymentId,
    amount: params.amount,
  });
  
  // Create refund record
  const refund = await this.prisma.refund.create({ ... });
  
  // Update balance
  await this.balanceService.addTransaction({
    type: 'REFUND',
    amount: -params.amount,
    refundId: refund.id,
  });
  
  return refund;
}
```

### Step 6.2: Payouts Module
```typescript
// src/modules/payouts/
├── payouts.module.ts
├── payouts.controller.ts
├── payouts.service.ts
└── dto/
```

**Endpoints:**
- `GET /api/stores/:storeId/payouts`
- `POST /api/stores/:storeId/payouts`
- `GET /api/stores/:storeId/payouts/:payoutId`

**PayoutsService:**
- Validate available balance
- Create payout request
- Update balance (PAYOUT_REQUESTED)
- Process payout (async job)
- Update balance (PAYOUT_COMPLETED)

**Чеклист Phase 6:**
- [ ] Refund создаётся в Stripe
- [ ] Refund entity отдельная от Payment
- [ ] Partial refunds работают
- [ ] Balance уменьшается при refund
- [ ] Payout request создаётся
- [ ] Payout balance tracking работает

---

## Phase 7: Webhooks System

### Step 7.1: Webhooks Module
```typescript
// src/modules/webhooks/
├── webhooks.module.ts
├── webhooks.controller.ts          // Merchant webhook management
├── webhook-endpoints.service.ts
├── webhook-events.service.ts
├── webhook-delivery.service.ts
└── dto/
```

**Endpoints (merchant management):**
- `GET /api/stores/:storeId/webhooks`
- `POST /api/stores/:storeId/webhooks`
- `PATCH /api/stores/:storeId/webhooks/:webhookId`
- `DELETE /api/stores/:storeId/webhooks/:webhookId`
- `GET /api/stores/:storeId/webhooks/:webhookId/deliveries`

### Step 7.2: Webhook Event Types
```typescript
export enum WebhookEventType {
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  SUBSCRIPTION_RENEWED = 'subscription.renewed',
  CUSTOMER_CREATED = 'customer.created',
}
```

### Step 7.3: Webhook Delivery with Retry
```typescript
// src/jobs/processors/webhook.processor.ts
@Processor('webhooks')
export class WebhookProcessor {
  @Process('deliver')
  async handleDelivery(job: Job<{ deliveryId: string }>) {
    const delivery = await this.getDelivery(job.data.deliveryId);
    const endpoint = await this.getEndpoint(delivery.endpointId);
    
    try {
      const response = await this.httpService.post(
        endpoint.url,
        delivery.event.payload,
        {
          headers: {
            'X-Webhook-Signature': this.sign(delivery.event.payload, endpoint.secret),
            'X-Webhook-Id': delivery.event.id,
          },
          timeout: 10000,
        },
      );
      
      await this.markDelivered(delivery.id, response.status);
    } catch (error) {
      await this.handleFailure(delivery, error);
    }
  }
  
  private async handleFailure(delivery, error) {
    const attempt = delivery.attemptNumber;
    
    if (attempt >= 5) {
      await this.markFailed(delivery.id, error.message);
      return;
    }
    
    // Exponential backoff: 1m, 2m, 4m, 8m, 16m
    const delay = Math.pow(2, attempt) * 60 * 1000;
    
    await this.prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        attemptNumber: attempt + 1,
        status: 'RETRYING',
        nextRetryAt: new Date(Date.now() + delay),
        errorMessage: error.message,
      },
    });
    
    await this.webhookQueue.add('deliver', { deliveryId: delivery.id }, { delay });
  }
}
```

### Step 7.4: Webhook Signature
```typescript
private sign(payload: object, secret: string): string {
  const timestamp = Date.now();
  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}
```

**Чеклист Phase 7:**
- [ ] WebhookEndpoint CRUD работает
- [ ] WebhookEvent создаётся при событиях
- [ ] WebhookDelivery отправляется
- [ ] Retry с exponential backoff
- [ ] Signature для верификации
- [ ] Delivery logs доступны мерчанту

---

## Phase 8: Widget API & Customer Portal

### Step 8.1: Widget Module
```typescript
// src/modules/widget/
├── widget.module.ts
├── widget.controller.ts
├── widget.service.ts
└── dto/
```

**Public Endpoints (no auth):**
- `GET /api/widget/pages/:storeSlug/:pageSlug`
- `POST /api/widget/checkout`
- `POST /api/widget/validate-coupon`
- `GET /api/widget/sessions/:sessionId/status`
- `GET /api/widget/embed/:embedId`

### Step 8.2: Widget Controller
```typescript
@Controller('widget')
@Public() // No auth required
@Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 req/min
export class WidgetController {
  @Get('pages/:storeSlug/:pageSlug')
  async getPage(
    @Param('storeSlug') storeSlug: string,
    @Param('pageSlug') pageSlug: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.widgetService.getPageWithSession(storeSlug, pageSlug, { ip, userAgent });
  }
  
  @Post('checkout')
  async initiateCheckout(@Body() dto: InitiateCheckoutDto) {
    return this.checkoutService.initiatePayment(dto.sessionId, dto);
  }
}
```

### Step 8.3: Customers Module
```typescript
// src/modules/customers/
├── customers.module.ts
├── customers.controller.ts
├── customers.service.ts
├── portal/
│   ├── portal.controller.ts
│   ├── portal.service.ts
│   └── dto/
└── dto/
```

**Dashboard Endpoints:**
- `GET /api/stores/:storeId/customers`
- `GET /api/stores/:storeId/customers/:customerId`
- `GET .../customers/:customerId/payments`
- `GET .../customers/:customerId/subscriptions`

**Portal Endpoints (public):**
- `POST /api/portal/request-access` (magic link)
- `GET /api/portal/verify/:token`
- `GET /api/portal/purchases`
- `GET /api/portal/subscriptions`
- `POST /api/portal/subscriptions/:id/cancel`

### Step 8.4: Magic Link Auth
```typescript
// portal.service.ts
async requestAccess(email: string, storeId: string) {
  const customer = await this.findByEmail(email, storeId);
  if (!customer) throw new NotFoundException('Customer not found');
  
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
  
  await this.prisma.customerPortalSession.create({
    data: { customerId: customer.id, token, expiresAt },
  });
  
  await this.emailService.sendMagicLink(email, token);
  
  return { message: 'Magic link sent' };
}

async verifyToken(token: string) {
  const session = await this.prisma.customerPortalSession.findUnique({
    where: { token },
    include: { customer: true },
  });
  
  if (!session || session.expiresAt < new Date()) {
    throw new UnauthorizedException('Invalid or expired token');
  }
  
  // Mark as used
  await this.prisma.customerPortalSession.update({
    where: { id: session.id },
    data: { usedAt: new Date() },
  });
  
  // Return JWT for portal
  return this.generatePortalToken(session.customer);
}
```

**Чеклист Phase 8:**
- [ ] Widget page endpoint работает
- [ ] Checkout initiation через widget
- [ ] Session status polling
- [ ] Coupon validation
- [ ] Customers CRUD (dashboard)
- [ ] Portal magic link
- [ ] Portal subscription cancel

---

## Phase 9: Testing & Polish

### Step 9.1: Unit Tests
```bash
# Приоритетные тесты
src/modules/auth/auth.service.spec.ts
src/modules/checkout/checkout-session.service.spec.ts
src/modules/checkout/checkout-session.machine.spec.ts
src/modules/payments/payments.service.spec.ts
src/modules/balance/balance.service.spec.ts
src/modules/webhooks/webhook-delivery.service.spec.ts
```

### Step 9.2: E2E Tests
```typescript
// test/auth.e2e-spec.ts
// test/checkout-flow.e2e-spec.ts
// test/payment-flow.e2e-spec.ts
// test/subscription-flow.e2e-spec.ts
// test/refund-flow.e2e-spec.ts
```

### Step 9.3: Checkout Flow E2E Test
```typescript
describe('Checkout Flow', () => {
  it('should complete one-time payment', async () => {
    // 1. Create session
    const session = await request(app)
      .get('/api/widget/pages/test-store/test-page')
      .expect(200);
    
    // 2. Update session
    await request(app)
      .patch(`/api/widget/sessions/${session.body.sessionId}`)
      .send({ email: 'test@example.com' });
    
    // 3. Initiate payment
    const payment = await request(app)
      .post('/api/widget/checkout')
      .send({ sessionId: session.body.sessionId })
      .expect(200);
    
    expect(payment.body.clientSecret).toBeDefined();
    
    // 4. Simulate webhook
    await request(app)
      .post('/api/webhooks/stripe')
      .set('stripe-signature', mockSignature)
      .send(mockWebhookPayload('payment_intent.succeeded'))
      .expect(200);
    
    // 5. Verify completion
    const status = await request(app)
      .get(`/api/widget/sessions/${session.body.sessionId}/status`)
      .expect(200);
    
    expect(status.body.status).toBe('COMPLETED');
  });
});
```

### Step 9.4: API Documentation
```bash
npm install @nestjs/swagger swagger-ui-express
```

Добавить Swagger декораторы на все endpoints.

### Step 9.5: Final Checklist
- [ ] All endpoints work
- [ ] All tests pass (80%+ coverage)
- [ ] Swagger documentation complete
- [ ] Error handling consistent
- [ ] Rate limiting configured
- [ ] Logging configured
- [ ] Health check endpoint
- [ ] Docker production build

**Чеклист Phase 9:**
- [ ] Unit tests написаны
- [ ] E2E tests для critical flows
- [ ] Coverage > 80%
- [ ] Swagger docs
- [ ] Production Dockerfile
- [ ] README.md

---

## 🎉 Completion Checklist

### P0 (Must Have for MVP)
- [ ] Auth (register, login, refresh)
- [ ] Stores CRUD
- [ ] Pages CRUD with variants & fields
- [ ] CheckoutSession state machine
- [ ] Stripe payment processing
- [ ] PaymentAttempt tracking
- [ ] Balance ledger
- [ ] Widget API
- [ ] PSP webhooks

### P1 (Should Have)
- [ ] Subscriptions
- [ ] Refunds
- [ ] Payouts
- [ ] Merchant webhooks
- [ ] Customer portal
- [ ] Coupons
- [ ] Embeds

### P2 (Nice to Have)
- [ ] Multiple PSP providers
- [ ] Advanced analytics
- [ ] Team roles
- [ ] Email notifications

---

*Implementation Plan v1.0 — January 11, 2026*
