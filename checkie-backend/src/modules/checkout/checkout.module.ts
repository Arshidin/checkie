import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { CheckoutSessionService } from './services/checkout-session.service';
import { IdempotencyService } from './services/idempotency.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, CheckoutSessionService, IdempotencyService],
  exports: [CheckoutService, CheckoutSessionService, IdempotencyService],
})
export class CheckoutModule {}
