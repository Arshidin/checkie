import { Controller, Get, Post, Param, Query, Body, Delete, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PayoutsService } from './payouts.service';
import { CreatePayoutDto } from './dto';
import { StoreUserRole, PayoutStatus, PayoutMethod } from '@prisma/client';

@Controller('stores/:storeId/payouts')
@UseGuards(JwtAuthGuard, StoreAccessGuard)
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get()
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER, StoreUserRole.VIEWER)
  async listPayouts(
    @Param('storeId') storeId: string,
    @Query('status') status?: PayoutStatus,
    @Query('method') method?: PayoutMethod,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.payoutsService.findByStore(storeId, {
      status,
      method,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':payoutId')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER, StoreUserRole.VIEWER)
  async getPayout(@Param('storeId') storeId: string, @Param('payoutId') payoutId: string) {
    return this.payoutsService.findById(payoutId, storeId);
  }

  @Post()
  @Roles(StoreUserRole.OWNER)
  async createPayout(@Param('storeId') storeId: string, @Body() dto: CreatePayoutDto) {
    return this.payoutsService.createPayout({
      storeId,
      amount: dto.amount,
      currency: dto.currency,
      method: dto.method,
      destination: dto.destination,
    });
  }

  @Delete(':payoutId')
  @Roles(StoreUserRole.OWNER)
  async cancelPayout(@Param('storeId') storeId: string, @Param('payoutId') payoutId: string) {
    return this.payoutsService.cancelPayout(payoutId, storeId);
  }
}
