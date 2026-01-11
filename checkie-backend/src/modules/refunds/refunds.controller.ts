import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RefundsService } from './refunds.service';
import { CreateRefundDto } from './dto';
import { StoreUserRole, RefundStatus, RefundReason } from '@prisma/client';

@Controller('stores/:storeId')
@UseGuards(JwtAuthGuard, StoreAccessGuard)
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Get('refunds')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER, StoreUserRole.VIEWER)
  async listRefunds(
    @Param('storeId') storeId: string,
    @Query('paymentId') paymentId?: string,
    @Query('status') status?: RefundStatus,
    @Query('reason') reason?: RefundReason,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.refundsService.findByStore(storeId, {
      paymentId,
      status,
      reason,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('refunds/:refundId')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER, StoreUserRole.VIEWER)
  async getRefund(
    @Param('storeId') storeId: string,
    @Param('refundId') refundId: string,
  ) {
    return this.refundsService.findById(refundId, storeId);
  }

  @Post('payments/:paymentId/refund')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  async createRefund(
    @Param('storeId') storeId: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: CreateRefundDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.refundsService.createRefund({
      paymentId,
      storeId,
      amount: dto.amount,
      reason: dto.reason,
      reasonDetails: dto.reasonDetails,
      requestedBy: userId,
    });
  }

  @Get('payments/:paymentId/refunds')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER, StoreUserRole.VIEWER)
  async getPaymentRefunds(
    @Param('storeId') storeId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.refundsService.findByPayment(paymentId, storeId);
  }
}
