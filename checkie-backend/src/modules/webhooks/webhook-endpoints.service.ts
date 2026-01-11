import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { UpdateWebhookEndpointDto } from './dto/update-webhook-endpoint.dto';
import { ALL_WEBHOOK_EVENT_TYPES, WEBHOOK_EVENT_DESCRIPTIONS } from './dto/webhook-event-types';
import * as crypto from 'crypto';

@Injectable()
export class WebhookEndpointsService {
  private readonly logger = new Logger(WebhookEndpointsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a secure webhook secret
   */
  private generateSecret(): string {
    return `whsec_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Validate that all events are valid
   */
  private validateEvents(events: string[]): void {
    const invalidEvents = events.filter((event) => !ALL_WEBHOOK_EVENT_TYPES.includes(event as any));

    if (invalidEvents.length > 0) {
      throw new BadRequestException(
        `Invalid webhook events: ${invalidEvents.join(', ')}. Valid events: ${ALL_WEBHOOK_EVENT_TYPES.join(', ')}`,
      );
    }
  }

  /**
   * Create a new webhook endpoint
   */
  async create(storeId: string, dto: CreateWebhookEndpointDto) {
    this.validateEvents(dto.events);

    const secret = this.generateSecret();

    const endpoint = await this.prisma.webhookEndpoint.create({
      data: {
        storeId,
        url: dto.url,
        secret,
        description: dto.description,
        events: dto.events,
        isActive: dto.isActive ?? true,
      },
    });

    this.logger.log(`Created webhook endpoint ${endpoint.id} for store ${storeId}`);

    return {
      ...endpoint,
      secret, // Return secret only on creation
    };
  }

  /**
   * List all webhook endpoints for a store
   */
  async findAll(storeId: string) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        description: true,
        events: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Do not include secret
      },
    });

    return endpoints;
  }

  /**
   * Get a single webhook endpoint
   */
  async findOne(storeId: string, endpointId: string) {
    const endpoint = await this.prisma.webhookEndpoint.findFirst({
      where: {
        id: endpointId,
        storeId,
      },
      select: {
        id: true,
        url: true,
        description: true,
        events: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!endpoint) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    return endpoint;
  }

  /**
   * Update a webhook endpoint
   */
  async update(storeId: string, endpointId: string, dto: UpdateWebhookEndpointDto) {
    const existing = await this.prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, storeId },
    });

    if (!existing) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    if (dto.events) {
      this.validateEvents(dto.events);
    }

    const updated = await this.prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        url: dto.url,
        description: dto.description,
        events: dto.events,
        isActive: dto.isActive,
      },
      select: {
        id: true,
        url: true,
        description: true,
        events: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Updated webhook endpoint ${endpointId}`);

    return updated;
  }

  /**
   * Delete a webhook endpoint
   */
  async delete(storeId: string, endpointId: string) {
    const existing = await this.prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, storeId },
    });

    if (!existing) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    await this.prisma.webhookEndpoint.delete({
      where: { id: endpointId },
    });

    this.logger.log(`Deleted webhook endpoint ${endpointId}`);

    return { success: true };
  }

  /**
   * Rotate the webhook secret
   */
  async rotateSecret(storeId: string, endpointId: string) {
    const existing = await this.prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, storeId },
    });

    if (!existing) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    const newSecret = this.generateSecret();

    await this.prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: { secret: newSecret },
    });

    this.logger.log(`Rotated secret for webhook endpoint ${endpointId}`);

    return { secret: newSecret };
  }

  /**
   * Get deliveries for a webhook endpoint
   */
  async getDeliveries(
    storeId: string,
    endpointId: string,
    options?: {
      page?: number;
      limit?: number;
      status?: string;
    },
  ) {
    const existing = await this.prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, storeId },
    });

    if (!existing) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const where: any = { endpointId };
    if (options?.status) {
      where.status = options.status;
    }

    const [deliveries, total] = await Promise.all([
      this.prisma.webhookDelivery.findMany({
        where,
        include: {
          event: {
            select: {
              id: true,
              type: true,
              resourceType: true,
              resourceId: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.webhookDelivery.count({ where }),
    ]);

    return {
      data: deliveries,
      meta: {
        total,
        page,
        limit,
        hasMore: total > page * limit,
      },
    };
  }

  /**
   * Get all active endpoints for a store that are subscribed to an event type
   */
  async getEndpointsForEvent(storeId: string, eventType: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: {
        storeId,
        isActive: true,
        events: { has: eventType },
      },
    });
  }

  /**
   * Get available event types
   */
  getAvailableEventTypes() {
    return ALL_WEBHOOK_EVENT_TYPES.map((type) => ({
      type,
      description: WEBHOOK_EVENT_DESCRIPTIONS[type],
    }));
  }
}
