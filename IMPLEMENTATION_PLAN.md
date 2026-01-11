# IMPLEMENTATION_PLAN.md — Пошаговый план реализации Checkie Backend

> Этот документ содержит детальный план реализации всех доработок.
> Выполняй шаги последовательно, не пропуская.

---

## 📋 Обзор фаз

| Фаза | Название | Длительность | Статус |
|------|----------|--------------|--------|
| 0 | Project Setup | 1 день | ✅ Done |
| 1 | Foundation (Auth + Users + Stores) | 3 дня | ✅ Done |
| 2 | Pages & Configuration | 3 дня | ✅ Done |
| 3 | Checkout Session & State Machine | 3 дня | ✅ Done |
| 4 | Payments & PSP Integration | 3 дня | ✅ Done |
| 5 | Subscriptions | 2 дня | ⬜ Not Started |
| 6 | Refunds & Payouts | 2 дня | ⬜ Not Started |
| 7 | Webhooks System | 2 дня | ⬜ Not Started |
| 8 | Widget API & Customer Portal | 2 дня | ⬜ Not Started |
| 9 | Testing & Polish | 2 дня | 🟡 Partial (4 unit tests) |

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
- [x] State machine работает (XState 5)
- [x] State сохраняется в Redis
- [x] Guards проверяют условия (isValidForPayment, canRetry, isAmountValid)
- [x] Actions выполняются при переходах
- [x] IdempotencyKey предотвращает дубли
- [x] Session expiry работает

---

## Phase 4: Payments & PSP Integration

> **Цель:** Реализовать полный payment flow через Stripe с поддержкой 3DS, webhook'ов и balance ledger.

---

### Step 4.1: Providers Module — Абстракция PSP

**Файловая структура:**
```
src/modules/providers/
├── providers.module.ts
├── interfaces/
│   ├── payment-provider.interface.ts
│   ├── payment-intent.interface.ts
│   └── webhook-event.interface.ts
├── dto/
│   ├── create-payment-intent.dto.ts
│   └── refund.dto.ts
├── provider.factory.ts
├── provider.constants.ts
└── stripe/
    ├── stripe.module.ts
    ├── stripe.provider.ts
    ├── stripe.webhook.handler.ts
    ├── stripe.types.ts
    └── stripe.utils.ts
```

**Задачи:**
1. Создать `PaymentProviderInterface` — унифицированный интерфейс для всех PSP
2. Реализовать `StripeProvider` с полным функционалом
3. Создать `ProviderFactory` для получения провайдера по коду
4. Добавить utility для шифрования/дешифрования credentials

---

### Step 4.2: Payment Provider Interface

```typescript
// src/modules/providers/interfaces/payment-provider.interface.ts

export interface CreatePaymentIntentParams {
  amount: number;              // В основных единицах (доллары, евро)
  currency: string;
  customerId?: string;         // Stripe customer ID
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
  id: string;                  // Provider's payment intent ID
  clientSecret: string;        // For frontend SDK
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
  amount?: number;             // Partial refund
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

  // Payment Intents
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult>;
  retrievePaymentIntent(id: string): Promise<PaymentIntentResult>;
  confirmPaymentIntent(params: ConfirmPaymentParams): Promise<PaymentIntentResult>;
  cancelPaymentIntent(id: string): Promise<void>;

  // Refunds
  createRefund(params: RefundParams): Promise<RefundResult>;

  // Customers (for saved payment methods)
  createCustomer(email: string, metadata?: Record<string, string>): Promise<string>;

  // Webhooks
  constructWebhookEvent(payload: Buffer, signature: string): WebhookEventResult;
}
```

---

### Step 4.3: Stripe Provider Implementation

