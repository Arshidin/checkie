import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  Headers,
  Ip,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '../../common/decorators';
import { WidgetService } from './widget.service';
import { PaymentsService } from '../payments/payments.service';
import {
  CreateSessionDto,
  UpdateSessionDto,
  InitiateCheckoutDto,
  WidgetValidateCouponDto,
} from './dto';

@Controller('widget')
@Public()
@Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 req/min for widget
export class WidgetController {
  constructor(
    private readonly widgetService: WidgetService,
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Get page details for widget display
   * GET /api/widget/pages/:storeSlug/:pageSlug
   */
  @Get('pages/:storeSlug/:pageSlug')
  async getPage(
    @Param('storeSlug') storeSlug: string,
    @Param('pageSlug') pageSlug: string,
  ) {
    const page = await this.widgetService.getPage(storeSlug, pageSlug);
    return { data: page };
  }

  /**
   * Create a new checkout session
   * POST /api/widget/sessions
   */
  @Post('sessions')
  async createSession(
    @Body() dto: CreateSessionDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Headers('referer') referrer: string,
  ) {
    const session = await this.widgetService.createSession(dto, {
      ip,
      userAgent,
      referrer,
    });
    return { data: session };
  }

  /**
   * Update a checkout session
   * PATCH /api/widget/sessions/:sessionId
   */
  @Patch('sessions/:sessionId')
  async updateSession(
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateSessionDto,
  ) {
    const session = await this.widgetService.updateSession(sessionId, dto);
    return { data: session };
  }

  /**
   * Get session status
   * GET /api/widget/sessions/:sessionId/status
   */
  @Get('sessions/:sessionId/status')
  async getSessionStatus(@Param('sessionId') sessionId: string) {
    const status = await this.widgetService.getSessionStatus(sessionId);
    return { data: status };
  }

  /**
   * Initiate payment for a session
   * POST /api/widget/checkout
   */
  @Post('checkout')
  async initiateCheckout(@Body() dto: InitiateCheckoutDto) {
    const result = await this.paymentsService.initiatePayment({
      checkoutSessionId: dto.sessionId,
      paymentMethodId: dto.paymentMethodId,
      returnUrl: dto.returnUrl,
    });
    return { data: result };
  }

  /**
   * Validate a coupon code
   * POST /api/widget/validate-coupon
   */
  @Post('validate-coupon')
  async validateCoupon(@Body() dto: WidgetValidateCouponDto) {
    const result = await this.widgetService.validateCoupon({
      code: dto.code,
      pageId: dto.pageId,
      amount: dto.amount,
    });
    return { data: result };
  }

  /**
   * Get embed code
   * GET /api/widget/embed/:embedId
   */
  @Get('embed/:embedId')
  async getEmbedCode(@Param('embedId') embedId: string) {
    const embed = await this.widgetService.getEmbedCode(embedId);
    return { data: embed };
  }
}
