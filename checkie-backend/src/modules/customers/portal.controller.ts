import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators';
import { CustomerPortalService } from './customer-portal.service';
import { RequestPortalAccessDto, VerifyPortalTokenDto } from './dto';

@Controller('portal')
@Public()
export class PortalController {
  constructor(private readonly portalService: CustomerPortalService) {}

  /**
   * Request portal access (send magic link)
   * POST /api/portal/request-access
   */
  @Post('request-access')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async requestAccess(@Body() dto: RequestPortalAccessDto) {
    const result = await this.portalService.requestAccess(dto);
    return { data: result };
  }

  /**
   * Verify magic link token
   * POST /api/portal/verify
   */
  @Post('verify')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async verifyToken(@Body() dto: VerifyPortalTokenDto) {
    const result = await this.portalService.verifyToken(dto);
    return { data: result };
  }

  /**
   * Get portal data (customer info, payments, subscriptions)
   * GET /api/portal/me
   */
  @Get('me')
  async getPortalData(@Headers('authorization') authorization: string) {
    const customerId = await this.extractCustomerId(authorization);
    const data = await this.portalService.getPortalData(customerId);
    return { data };
  }

  /**
   * Update customer profile
   * PATCH /api/portal/me
   */
  @Patch('me')
  async updateProfile(
    @Headers('authorization') authorization: string,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      billingAddress?: Record<string, any>;
      shippingAddress?: Record<string, any>;
    },
  ) {
    const customerId = await this.extractCustomerId(authorization);
    const result = await this.portalService.updateProfile(customerId, body);
    return { data: result };
  }

  /**
   * Cancel subscription
   * POST /api/portal/subscriptions/:subscriptionId/cancel
   */
  @Post('subscriptions/:subscriptionId/cancel')
  async cancelSubscription(
    @Headers('authorization') authorization: string,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    const customerId = await this.extractCustomerId(authorization);
    const result = await this.portalService.cancelSubscription(customerId, subscriptionId);
    return { data: result };
  }

  /**
   * Extract and validate customer ID from authorization header
   */
  private async extractCustomerId(authorization: string): Promise<string> {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authorization.substring(7);
    const { customerId } = await this.portalService.validatePortalToken(token);
    return customerId;
  }
}
