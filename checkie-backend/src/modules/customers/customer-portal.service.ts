import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import {
  RequestPortalAccessDto,
  VerifyPortalTokenDto,
  PortalSessionResponseDto,
} from './dto';

@Injectable()
export class CustomerPortalService {
  private readonly logger = new Logger(CustomerPortalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Request portal access (send magic link)
   */
  async requestAccess(dto: RequestPortalAccessDto): Promise<{ message: string }> {
    // Find store by slug
    const store = await this.prisma.store.findUnique({
      where: { slug: dto.storeSlug },
    });

    if (!store || !store.isActive) {
      // Don't reveal if store exists
      return { message: 'If an account exists, you will receive an email with login instructions.' };
    }

    // Find customer
    const customer = await this.prisma.customer.findFirst({
      where: {
        storeId: store.id,
        email: dto.email.toLowerCase(),
      },
    });

    if (!customer) {
      // Don't reveal if customer exists
      return { message: 'If an account exists, you will receive an email with login instructions.' };
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token valid for 1 hour

    // Create portal session
    await this.prisma.customerPortalSession.create({
      data: {
        customerId: customer.id,
        token,
        expiresAt,
      },
    });

    // TODO: Send email with magic link
    // In production, use NotificationsService to send email
    const portalUrl = this.configService.get('PORTAL_URL', 'http://localhost:3002');
    const magicLink = `${portalUrl}/verify?token=${token}`;

    this.logger.log(`Portal access requested for customer ${customer.id}`);
    this.logger.debug(`Magic link: ${magicLink}`); // Only in development

    // In production, send email instead of returning link
    return {
      message: 'If an account exists, you will receive an email with login instructions.',
      // DEV ONLY: Include link for testing
      ...(this.configService.get('NODE_ENV') === 'development' && { magicLink }),
    };
  }

  /**
   * Verify magic link token and create session
   */
  async verifyToken(dto: VerifyPortalTokenDto): Promise<PortalSessionResponseDto> {
    const portalSession = await this.prisma.customerPortalSession.findUnique({
      where: { token: dto.token },
      include: {
        customer: true,
      },
    });

    if (!portalSession) {
      throw new BadRequestException('Invalid or expired token');
    }

    if (portalSession.usedAt) {
      throw new BadRequestException('Token has already been used');
    }

    if (portalSession.expiresAt < new Date()) {
      throw new BadRequestException('Token has expired');
    }

    // Mark token as used
    await this.prisma.customerPortalSession.update({
      where: { id: portalSession.id },
      data: { usedAt: new Date() },
    });

    // Generate JWT for portal access
    const payload = {
      sub: portalSession.customer.id,
      email: portalSession.customer.email,
      type: 'customer_portal',
    };

    const expiresIn = '24h';
    const accessToken = this.jwtService.sign(payload, { expiresIn });

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    this.logger.log(`Portal session created for customer ${portalSession.customerId}`);

    return {
      accessToken,
      expiresAt: expiresAt.toISOString(),
      customer: {
        id: portalSession.customer.id,
        email: portalSession.customer.email,
        firstName: portalSession.customer.firstName || undefined,
        lastName: portalSession.customer.lastName || undefined,
      },
    };
  }

  /**
   * Get customer data for portal
   */
  async getPortalData(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            createdAt: true,
            page: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            amount: true,
            currency: true,
            interval: true,
            intervalCount: true,
            page: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return {
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        billingAddress: customer.billingAddress,
        shippingAddress: customer.shippingAddress,
      },
      store: customer.store,
      payments: customer.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        page: p.page,
      })),
      subscriptions: customer.subscriptions.map((s) => ({
        id: s.id,
        status: s.status,
        currentPeriodStart: s.currentPeriodStart.toISOString(),
        currentPeriodEnd: s.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        amount: Number(s.amount),
        currency: s.currency,
        interval: s.interval,
        intervalCount: s.intervalCount,
        page: s.page,
      })),
    };
  }

  /**
   * Update customer profile from portal
   */
  async updateProfile(
    customerId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      billingAddress?: Record<string, any>;
      shippingAddress?: Record<string, any>;
    },
  ) {
    const customer = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        billingAddress: data.billingAddress,
        shippingAddress: data.shippingAddress,
      },
    });

    this.logger.log(`Customer ${customerId} updated profile`);

    return {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      billingAddress: customer.billingAddress,
      shippingAddress: customer.shippingAddress,
    };
  }

  /**
   * Cancel subscription from portal
   */
  async cancelSubscription(customerId: string, subscriptionId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        customerId,
        status: 'ACTIVE',
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found or not active');
    }

    // Mark for cancellation at period end
    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
      },
    });

    this.logger.log(`Subscription ${subscriptionId} marked for cancellation by customer ${customerId}`);

    return {
      id: updated.id,
      status: updated.status,
      cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
      currentPeriodEnd: updated.currentPeriodEnd.toISOString(),
    };
  }

  /**
   * Validate portal JWT token
   */
  async validatePortalToken(token: string): Promise<{ customerId: string }> {
    try {
      const payload = this.jwtService.verify(token);

      if (payload.type !== 'customer_portal') {
        throw new UnauthorizedException('Invalid token type');
      }

      return { customerId: payload.sub };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