```typescript
// src/modules/providers/stripe/stripe.provider.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  PaymentProvider,
  CreatePaymentIntentParams,
  PaymentIntentResult,
  ConfirmPaymentParams,
  RefundParams,
  RefundResult,
  WebhookEventResult,
} from '../interfaces/payment-provider.interface';

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly code = 'stripe';
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly logger = new Logger(StripeProvider.name);

  constructor(private readonly config: ConfigService) {
    this.stripe = new Stripe(config.get('stripe.secretKey'), {
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    });
    this.webhookSecret = config.get('stripe.webhookSecret');
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    const intent = await this.stripe.paymentIntents.create({
      amount: this.toSmallestUnit(params.amount, params.currency),
      currency: params.currency.toLowerCase(),
      metadata: params.metadata,
      receipt_email: params.customerEmail,
      customer: params.customerId,
      automatic_payment_methods: { enabled: true },
      setup_future_usage: params.setupFutureUsage,
      statement_descriptor_suffix: params.statementDescriptor?.substring(0, 22),
    });

    return this.mapPaymentIntent(intent);
  }

  async retrievePaymentIntent(id: string): Promise<PaymentIntentResult> {
    const intent = await this.stripe.paymentIntents.retrieve(id);
    return this.mapPaymentIntent(intent);
  }

  async confirmPaymentIntent(params: ConfirmPaymentParams): Promise<PaymentIntentResult> {
    const intent = await this.stripe.paymentIntents.confirm(params.paymentIntentId, {
      payment_method: params.paymentMethodId,
      return_url: params.returnUrl,
    });
    return this.mapPaymentIntent(intent);
  }

  async cancelPaymentIntent(id: string): Promise<void> {
    await this.stripe.paymentIntents.cancel(id);
  }

  async createRefund(params: RefundParams): Promise<RefundResult> {
    const refund = await this.stripe.refunds.create({
      payment_intent: params.paymentIntentId,
      amount: params.amount ? this.toSmallestUnit(params.amount, 'usd') : undefined,
      reason: params.reason,
      metadata: params.metadata,
    });

    return {
      id: refund.id,
      status: refund.status as RefundResult['status'],
      amount: this.fromSmallestUnit(refund.amount, refund.currency),
      currency: refund.currency.toUpperCase(),
    };
  }

  async createCustomer(email: string, metadata?: Record<string, string>): Promise<string> {
    const customer = await this.stripe.customers.create({ email, metadata });
    return customer.id;
  }

  constructWebhookEvent(payload: Buffer, signature: string): WebhookEventResult {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret,
      );

      return {
        type: event.type,
        id: event.id,
        data: event.data.object,
        metadata: (event.data.object as any).metadata,
      };
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  // === Private Helpers ===

  private mapPaymentIntent(intent: Stripe.PaymentIntent): PaymentIntentResult {
    return {
      id: intent.id,
      clientSecret: intent.client_secret,
      status: intent.status as PaymentIntentResult['status'],
      amount: this.fromSmallestUnit(intent.amount, intent.currency),
      currency: intent.currency.toUpperCase(),
      requiresAction: intent.status === 'requires_action',
      nextActionType: intent.next_action?.type,
      nextActionUrl: intent.next_action?.redirect_to_url?.url,
    };
  }

  private toSmallestUnit(amount: number, currency: string): number {
    // Zero-decimal currencies (JPY, KRW, etc.)
    const zeroDecimalCurrencies = ['jpy', 'krw', 'vnd', 'bif', 'clp', 'djf', 'gnf', 'kmf', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'];
    if (zeroDecimalCurrencies.includes(currency.toLowerCase())) {
      return Math.round(amount);
    }
    return Math.round(amount * 100);
  }

  private fromSmallestUnit(amount: number, currency: string): number {
    const zeroDecimalCurrencies = ['jpy', 'krw', 'vnd', 'bif', 'clp', 'djf', 'gnf', 'kmf', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'];
    if (zeroDecimalCurrencies.includes(currency.toLowerCase())) {
      return amount;
    }
    return amount / 100;
  }
}
```

---

### Step 4.4: Provider Factory & Module

```typescript
// src/modules/providers/provider.factory.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentProvider } from './interfaces/payment-provider.interface';
import { StripeProvider } from './stripe/stripe.provider';

@Injectable()
export class ProviderFactory {
  private readonly providers: Map<string, PaymentProvider>;

  constructor(private readonly stripeProvider: StripeProvider) {
    this.providers = new Map([
      ['stripe', stripeProvider],
    ]);
  }

  getProvider(code: string): PaymentProvider {
    const provider = this.providers.get(code.toLowerCase());
    if (!provider) {
      throw new NotFoundException(`Payment provider '${code}' not found`);
    }
    return provider;
  }

  getDefaultProvider(): PaymentProvider {
    return this.stripeProvider;
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

// src/modules/providers/providers.module.ts

import { Module, Global } from '@nestjs/common';
import { StripeProvider } from './stripe/stripe.provider';
import { ProviderFactory } from './provider.factory';

@Global()
@Module({
  providers: [StripeProvider, ProviderFactory],
  exports: [StripeProvider, ProviderFactory],
})
export class ProvidersModule {}
```

