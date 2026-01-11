import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  WidgetPageResponseDto,
  CreateSessionDto,
  UpdateSessionDto,
  CouponValidationResponseDto,
} from './dto';

@Injectable()
export class WidgetService {
  private readonly logger = new Logger(WidgetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly couponsService: CouponsService,
  ) {}

  /**
   * Get page by store and page slug for widget display
   */
  async getPage(storeSlug: string, pageSlug: string): Promise<WidgetPageResponseDto> {
    const store = await this.prisma.store.findUnique({
      where: { slug: storeSlug },
    });

    if (!store || !store.isActive) {
      throw new NotFoundException('Store not found');
    }

    const page = await this.prisma.page.findFirst({
      where: {
        storeId: store.id,
        slug: pageSlug,
        status: 'ACTIVE',
      },
      include: {
        variants: {
          orderBy: { displayOrder: 'asc' },
          include: {
            options: {
              orderBy: { displayOrder: 'asc' },
            },
          },
        },
        customFields: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Increment view count
    await this.prisma.pageStats.upsert({
      where: { pageId: page.id },
      create: {
        pageId: page.id,
        viewCount: 1,
        lastViewAt: new Date(),
      },
      update: {
        viewCount: { increment: 1 },
        lastViewAt: new Date(),
      },
    });

    return {
      id: page.id,
      name: page.name,
      slug: page.slug,
      description: page.description || undefined,
      pricingType: page.pricingType,
      price: page.price ? Number(page.price) : undefined,
      currency: page.currency,
      minPrice: page.minPrice ? Number(page.minPrice) : undefined,
      maxPrice: page.maxPrice ? Number(page.maxPrice) : undefined,
      suggestedPrice: page.suggestedPrice ? Number(page.suggestedPrice) : undefined,
      subscriptionInterval: page.subscriptionInterval || undefined,
      subscriptionIntervalCount: page.subscriptionIntervalCount || undefined,
      trialDays: page.trialDays || undefined,
      headline: page.headline || undefined,
      subheadline: page.subheadline || undefined,
      buttonText: page.buttonText,
      imageUrl: page.imageUrl || undefined,
      galleryImages: page.galleryImages,
      confirmationTitle: page.confirmationTitle || undefined,
      confirmationMessage: page.confirmationMessage || undefined,
      redirectUrl: page.redirectUrl || undefined,
      requireShipping: page.requireShipping,
      allowCoupons: page.allowCoupons,
      layoutType: page.layoutType,
      customCss: page.customCss || undefined,
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        logoUrl: store.logoUrl || undefined,
        primaryColor: store.primaryColor || undefined,
        secondaryColor: store.secondaryColor || undefined,
      },
      variants: page.variants.map((v) => ({
        id: v.id,
        name: v.name,
        displayOrder: v.displayOrder,
        isRequired: v.isRequired,
        options: v.options.map((o) => ({
          id: o.id,
          name: o.name,
          priceModifier: o.priceModifier ? Number(o.priceModifier) : undefined,
          isDefault: o.isDefault,
          displayOrder: o.displayOrder,
        })),
      })),
      customFields: page.customFields.map((f) => ({
        id: f.id,
        name: f.name,
        label: f.label,
        type: f.type,
        placeholder: f.placeholder || undefined,
        helpText: f.helpText || undefined,
        isRequired: f.isRequired,
        displayOrder: f.displayOrder,
        options: f.options,
        defaultValue: f.defaultValue || undefined,
      })),
    };
  }

  /**
   * Create a new checkout session
   */
  async createSession(
    dto: CreateSessionDto,
    metadata: { ip?: string; userAgent?: string; referrer?: string },
  ) {
    const page = await this.prisma.page.findUnique({
      where: { id: dto.pageId },
      include: { store: true },
    });

    if (!page || page.status !== 'ACTIVE') {
      throw new NotFoundException('Page not found');
    }

    // Calculate initial amount
    let amount = page.price ? Number(page.price) : 0;

    if (dto.amount !== undefined && page.pricingType === 'PAY_WHAT_YOU_WANT') {
      amount = dto.amount;
      if (page.minPrice && amount < Number(page.minPrice)) {
        throw new BadRequestException(`Amount must be at least ${Number(page.minPrice)}`);
      }
      if (page.maxPrice && amount > Number(page.maxPrice)) {
        throw new BadRequestException(`Amount cannot exceed ${Number(page.maxPrice)}`);
      }
    }

    // Find or create customer if email provided
    let customerId: string | null = null;
    if (dto.email) {
      const customer = await this.prisma.customer.upsert({
        where: {
          storeId_email: {
            storeId: page.storeId,
            email: dto.email,
          },
        },
        create: {
          storeId: page.storeId,
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
        update: {
          firstName: dto.firstName || undefined,
          lastName: dto.lastName || undefined,
        },
      });
      customerId = customer.id;
    }

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + (page.sessionTtlMinutes || 60));

    // Create session
    const session = await this.prisma.checkoutSession.create({
      data: {
        storeId: page.storeId,
        pageId: page.id,
        customerId,
        status: 'OPEN',
        expiresAt,
        amount: new Decimal(amount),
        currency: page.currency,
        pricingSnapshot: {
          pricingType: page.pricingType,
          price: page.price ? Number(page.price) : null,
          minPrice: page.minPrice ? Number(page.minPrice) : null,
          maxPrice: page.maxPrice ? Number(page.maxPrice) : null,
        },
        selectedVariants: dto.selectedVariants ?? undefined,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
        referrer: metadata.referrer,
      },
    });

    this.logger.log(`Created checkout session ${session.id} for page ${page.id}`);

    return {
      sessionId: session.id,
      status: session.status,
      amount: Number(session.amount),
      currency: session.currency,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  /**
   * Update a checkout session
   */
  async updateSession(sessionId: string, dto: UpdateSessionDto) {
    const session = await this.prisma.checkoutSession.findUnique({
      where: { id: sessionId },
      include: { page: true },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status !== 'OPEN') {
      throw new BadRequestException('Session is not open for updates');
    }

    if (session.expiresAt < new Date()) {
      throw new BadRequestException('Session has expired');
    }

    let customerId = session.customerId;
    let discountAmount = Number(session.discountAmount);
    let couponId = session.couponId;
    let amount = Number(session.amount);

    // Update customer info
    if (dto.email) {
      const customer = await this.prisma.customer.upsert({
        where: {
          storeId_email: {
            storeId: session.storeId,
            email: dto.email,
          },
        },
        create: {
          storeId: session.storeId,
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          billingAddress: dto.billingAddress
            ? JSON.parse(JSON.stringify(dto.billingAddress))
            : undefined,
          shippingAddress: dto.shippingAddress
            ? JSON.parse(JSON.stringify(dto.shippingAddress))
            : undefined,
        },
        update: {
          firstName: dto.firstName || undefined,
          lastName: dto.lastName || undefined,
          phone: dto.phone || undefined,
          billingAddress: dto.billingAddress
            ? JSON.parse(JSON.stringify(dto.billingAddress))
            : undefined,
          shippingAddress: dto.shippingAddress
            ? JSON.parse(JSON.stringify(dto.shippingAddress))
            : undefined,
        },
      });
      customerId = customer.id;
    }

    // Update amount for PWYW
    if (dto.amount !== undefined && session.page.pricingType === 'PAY_WHAT_YOU_WANT') {
      amount = dto.amount;
    }

    // Validate and apply coupon
    if (dto.couponCode) {
      const validation = await this.validateCoupon({
        code: dto.couponCode,
        pageId: session.pageId,
        amount,
      });

      if (validation.valid && validation.coupon) {
        couponId = validation.coupon.id;
        discountAmount = validation.discountAmount || 0;
      }
    }

    // Save custom field values
    if (dto.customFields) {
      for (const [fieldId, value] of Object.entries(dto.customFields)) {
        await this.prisma.customFieldValue
          .upsert({
            where: {
              id: `${sessionId}_${fieldId}`, // Pseudo unique
            },
            create: {
              customFieldId: fieldId,
              checkoutSessionId: sessionId,
              value,
            },
            update: {
              value,
            },
          })
          .catch(() => {
            // Create with new ID if pseudo unique fails
            return this.prisma.customFieldValue.create({
              data: {
                customFieldId: fieldId,
                checkoutSessionId: sessionId,
                value,
              },
            });
          });
      }
    }

    // Update session
    const updatedSession = await this.prisma.checkoutSession.update({
      where: { id: sessionId },
      data: {
        customerId,
        amount: new Decimal(amount),
        discountAmount: new Decimal(discountAmount),
        couponId,
        selectedVariants:
          dto.selectedVariants ?? (session.selectedVariants as Record<string, string> | undefined),
      },
    });

    return {
      sessionId: updatedSession.id,
      status: updatedSession.status,
      amount: Number(updatedSession.amount),
      discountAmount: Number(updatedSession.discountAmount),
      finalAmount: Number(updatedSession.amount) - Number(updatedSession.discountAmount),
      currency: updatedSession.currency,
      expiresAt: updatedSession.expiresAt.toISOString(),
    };
  }

  /**
   * Get session status
   */
  async getSessionStatus(sessionId: string) {
    const session = await this.prisma.checkoutSession.findUnique({
      where: { id: sessionId },
      include: {
        payment: {
          select: {
            id: true,
            status: true,
            amount: true,
          },
        },
        subscription: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return {
      sessionId: session.id,
      status: session.status,
      amount: Number(session.amount),
      discountAmount: Number(session.discountAmount),
      finalAmount: Number(session.amount) - Number(session.discountAmount),
      currency: session.currency,
      expiresAt: session.expiresAt.toISOString(),
      completedAt: session.completedAt?.toISOString(),
      payment: session.payment
        ? {
            id: session.payment.id,
            status: session.payment.status,
            amount: Number(session.payment.amount),
          }
        : null,
      subscription: session.subscription
        ? {
            id: session.subscription.id,
            status: session.subscription.status,
          }
        : null,
    };
  }

  /**
   * Validate a coupon code
   */
  async validateCoupon(params: {
    code: string;
    pageId: string;
    amount: number;
  }): Promise<CouponValidationResponseDto> {
    const page = await this.prisma.page.findUnique({
      where: { id: params.pageId },
    });

    if (!page) {
      return { valid: false, message: 'Page not found' };
    }

    if (!page.allowCoupons) {
      return { valid: false, message: 'Coupons not allowed for this page' };
    }

    const coupon = await this.prisma.coupon.findFirst({
      where: {
        storeId: page.storeId,
        code: params.code.toUpperCase(),
        isActive: true,
      },
    });

    if (!coupon) {
      return { valid: false, message: 'Invalid coupon code' };
    }

    // Check expiration
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return { valid: false, message: 'Coupon has expired' };
    }

    // Check max uses
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return { valid: false, message: 'Coupon has reached maximum uses' };
    }

    // Check minimum purchase
    if (coupon.minPurchase && params.amount < Number(coupon.minPurchase)) {
      return {
        valid: false,
        message: `Minimum purchase of ${Number(coupon.minPurchase)} required`,
      };
    }

    // Check page restriction
    const pageRestriction = await this.prisma.pageCoupon.findFirst({
      where: { couponId: coupon.id },
    });

    if (pageRestriction) {
      const allowedForPage = await this.prisma.pageCoupon.findFirst({
        where: { couponId: coupon.id, pageId: params.pageId },
      });

      if (!allowedForPage) {
        return { valid: false, message: 'Coupon not valid for this page' };
      }
    }

    // Calculate discount
    let discountAmount: number;
    if (coupon.discountType === 'percent') {
      discountAmount = (params.amount * Number(coupon.discountValue)) / 100;
    } else {
      discountAmount = Math.min(Number(coupon.discountValue), params.amount);
    }

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue),
      },
      discountAmount,
      finalAmount: params.amount - discountAmount,
    };
  }

  /**
   * Get embed code for a page
   */
  async getEmbedCode(embedId: string) {
    const embed = await this.prisma.pageEmbed.findUnique({
      where: { id: embedId },
      include: {
        page: {
          include: { store: true },
        },
      },
    });

    if (!embed) {
      throw new NotFoundException('Embed not found');
    }

    const baseUrl = process.env.WIDGET_URL || 'http://localhost:3001';
    const pageUrl = `${baseUrl}/${embed.page.store.slug}/${embed.page.slug}`;

    let code: string;

    switch (embed.type) {
      case 'IFRAME':
        code = `<iframe src="${pageUrl}?embed=true" width="100%" height="600" frameborder="0"></iframe>`;
        break;
      case 'POPUP':
        code = `<script src="${baseUrl}/embed.js" data-checkie-page="${embed.page.id}" data-checkie-type="popup"></script>`;
        break;
      case 'BUTTON':
        code = `<script src="${baseUrl}/embed.js" data-checkie-page="${embed.page.id}" data-checkie-type="button" data-checkie-text="${embed.page.buttonText}"></script>`;
        break;
      case 'QR_CODE':
        code = `QR Code URL: ${pageUrl}`;
        break;
      default:
        code = pageUrl;
    }

    return {
      embedId: embed.id,
      type: embed.type,
      pageUrl,
      code,
      settings: embed.settings,
    };
  }
}
