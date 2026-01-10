import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
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

        // Stripe
        STRIPE_SECRET_KEY: Joi.string().required(),
        STRIPE_WEBHOOK_SECRET: Joi.string().required(),

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

    // Modules will be added here as we implement them:
    // AuthModule,
    // UsersModule,
    // StoresModule,
    // PagesModule,
    // CheckoutModule,
    // PaymentsModule,
    // SubscriptionsModule,
    // CustomersModule,
    // BalanceModule,
    // PayoutsModule,
    // RefundsModule,
    // CouponsModule,
    // WebhooksModule,
    // ProvidersModule,
    // NotificationsModule,
    // WidgetModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