---

### Step 4.5: Payments Module

**Файловая структура:**
```
src/modules/payments/
├── payments.module.ts
├── payments.controller.ts
├── payments.service.ts
├── payment-attempt.service.ts
├── webhooks/
│   ├── psp-webhook.controller.ts
│   └── webhook-handler.service.ts
└── dto/
    ├── initiate-payment.dto.ts
    ├── payment-response.dto.ts
    ├── payment-list.dto.ts
    └── payment-filter.dto.ts
```

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stores/:storeId/payments` | Список платежей (paginated) |
| GET | `/api/stores/:storeId/payments/:paymentId` | Детали платежа |
| GET | `/api/stores/:storeId/payments/:paymentId/attempts` | История попыток |
| GET | `/api/stores/:storeId/payments/export` | Экспорт в CSV |
| POST | `/api/webhooks/stripe` | Stripe webhook (public) |

---

### Step 4.6: Payments Service

```typescript
// src/modules/payments/payments.service.ts

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProviderFactory } from '../providers/provider.factory';
import { BalanceService } from '../balance/balance.service';
import { CheckoutSessionService } from '../checkout/services/checkout-session.service';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface InitiatePaymentParams {
  checkoutSessionId: string;
  paymentMethodId?: string;
  returnUrl?: string;
}

