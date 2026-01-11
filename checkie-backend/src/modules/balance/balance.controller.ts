import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { BalanceService } from './balance.service';
import { BalanceFilterDto } from './dto/balance-filter.dto';
import { StoreUserRole, Currency } from '@prisma/client';

@Controller('stores/:storeId/balance')
@UseGuards(JwtAuthGuard, StoreAccessGuard, RolesGuard)
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get()
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  async getBalance(
    @Param('storeId') storeId: string,
    @Query('currency') currency?: Currency,
  ) {
    return this.balanceService.getBalance(storeId, currency);
  }

  @Get('transactions')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  async getTransactions(
    @Param('storeId') storeId: string,
    @Query() filters: BalanceFilterDto,
  ) {
    return this.balanceService.getTransactions(storeId, {
      type: filters.type,
      currency: filters.currency,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      page: filters.page,
      limit: filters.limit,
    });
  }

  @Get('summary')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  async getSummary(
    @Param('storeId') storeId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('currency') currency?: Currency,
  ) {
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return this.balanceService.getSummary(storeId, start, end, currency);
  }
}
