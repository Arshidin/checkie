import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionFilterDto, CancelSubscriptionDto } from './dto';
import { StoreUserRole } from '@prisma/client';

@Controller('stores/:storeId/subscriptions')
@UseGuards(JwtAuthGuard, StoreAccessGuard, RolesGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER, StoreUserRole.VIEWER)
  async list(@Param('storeId') storeId: string, @Query() filters: SubscriptionFilterDto) {
    return this.subscriptionsService.findByStore(storeId, filters);
  }

  @Get(':subscriptionId')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER, StoreUserRole.VIEWER)
  async get(@Param('storeId') storeId: string, @Param('subscriptionId') subscriptionId: string) {
    return this.subscriptionsService.findById(subscriptionId, storeId);
  }

  @Post(':subscriptionId/cancel')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('storeId') storeId: string,
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return this.subscriptionsService.cancelSubscription(
      subscriptionId,
      storeId,
      dto.cancelImmediately,
      dto.reason,
    );
  }

  @Post(':subscriptionId/pause')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async pause(@Param('storeId') storeId: string, @Param('subscriptionId') subscriptionId: string) {
    return this.subscriptionsService.pauseSubscription(subscriptionId, storeId);
  }

  @Post(':subscriptionId/resume')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async resume(@Param('storeId') storeId: string, @Param('subscriptionId') subscriptionId: string) {
    return this.subscriptionsService.resumeSubscription(subscriptionId, storeId);
  }
}