export interface InitiatePaymentResult {
  paymentId: string;
  clientSecret: string;
  status: string;
  requiresAction: boolean;
  nextActionUrl?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly platformFeePercent: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: ProviderFactory,
    private readonly balanceService: BalanceService,
    private readonly checkoutSessionService: CheckoutSessionService,
    private readonly config: ConfigService,
  ) {
    this.platformFeePercent = config.get('platform.feePercent', 0.029);
  }

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const session = await this.checkoutSessionService.getSession(params.checkoutSessionId);

    if (session.status !== 'OPEN') {
      throw new BadRequestException('Session is not in OPEN state');
    }

    // Trigger state machine transition
    await this.checkoutSessionService.sendEvent(session.id, {
      type: 'INITIATE_PAYMENT',
      paymentMethodId: params.paymentMethodId,
    });

    // Create Payment record
    const payment = await this.createPayment(session);

    // Create PaymentAttempt
    const attempt = await this.createPaymentAttempt(payment.id, session.id);

    // Get provider and create PaymentIntent
    const provider = this.providerFactory.getDefaultProvider();

    const intentResult = await provider.createPaymentIntent({
      amount: Number(session.amount) - Number(session.discountAmount),
      currency: session.currency,
      customerEmail: session.customer?.email,
      metadata: {
        storeId: session.storeId,
        pageId: session.pageId,
        checkoutSessionId: session.id,
        paymentId: payment.id,
      },
    });

    // Update PaymentAttempt with provider data
    await this.prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        providerAttemptId: intentResult.id,
        status: intentResult.requiresAction ? 'REQUIRES_ACTION' : 'PROCESSING',
        requires3DS: intentResult.requiresAction,
        redirectUrl: intentResult.nextActionUrl,
      },
    });

    // Update Payment with provider ID
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: intentResult.id,
        status: 'PROCESSING',
      },
    });

    // If requires 3DS, send event to state machine
    if (intentResult.requiresAction) {
      await this.checkoutSessionService.sendEvent(session.id, {
        type: 'REQUIRES_ACTION',
        actionType: intentResult.nextActionType || '3ds',
        redirectUrl: intentResult.nextActionUrl || '',
      });
    }

    return {
      paymentId: payment.id,
      clientSecret: intentResult.clientSecret,
      status: intentResult.status,
      requiresAction: intentResult.requiresAction,
      nextActionUrl: intentResult.nextActionUrl,
    };
  }

  async handleWebhookEvent(
    provider: string,
    eventType: string,
    data: any,
    metadata: Record<string, string>,
  ): Promise<void> {
    const { checkoutSessionId, paymentId } = metadata;

    this.logger.log(`Webhook: ${provider}/${eventType} for payment ${paymentId}`);

    switch (eventType) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(paymentId, checkoutSessionId, data);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(paymentId, checkoutSessionId, data);
        break;

      case 'payment_intent.requires_action':
        // Already handled at intent creation
        break;

      case 'payment_intent.canceled':
        await this.handlePaymentCanceled(paymentId, checkoutSessionId);
        break;

      default:
        this.logger.debug(`Unhandled webhook event: ${eventType}`);
    }
  }

  private async handlePaymentSuccess(
    paymentId: string,
    checkoutSessionId: string,
    providerData: any,
  ): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { store: true },
    });

    if (!payment || payment.status === 'COMPLETED') {
      return; // Already processed or not found
    }

    const amount = Number(payment.amount);
    const platformFee = new Decimal(amount * this.platformFeePercent);
    const processingFee = new Decimal(0); // Stripe fee is in providerData
    const netAmount = new Decimal(amount).minus(platformFee).minus(processingFee);

    // Update payment
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'COMPLETED',
        platformFee,
        processingFee,
        netAmount,
        completedAt: new Date(),
        providerData,
      },
    });

    // Update last attempt
    await this.prisma.paymentAttempt.updateMany({
      where: { paymentId, status: { in: ['PENDING', 'PROCESSING', 'REQUIRES_ACTION'] } },
      data: { status: 'SUCCEEDED', completedAt: new Date() },
    });

    // Add balance transaction
    await this.balanceService.addTransaction({
      storeId: payment.storeId,
      paymentId: payment.id,
      type: 'PAYMENT_RECEIVED',
      amount: netAmount,
      currency: payment.currency,
      description: `Payment received`,
    });

    // Deduct platform fee
    await this.balanceService.addTransaction({
      storeId: payment.storeId,
      paymentId: payment.id,
      type: 'FEE',
      amount: platformFee.negated(),
      currency: payment.currency,
      description: `Platform fee (${this.platformFeePercent * 100}%)`,
    });

    // Send success event to checkout session
    await this.checkoutSessionService.sendEvent(checkoutSessionId, {
      type: 'PAYMENT_SUCCEEDED',
      providerPaymentId: providerData.id,
      amount,
      providerData,
    });

    this.logger.log(`Payment ${paymentId} completed successfully`);
  }

  private async handlePaymentFailure(
    paymentId: string,
    checkoutSessionId: string,
    providerData: any,
  ): Promise<void> {
    const failureCode = providerData.last_payment_error?.code || 'unknown';
    const failureMessage = providerData.last_payment_error?.message || 'Payment failed';

    // Update payment
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'FAILED', providerData },
    });

    // Update last attempt
    await this.prisma.paymentAttempt.updateMany({
      where: { paymentId, status: { in: ['PENDING', 'PROCESSING', 'REQUIRES_ACTION'] } },
      data: {
        status: 'FAILED',
        failureCode,
        failureMessage,
        completedAt: new Date(),
      },
    });

    // Send failure event to checkout session
    await this.checkoutSessionService.sendEvent(checkoutSessionId, {
      type: 'PAYMENT_FAILED',
      failureCode,
      failureMessage,
    });

    this.logger.warn(`Payment ${paymentId} failed: ${failureMessage}`);
  }

  private async handlePaymentCanceled(
    paymentId: string,
    checkoutSessionId: string,
  ): Promise<void> {
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'CANCELLED' },
    });

    await this.checkoutSessionService.sendEvent(checkoutSessionId, {
      type: 'CANCEL',
    });
  }

  private async createPayment(session: any): Promise<Payment> {
    const page = await this.prisma.page.findUnique({
      where: { id: session.pageId }
    });

    // Find or create customer
    let customerId = session.customerId;
    if (!customerId && session.customer?.email) {
      const customer = await this.prisma.customer.upsert({
        where: {
          storeId_email: {
            storeId: session.storeId,
            email: session.customer.email
          }
        },
        create: {
          storeId: session.storeId,
          email: session.customer.email,
        },
        update: {},
      });
      customerId = customer.id;
    }

    return this.prisma.payment.create({
      data: {
        storeId: session.storeId,
        pageId: session.pageId,
        customerId,
        amount: session.amount,
        currency: session.currency,
        status: 'PENDING',
        paymentProvider: 'stripe',
        couponId: session.couponId,
        discountAmount: session.discountAmount,
      },
    });
  }

  private async createPaymentAttempt(paymentId: string, sessionId: string) {
    const existingAttempts = await this.prisma.paymentAttempt.count({
      where: { paymentId },
    });

    return this.prisma.paymentAttempt.create({
      data: {
        paymentId,
        checkoutSessionId: sessionId,
        attemptNumber: existingAttempts + 1,
        providerId: 'stripe',
        status: 'PENDING',
      },
    });
  }

  // === Query Methods ===

  async findByStore(storeId: string, filters?: {
    status?: PaymentStatus;
    pageId?: string;
    customerId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const where: Prisma.PaymentWhereInput = {
      storeId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.pageId && { pageId: filters.pageId }),
      ...(filters?.customerId && { customerId: filters.customerId }),
      ...(filters?.startDate || filters?.endDate) && {
        createdAt: {
          ...(filters?.startDate && { gte: filters.startDate }),
          ...(filters?.endDate && { lte: filters.endDate }),
        },
      },
    };

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: { customer: true, page: true, coupon: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments,
      meta: { total, page, limit, hasMore: total > page * limit },
    };
  }

  async findById(paymentId: string, storeId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, storeId },
      include: {
        customer: true,
        page: true,
        coupon: true,
        attempts: { orderBy: { createdAt: 'desc' } },
        customFieldValues: { include: { customField: true } },
        refunds: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }
}
```

---

### Step 4.7: PSP Webhook Controller

```typescript
// src/modules/payments/webhooks/psp-webhook.controller.ts

