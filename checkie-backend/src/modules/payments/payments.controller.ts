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
import { PaymentsService } from './payments.service';
import { PaymentFilterDto } from './dto/payment-filter.dto';
import { StoreUserRole } from '@prisma/client';

@Controller('stores/:storeId/payments')
@UseGuards(JwtAuthGuard, StoreAccessGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @Roles(
    StoreUserRole.OWNER,
    StoreUserRole.ADMIN,
    StoreUserRole.MANAGER,
    StoreUserRole.VIEWER,
  )
  async list(
    @Param('storeId') storeId: string,
    @Query() filters: PaymentFilterDto,
  ) {
    return this.paymentsService.findByStore(storeId, {
      status: filters.status,
      pageId: filters.pageId,
      customerId: filters.customerId,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      page: filters.page,
      limit: filters.limit,
    });
  }

  @Get(':paymentId')
  @Roles(
    StoreUserRole.OWNER,
    StoreUserRole.ADMIN,
    StoreUserRole.MANAGER,
    StoreUserRole.VIEWER,
  )
  async get(
    @Param('storeId') storeId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.paymentsService.findById(paymentId, storeId);
  }

  @Get(':paymentId/attempts')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  async getAttempts(
    @Param('storeId') storeId: string,
    @Param('paymentId') paymentId: string,
  ) {
    const payment = await this.paymentsService.findById(paymentId, storeId);
    return payment.attempts;
  }
}
