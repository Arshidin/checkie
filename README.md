# Checkie Backend

Hosted checkout page platform backend — аналог Checkout Page / Gumroad.

## Quick Start

```bash
# 1. Clone and install
git clone <repo>
cd checkie-backend
npm install

# 2. Start services
docker-compose up -d

# 3. Setup environment
cp .env.example .env
# Edit .env with your values

# 4. Run migrations
npx prisma migrate dev

# 5. Start development
npm run start:dev
```

## Documentation

| Document | Description |
|----------|-------------|
| [CLAUDE.md](./CLAUDE.md) | Project context for AI development |
| [IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) | Step-by-step implementation guide |
| [API Endpoints](./docs/specs/api-endpoints.md) | Complete API reference |
| [State Machine](./docs/specs/checkout-state-machine.md) | Checkout session lifecycle |
| [Architecture Review](./docs/specs/architecture-review.md) | System design decisions |

## Tech Stack

- **Runtime:** Node.js 20 LTS
- **Framework:** NestJS 10
- **Database:** PostgreSQL 16 + Prisma
- **Cache/Queue:** Redis + BullMQ
- **Auth:** JWT + Refresh Tokens
- **Payments:** Stripe

## Commands

```bash
npm run start:dev      # Development
npm run build          # Production build
npm run test           # Unit tests
npm run test:e2e       # E2E tests
npm run test:cov       # Coverage report
npx prisma studio      # Database GUI
```

## Project Structure

```
src/
├── modules/
│   ├── auth/          # Authentication
│   ├── stores/        # Merchant accounts
│   ├── pages/         # Checkout pages
│   ├── checkout/      # Checkout session & state machine
│   ├── payments/      # Payment processing
│   ├── subscriptions/ # Recurring billing
│   ├── webhooks/      # Webhook delivery
│   └── widget/        # Public checkout API
├── common/            # Shared utilities
├── config/            # Configuration
└── jobs/              # Background processors
```

## License

Private