import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  RawBodyRequest,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { StripeProvider } from '../../providers/stripe/stripe.provider';
import { PaymentsService } from '../payments.service';

@Controller('webhooks')
export class PspWebhookController {
  private readonly logger = new Logger(PspWebhookController.name);

  constructor(
    private readonly stripeProvider: StripeProvider,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post('stripe')
  @Public()
  @HttpCode(200)
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody;

    if (!rawBody) {
      this.logger.error('Missing raw body in webhook request');
      return { received: false, error: 'Missing body' };
    }

    try {
      const event = this.stripeProvider.constructWebhookEvent(rawBody, signature);

      await this.paymentsService.handleWebhookEvent(
        'stripe',
        event.type,
        event.data,
        event.metadata || {},
      );

      return { received: true };
    } catch (error) {
      this.logger.error(`Webhook error: ${error.message}`);
      return { received: false, error: error.message };
    }
  }
}
```

**Важно:** Добавить в `main.ts` raw body parsing:
```typescript
// main.ts
app.useBodyParser('json', {
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  },
});
```

---

### Step 4.8: Balance Module

**Файловая структура:**
```
src/modules/balance/
├── balance.module.ts
├── balance.controller.ts
├── balance.service.ts
└── dto/
    ├── balance-response.dto.ts
    ├── transaction-list.dto.ts
    └── add-transaction.dto.ts
```

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stores/:storeId/balance` | Текущий баланс |
| GET | `/api/stores/:storeId/balance/transactions` | История транзакций |
| GET | `/api/stores/:storeId/balance/summary` | Сводка за период |

---

### Step 4.9: Balance Service

