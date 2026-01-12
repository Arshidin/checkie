import { Module, forwardRef } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { BalanceModule } from '../balance/balance.module';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => WebhooksModule),
    BalanceModule,
    ProvidersModule,
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
