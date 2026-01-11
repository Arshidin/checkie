import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard, StoreAccessGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { StoreUserRole } from '@prisma/client';
import { WebhookEndpointsService } from './webhook-endpoints.service';
import { WebhookEventsService } from './webhook-events.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { UpdateWebhookEndpointDto } from './dto/update-webhook-endpoint.dto';

@Controller('stores/:storeId/webhooks')
@UseGuards(JwtAuthGuard, StoreAccessGuard, RolesGuard)
export class WebhooksController {
  constructor(
    private readonly endpointsService: WebhookEndpointsService,
    private readonly eventsService: WebhookEventsService,
    private readonly deliveryService: WebhookDeliveryService,
  ) {}

  // === Webhook Endpoints Management ===

  @Get('endpoints')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  async listEndpoints(@Param('storeId') storeId: string) {
    const endpoints = await this.endpointsService.findAll(storeId);
    return { data: endpoints };
  }

  @Post('endpoints')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  async createEndpoint(@Param('storeId') storeId: string, @Body() dto: CreateWebhookEndpointDto) {
    const endpoint = await this.endpointsService.create(storeId, dto);
    return { data: endpoint };
  }

  @Get('endpoints/:endpointId')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  async getEndpoint(@Param('storeId') storeId: string, @Param('endpointId') endpointId: string) {
    const endpoint = await this.endpointsService.findOne(storeId, endpointId);
    return { data: endpoint };
  }

  @Patch('endpoints/:endpointId')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  async updateEndpoint(
    @Param('storeId') storeId: string,
    @Param('endpointId') endpointId: string,
    @Body() dto: UpdateWebhookEndpointDto,
  ) {
    const endpoint = await this.endpointsService.update(storeId, endpointId, dto);
    return { data: endpoint };
  }

  @Delete('endpoints/:endpointId')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEndpoint(@Param('storeId') storeId: string, @Param('endpointId') endpointId: string) {
    await this.endpointsService.delete(storeId, endpointId);
  }

  @Post('endpoints/:endpointId/rotate-secret')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  async rotateSecret(@Param('storeId') storeId: string, @Param('endpointId') endpointId: string) {
    const result = await this.endpointsService.rotateSecret(storeId, endpointId);
    return { data: result };
  }

  @Get('endpoints/:endpointId/deliveries')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  async getEndpointDeliveries(
    @Param('storeId') storeId: string,
    @Param('endpointId') endpointId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.endpointsService.getDeliveries(storeId, endpointId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
    });
  }

  // === Webhook Events ===

  @Get('events')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  async listEvents(
    @Param('storeId') storeId: string,
    @Query('type') type?: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.eventsService.getEvents(storeId, {
      type,
      resourceType,
      resourceId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('events/:eventId')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  async getEvent(@Param('storeId') storeId: string, @Param('eventId') eventId: string) {
    const event = await this.eventsService.getEvent(storeId, eventId);
    return { data: event };
  }

  @Post('events/:eventId/resend')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  async resendEvent(@Param('storeId') storeId: string, @Param('eventId') eventId: string) {
    const result = await this.eventsService.resendEvent(storeId, eventId);
    return { data: result };
  }

  // === Delivery Management ===

  @Post('deliveries/:deliveryId/retry')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  async retryDelivery(@Param('deliveryId') deliveryId: string) {
    const result = await this.deliveryService.retryDelivery(deliveryId);
    return { data: result };
  }

  @Get('stats')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER)
  async getStats(@Param('storeId') storeId: string, @Query('days') days?: string) {
    const stats = await this.deliveryService.getDeliveryStats(
      storeId,
      days ? parseInt(days, 10) : 7,
    );
    return { data: stats };
  }

  // === Event Types ===

  @Get('event-types')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER, StoreUserRole.VIEWER)
  async getEventTypes() {
    const types = this.endpointsService.getAvailableEventTypes();
    return { data: types };
  }
}
