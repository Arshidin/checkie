import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { WebhookEndpointsService } from './webhook-endpoints.service';
import { WebhookEventsService } from './webhook-events.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhooksController } from './webhooks.controller';
import { WebhookProcessor } from '../../jobs/processors/webhook.processor';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'webhooks',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 100, // Keep last 100 failed jobs
        attempts: 1, // We handle retries manually in the service
      },
    }),
  ],
  controllers: [WebhooksController],
  providers: [
    WebhookEndpointsService,
    WebhookEventsService,
    WebhookDeliveryService,
    WebhookProcessor,
  ],
  exports: [WebhookEndpointsService, WebhookEventsService, WebhookDeliveryService],
})
export class WebhooksModule {}
