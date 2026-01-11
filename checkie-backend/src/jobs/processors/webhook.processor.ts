import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WebhookDeliveryService, DeliveryJobData } from '../../modules/webhooks/webhook-delivery.service';

@Processor('webhooks')
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private readonly deliveryService: WebhookDeliveryService) {
    super();
  }

  async process(job: Job<DeliveryJobData>): Promise<void> {
    const { deliveryId } = job.data;

    this.logger.debug(`Processing webhook delivery job: ${deliveryId}`);

    try {
      await this.deliveryService.processDelivery(deliveryId);
    } catch (error: any) {
      this.logger.error(
        `Error processing webhook delivery ${deliveryId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<DeliveryJobData>) {
    this.logger.debug(`Job ${job.id} completed for delivery ${job.data.deliveryId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<DeliveryJobData>, error: Error) {
    this.logger.error(
      `Job ${job.id} failed for delivery ${job.data.deliveryId}: ${error.message}`,
    );
  }
}