```typescript
// src/modules/balance/balance.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BalanceTransactionType, Currency, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface AddTransactionParams {
  storeId: string;
  paymentId?: string;
  refundId?: string;
  payoutId?: string;
  type: BalanceTransactionType;
  amount: Decimal | number;
  currency: Currency;
  description?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Добавляет транзакцию в ledger (append-only)
   * Использует транзакцию БД для обеспечения консистентности
   */
  async addTransaction(params: AddTransactionParams) {
    return this.prisma.$transaction(async (tx) => {
      // Получить последнюю транзакцию для баланса
      const lastTx = await tx.balanceTransaction.findFirst({
        where: { storeId: params.storeId, currency: params.currency },
        orderBy: { createdAt: 'desc' },
      });

      const currentBalance = lastTx?.balanceAfter ?? new Decimal(0);
      const amount = new Decimal(params.amount);
      const balanceAfter = currentBalance.plus(amount);

      // Проверка на отрицательный баланс (только для выплат)
      if (params.type === 'PAYOUT_REQUESTED' && balanceAfter.lessThan(0)) {
        throw new BadRequestException('Insufficient balance for payout');
      }

      const transaction = await tx.balanceTransaction.create({
        data: {
          storeId: params.storeId,
          paymentId: params.paymentId,
          refundId: params.refundId,
          payoutId: params.payoutId,
          type: params.type,
          amount,
          currency: params.currency,
          balanceAfter,
          description: params.description,
          metadata: params.metadata,
        },
      });

      this.logger.log(
        `Balance transaction: ${params.type} ${amount} ${params.currency}, new balance: ${balanceAfter}`,
      );

      return transaction;
    });
  }

  /**
   * Получить текущий баланс магазина
   */
  async getBalance(storeId: string, currency?: Currency) {
    const where: Prisma.BalanceTransactionWhereInput = { storeId };
    if (currency) {
      where.currency = currency;
    }

    // Группируем по валюте
    const balances = await this.prisma.$queryRaw<
      { currency: string; balance: Decimal }[]
    >`
      SELECT
        currency,
        (SELECT balance_after FROM balance_transactions
         WHERE store_id = ${storeId} AND currency = bt.currency
         ORDER BY created_at DESC LIMIT 1) as balance
      FROM balance_transactions bt
      WHERE store_id = ${storeId}
      ${currency ? Prisma.sql`AND currency = ${currency}` : Prisma.empty}
      GROUP BY currency
    `;

    // Если нет транзакций, вернуть нули
    if (balances.length === 0) {
      return currency
        ? { currency, balance: new Decimal(0) }
        : { balances: [] };
    }

    if (currency) {
      return {
        currency,
        balance: balances[0]?.balance ?? new Decimal(0)
      };
    }

    return { balances };
  }

  /**
   * История транзакций
   */
  async getTransactions(
    storeId: string,
    filters?: {
      type?: BalanceTransactionType;
      currency?: Currency;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    },
  ) {
    const where: Prisma.BalanceTransactionWhereInput = {
      storeId,
      ...(filters?.type && { type: filters.type }),
      ...(filters?.currency && { currency: filters.currency }),
      ...((filters?.startDate || filters?.endDate) && {
        createdAt: {
          ...(filters?.startDate && { gte: filters.startDate }),
          ...(filters?.endDate && { lte: filters.endDate }),
        },
      }),
    };

    const page = filters?.page || 1;
    const limit = filters?.limit || 50;

    const [transactions, total] = await Promise.all([
      this.prisma.balanceTransaction.findMany({
        where,
        include: { payment: true, refund: true, payout: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.balanceTransaction.count({ where }),
    ]);

    return {
      data: transactions,
      meta: { total, page, limit, hasMore: total > page * limit },
    };
  }

  /**
   * Сводка за период
   */
  async getSummary(
    storeId: string,
    startDate: Date,
    endDate: Date,
    currency?: Currency,
  ) {
    const where: Prisma.BalanceTransactionWhereInput = {
      storeId,
      createdAt: { gte: startDate, lte: endDate },
      ...(currency && { currency }),
    };

    const transactions = await this.prisma.balanceTransaction.findMany({
      where,
      select: { type: true, amount: true, currency: true },
    });

    const summary = {
      totalReceived: new Decimal(0),
      totalRefunds: new Decimal(0),
      totalFees: new Decimal(0),
      totalPayouts: new Decimal(0),
      netChange: new Decimal(0),
    };

    for (const tx of transactions) {
      const amount = new Decimal(tx.amount);
      switch (tx.type) {
        case 'PAYMENT_RECEIVED':
          summary.totalReceived = summary.totalReceived.plus(amount);
          break;
        case 'REFUND':
          summary.totalRefunds = summary.totalRefunds.plus(amount.abs());
          break;
        case 'FEE':
          summary.totalFees = summary.totalFees.plus(amount.abs());
          break;
        case 'PAYOUT_COMPLETED':
          summary.totalPayouts = summary.totalPayouts.plus(amount.abs());
          break;
      }
      summary.netChange = summary.netChange.plus(amount);
    }

    return summary;
  }
}
```

