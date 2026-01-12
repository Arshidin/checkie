import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import * as Joi from 'joi';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { StoresModule } from './modules/stores/stores.module';
import { PagesModule } from './modules/pages/pages.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { BalanceModule } from './modules/balance/balance.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { WidgetModule } from './modules/widget/widget.module';
import { CustomersModule } from './modules/customers/customers.module';
import { HealthModule } from './health/health.module';
import { configuration } from './config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000),

        // Database
        DATABASE_URL: Joi.string().required(),

        // Redis
        REDIS_URL: Joi.string().required(),

        // JWT
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.string().default('15m'),
        REFRESH_TOKEN_EXPIRATION: Joi.string().default('7d'),

        // Encryption
        ENCRYPTION_KEY: Joi.string().min(32).required(),

        // Stripe (optional in dev mode - stub provider used if not set)
        STRIPE_SECRET_KEY: Joi.string().optional().allow(''),
        STRIPE_WEBHOOK_SECRET: Joi.string().optional().allow(''),

        // URLs
        APP_URL: Joi.string().default('http://localhost:3000'),
        WIDGET_URL: Joi.string().default('http://localhost:3001'),

        // Platform
        PLATFORM_FEE_PERCENT: Joi.number().default(0.029),
      }),
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Database
    PrismaModule,

    // Cache
    RedisModule,

    // BullMQ for background jobs
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('redis.url');
        const isProduction = process.env.NODE_ENV === 'production';

        if (redisUrl && redisUrl !== 'redis://localhost:6379') {
          // Parse URL for BullMQ - it needs explicit host/port/password
          try {
            const parsed = new URL(redisUrl);
            const useTls = parsed.protocol === 'rediss:' || isProduction;
            return {
              connection: {
                host: parsed.hostname,
                port: parseInt(parsed.port || '6379', 10),
                password: parsed.password || undefined,
                maxRetriesPerRequest: 3,
                connectTimeout: 10000,
                // Railway public Redis requires TLS
                ...(useTls && { tls: {} }),
              },
            };
          } catch {
            // Fallback if URL parsing fails
          }
        }
        // Fallback to localhost for development
        return {
          connection: {
            host: 'localhost',
            port: 6379,
          },
        };
      },
    }),

    // Feature Modules
    AuthModule,
    UsersModule,
    StoresModule,
    PagesModule,
    CouponsModule,
    CheckoutModule,

    // Phase 4: Payments & PSP
    ProvidersModule,
    PaymentsModule,
    BalanceModule,

    // Phase 5: Subscriptions
    SubscriptionsModule,

    // Phase 6: Refunds & Payouts
    RefundsModule,
    PayoutsModule,

    // Phase 7: Webhooks
    WebhooksModule,

    // Phase 8: Widget & Customer Portal
    WidgetModule,
    CustomersModule,

    // Phase 9: Health & Monitoring
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
