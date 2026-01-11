import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Headers,
  Ip,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { CheckoutService } from './checkout.service';
import {
  CreateCheckoutSessionDto,
  UpdateCheckoutSessionDto,
  InitiatePaymentDto,
  CheckoutSessionResponseDto,
  InitiatePaymentResponseDto,
  SessionStatusResponseDto,
} from './dto';
import { Public } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards';

@ApiTags('Checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('sessions')
  @Public()
  @ApiOperation({ summary: 'Create a new checkout session' })
  @ApiResponse({ status: 201, description: 'Session created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 404, description: 'Page not found' })
  async createSession(
    @Body() dto: CreateCheckoutSessionDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Headers('referer') referrer: string,
  ): Promise<CheckoutSessionResponseDto> {
    return this.checkoutService.createSession({
      ...dto,
      ipAddress: dto.ipAddress || ip,
      userAgent: dto.userAgent || userAgent,
      referrer: dto.referrer || referrer,
    });
  }

  @Get('sessions/:sessionId')
  @Public()
  @ApiOperation({ summary: 'Get checkout session details' })
  @ApiResponse({ status: 200, description: 'Session details' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSession(
    @Param('sessionId') sessionId: string,
  ): Promise<CheckoutSessionResponseDto> {
    return this.checkoutService.getSession(sessionId);
  }

  @Patch('sessions/:sessionId')
  @Public()
  @ApiOperation({ summary: 'Update checkout session' })
  @ApiResponse({ status: 200, description: 'Session updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid state for update' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async updateSession(
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateCheckoutSessionDto,
  ): Promise<CheckoutSessionResponseDto> {
    return this.checkoutService.updateSession(sessionId, dto);
  }

  @Post('sessions/:sessionId/initiate')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate payment for checkout session' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key to prevent duplicate payments',
    required: false,
  })
  @ApiResponse({ status: 200, description: 'Payment initiated' })
  @ApiResponse({ status: 400, description: 'Invalid session state' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 409, description: 'Duplicate request' })
  async initiatePayment(
    @Param('sessionId') sessionId: string,
    @Body() dto: Omit<InitiatePaymentDto, 'sessionId'>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<InitiatePaymentResponseDto> {
    return this.checkoutService.initiatePayment({
      sessionId,
      ...dto,
      idempotencyKey,
    });
  }

  @Get('sessions/:sessionId/status')
  @Public()
  @ApiOperation({ summary: 'Get checkout session status (for polling)' })
  @ApiResponse({ status: 200, description: 'Session status' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSessionStatus(
    @Param('sessionId') sessionId: string,
  ): Promise<SessionStatusResponseDto> {
    const status = await this.checkoutService.getSessionStatus(sessionId);
    return {
      sessionId: status.sessionId,
      status: status.status as any,
      paymentId: status.paymentId,
      completedAt: status.completedAt,
      error: status.error,
    };
  }

  @Post('sessions/:sessionId/abandon')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark session as abandoned' })
  @ApiResponse({ status: 204, description: 'Session abandoned' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async abandonSession(
    @Param('sessionId') sessionId: string,
    @Body('reason') reason?: string,
  ): Promise<void> {
    await this.checkoutService.abandonSession(sessionId, reason);
  }

  // Admin endpoints (require authentication)
  @Get('stores/:storeId/sessions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List checkout sessions for a store' })
  @ApiResponse({ status: 200, description: 'List of sessions' })
  async listStoreSessions(
    @Param('storeId') storeId: string,
  ): Promise<CheckoutSessionResponseDto[]> {
    // TODO: Implement with StoreAccessGuard and pagination
    return [];
  }
}