---

### Step 4.10: Payments Controller

```typescript
// src/modules/payments/payments.controller.ts

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaymentsService, InitiatePaymentParams } from './payments.service';
import { StoreUserRole, PaymentStatus } from '@prisma/client';

@Controller('stores/:storeId/payments')
@UseGuards(JwtAuthGuard, StoreAccessGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER, StoreUserRole.VIEWER)
  async list(
    @Param('storeId') storeId: string,
    @Query('status') status?: PaymentStatus,
    @Query('pageId') pageId?: string,
    @Query('customerId') customerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.findByStore(storeId, {
      status,
      pageId,
      customerId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':paymentId')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER, StoreUserRole.VIEWER)
  async get(
    @Param('storeId') storeId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.paymentsService.findById(paymentId, storeId);
  }

  @Get(':paymentId/attempts')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  async getAttempts(
    @Param('storeId') storeId: string,
    @Param('paymentId') paymentId: string,
  ) {
    const payment = await this.paymentsService.findById(paymentId, storeId);
    return payment.attempts;
  }
}
```

---

### Step 4.11: Интеграция с Checkout Flow

Обновить `CheckoutController` для инициации платежа:

```typescript
// В src/modules/checkout/checkout.controller.ts добавить:

@Post('sessions/:sessionId/pay')
@Public() // Доступно из widget без auth
async initiatePayment(
  @Param('sessionId') sessionId: string,
  @Body() dto: InitiatePaymentDto,
) {
  return this.paymentsService.initiatePayment({
    checkoutSessionId: sessionId,
    paymentMethodId: dto.paymentMethodId,
    returnUrl: dto.returnUrl,
  });
}
```

---

### Step 4.12: Конфигурация Stripe

Обновить `src/config/configuration.ts`:

```typescript
export default () => ({
  // ... existing config
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    apiVersion: '2024-12-18.acacia',
  },
  platform: {
    feePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT || '0.029'),
  },
});
```

---

### Чеклист Phase 4

**Providers Module:**
- [x] `PaymentProviderInterface` создан
- [x] `StripeProvider` реализован (STUB mode)
- [x] `ProviderFactory` создан
- [x] Currency conversion (to/from smallest unit)
- [x] Webhook signature verification (stub mode)

**Payments Module:**
- [x] `PaymentsService` с `initiatePayment`
- [x] `PaymentAttempt` tracking для логирования
- [x] `PspWebhookController` с raw body parsing
- [x] Обработка `payment_intent.succeeded`
- [x] Обработка `payment_intent.payment_failed`
- [x] Обработка 3DS (`requires_action`)
- [x] Платежи endpoint: list, get, attempts

**Balance Module:**
- [x] `BalanceService.addTransaction` (append-only)
- [x] `getBalance` с группировкой по валюте
- [x] `getTransactions` с фильтрацией
- [x] `getSummary` для отчётов
- [x] Проверка на отрицательный баланс

**Integration:**
- [x] Raw body parsing в main.ts
- [x] Checkout → Payment flow работает
- [x] State machine получает события от webhook
- [x] Platform fee вычитается автоматически

**Testing:**
- [ ] Unit tests для PaymentsService
- [ ] Unit tests для BalanceService
- [ ] Integration test: полный payment flow
- [ ] Webhook signature test

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
- [x] Auth (register, login, refresh)
- [x] Stores CRUD
- [x] Pages CRUD with variants & fields
- [x] CheckoutSession state machine
- [x] Stripe payment processing (STUB mode)
- [x] PaymentAttempt tracking
- [x] Balance ledger
- [ ] Widget API
- [x] PSP webhooks

### P1 (Should Have)
- [ ] Subscriptions
- [ ] Refunds
- [ ] Payouts
- [ ] Merchant webhooks
- [ ] Customer portal
- [x] Coupons
- [x] Embeds

### P2 (Nice to Have)
- [ ] Multiple PSP providers
- [ ] Advanced analytics
- [ ] Team roles
- [ ] Email notifications

---

*Implementation Plan v1.1 — January 11, 2026 (Status Updated)*
