import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
// WebhookDeliveryStatus is used via prisma enum, not directly imported
import * as crypto from 'crypto';

export interface DeliveryJobData {
  deliveryId: string;
}

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);
  private readonly maxRetries = 5;
  private readonly timeoutMs = 10000;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('webhooks') private readonly webhookQueue: Queue,
  ) {}

  /**
   * Generate HMAC signature for webhook payload
   */
  generateSignature(payload: string, secret: string, timestamp: number): string {
    const signaturePayload = `${timestamp}.${payload}`;
    const signature = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');
    return `t=${timestamp},v1=${signature}`;
  }

  /**
   * Schedule a delivery for an event to an endpoint
   */
  async scheduleDelivery(eventId: string, endpointId: string) {
    const now = new Date();

    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        webhookEventId: eventId,
        endpointId,
        attemptNumber: 1,
        status: 'PENDING',
        scheduledAt: now,
      },
    });

    // Add job to queue
    await this.webhookQueue.add(
      'deliver',
      { deliveryId: delivery.id },
      {
        attempts: 1, // We handle retries manually
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.debug(`Scheduled delivery ${delivery.id} for event ${eventId}`);

    return delivery;
  }

  /**
   * Process a delivery (called by BullMQ processor)
   */
  async processDelivery(deliveryId: string): Promise<void> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        event: true,
        endpoint: true,
      },
    });

    if (!delivery) {
      this.logger.warn(`Delivery ${deliveryId} not found, skipping`);
      return;
    }

    if (!delivery.endpoint.isActive) {
      this.logger.warn(`Endpoint ${delivery.endpoint.id} is inactive, marking delivery as failed`);
      await this.markFailed(deliveryId, 'Endpoint is inactive');
      return;
    }

    const payload = JSON.stringify({
      id: delivery.event.id,
      type: delivery.event.type,
      created: delivery.event.createdAt.toISOString(),
      data: delivery.event.payload,
    });

    const timestamp = Date.now();
    const signature = this.generateSignature(payload, delivery.endpoint.secret, timestamp);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(delivery.endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Id': delivery.event.id,
          'X-Webhook-Timestamp': timestamp.toString(),
          'X-Webhook-Signature': signature,
          'User-Agent': 'Checkie-Webhook/1.0',
        },
        body: payload,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseBody = await response.text().catch(() => '');

      if (response.ok) {
        await this.markDelivered(deliveryId, response.status, responseBody);
        this.logger.log(`Delivery ${deliveryId} succeeded with status ${response.status}`);
      } else {
        await this.handleFailure(
          delivery,
          `HTTP ${response.status}`,
          response.status,
          responseBody,
        );
      }
    } catch (error: any) {
      const message =
        error.name === 'AbortError' ? 'Request timeout' : error.message || 'Unknown error';

      await this.handleFailure(delivery, message);
    }
  }

  /**
   * Mark delivery as successfully delivered
   */
  private async markDelivered(deliveryId: string, httpStatus: number, responseBody?: string) {
    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'DELIVERED',
        httpStatus,
        responseBody: responseBody?.substring(0, 1000), // Limit response body
        attemptedAt: new Date(),
        nextRetryAt: null,
      },
    });
  }

  /**
   * Handle delivery failure and schedule retry if applicable
   */
  private async handleFailure(
    delivery: any,
    errorMessage: string,
    httpStatus?: number,
    responseBody?: string,
  ) {
    const attempt = delivery.attemptNumber;

    if (attempt >= this.maxRetries) {
      await this.markFailed(delivery.id, errorMessage, httpStatus, responseBody);
      this.logger.warn(`Delivery ${delivery.id} failed after ${attempt} attempts: ${errorMessage}`);
      return;
    }

    // Exponential backoff: 1m, 2m, 4m, 8m, 16m
    const delayMs = Math.pow(2, attempt) * 60 * 1000;
    const nextRetryAt = new Date(Date.now() + delayMs);

    await this.prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        attemptNumber: attempt + 1,
        status: 'RETRYING',
        httpStatus,
        responseBody: responseBody?.substring(0, 1000),
        errorMessage,
        attemptedAt: new Date(),
        nextRetryAt,
      },
    });

    // Schedule retry job
    await this.webhookQueue.add(
      'deliver',
      { deliveryId: delivery.id },
      {
        delay: delayMs,
        attempts: 1,
        removeOnComplete: true,
      },
    );

    this.logger.log(
      `Delivery ${delivery.id} scheduled for retry ${attempt + 1} in ${delayMs / 1000}s`,
    );
  }

  /**
   * Mark delivery as permanently failed
   */
  private async markFailed(
    deliveryId: string,
    errorMessage: string,
    httpStatus?: number,
    responseBody?: string,
  ) {
    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'FAILED',
        httpStatus,
        responseBody: responseBody?.substring(0, 1000),
        errorMessage,
        attemptedAt: new Date(),
        nextRetryAt: null,
      },
    });
  }

  /**
   * Retry a specific delivery manually
   */
  async retryDelivery(deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { endpoint: true },
    });

    if (!delivery) {
      return null;
    }

    // Reset and reschedule
    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        attemptNumber: delivery.attemptNumber + 1,
        status: 'PENDING',
        scheduledAt: new Date(),
        nextRetryAt: null,
      },
    });

    await this.webhookQueue.add(
      'deliver',
      { deliveryId },
      {
        attempts: 1,
        removeOnComplete: true,
      },
    );

    this.logger.log(`Manual retry scheduled for delivery ${deliveryId}`);

    return { scheduled: true };
  }

  /**
   * Get delivery statistics for a store
   */
  async getDeliveryStats(storeId: string, days: number = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const stats = await this.prisma.webhookDelivery.groupBy({
      by: ['status'],
      where: {
        endpoint: { storeId },
        createdAt: { gte: since },
      },
      _count: true,
    });

    const result = {
      total: 0,
      delivered: 0,
      failed: 0,
      pending: 0,
      retrying: 0,
    };

    for (const stat of stats) {
      const count = stat._count;
      result.total += count;

      switch (stat.status) {
        case 'DELIVERED':
          result.delivered = count;
          break;
        case 'FAILED':
          result.failed = count;
          break;
        case 'PENDING':
          result.pending = count;
          break;
        case 'RETRYING':
          result.retrying = count;
          break;
      }
    }

    return result;
  }
}
