import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import slugify from 'slugify';
import { PageStatus, PricingType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePageDto, UpdatePageDto } from './dto';

@Injectable()
export class PagesService {
  constructor(private prisma: PrismaService) {}

  async create(storeId: string, dto: CreatePageDto) {
    // Generate slug if not provided
    const slug = dto.slug || slugify(dto.name, { lower: true, strict: true });

    // Check if slug is taken within this store
    const existingPage = await this.prisma.page.findUnique({
      where: { storeId_slug: { storeId, slug } },
    });

    if (existingPage) {
      throw new ConflictException('Page slug is already taken in this store');
    }

    // Validate pricing configuration
    this.validatePricing(dto);

    // Create page with stats
    const page = await this.prisma.page.create({
      data: {
        storeId,
        name: dto.name,
        slug,
        description: dto.description,
        pricingType: dto.pricingType || PricingType.FIXED,
        price: dto.price,
        currency: dto.currency,
        minPrice: dto.minPrice,
        maxPrice: dto.maxPrice,
        suggestedPrice: dto.suggestedPrice,
        subscriptionInterval: dto.subscriptionInterval,
        subscriptionIntervalCount: dto.subscriptionIntervalCount,
        trialDays: dto.trialDays,
        headline: dto.headline,
        subheadline: dto.subheadline,
        buttonText: dto.buttonText || 'Pay Now',
        imageUrl: dto.imageUrl,
        galleryImages: dto.galleryImages || [],
        confirmationTitle: dto.confirmationTitle,
        confirmationMessage: dto.confirmationMessage,
        redirectUrl: dto.redirectUrl,
        requireShipping: dto.requireShipping ?? false,
        allowCoupons: dto.allowCoupons ?? true,
        layoutType: dto.layoutType || 'standard',
        customCss: dto.customCss,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        sessionTtlMinutes: dto.sessionTtlMinutes || 60,
        status: PageStatus.DRAFT,
        stats: {
          create: {},
        },
      },
      include: {
        stats: true,
      },
    });

    return page;
  }

  async findAllByStore(storeId: string, includeArchived = false) {
    const where: any = { storeId };

    if (!includeArchived) {
      where.archivedAt = null;
    }

    return this.prisma.page.findMany({
      where,
      include: {
        stats: true,
        _count: {
          select: {
            variants: true,
            customFields: true,
            embeds: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(storeId: string, pageId: string) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, storeId },
      include: {
        stats: true,
        variants: {
          include: { options: { orderBy: { displayOrder: 'asc' } } },
          orderBy: { displayOrder: 'asc' },
        },
        customFields: { orderBy: { displayOrder: 'asc' } },
        embeds: true,
      },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
  }

  async findBySlug(storeId: string, slug: string) {
    const page = await this.prisma.page.findUnique({
      where: { storeId_slug: { storeId, slug } },
      include: {
        stats: true,
        variants: {
          include: { options: { orderBy: { displayOrder: 'asc' } } },
          orderBy: { displayOrder: 'asc' },
        },
        customFields: { orderBy: { displayOrder: 'asc' } },
      },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
  }

  async update(storeId: string, pageId: string, dto: UpdatePageDto) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, storeId },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // If slug is being updated, check for conflicts
    if (dto.slug && dto.slug !== page.slug) {
      const existingPage = await this.prisma.page.findUnique({
        where: { storeId_slug: { storeId, slug: dto.slug } },
      });

      if (existingPage) {
        throw new ConflictException('Page slug is already taken in this store');
      }
    }

    // Validate pricing if any pricing-related fields are provided
    if (dto.pricingType || dto.price !== undefined || dto.minPrice !== undefined) {
      this.validatePricing({
        pricingType: dto.pricingType || page.pricingType,
        price: dto.price ?? (page.price?.toNumber() || undefined),
        minPrice: dto.minPrice ?? (page.minPrice?.toNumber() || undefined),
        maxPrice: dto.maxPrice ?? (page.maxPrice?.toNumber() || undefined),
        subscriptionInterval: dto.subscriptionInterval || page.subscriptionInterval || undefined,
      });
    }

    return this.prisma.page.update({
      where: { id: pageId },
      data: {
        ...dto,
        galleryImages: dto.galleryImages || undefined,
      },
      include: {
        stats: true,
      },
    });
  }

  async delete(storeId: string, pageId: string) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, storeId },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Soft delete - archive the page
    await this.prisma.page.update({
      where: { id: pageId },
      data: {
        status: PageStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    return { message: 'Page archived successfully' };
  }

  async publish(storeId: string, pageId: string) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, storeId },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    if (page.status === PageStatus.ARCHIVED) {
      throw new BadRequestException('Cannot publish archived page');
    }

    // Validate page is complete for publishing
    this.validateForPublishing(page);

    return this.prisma.page.update({
      where: { id: pageId },
      data: {
        status: PageStatus.ACTIVE,
        publishedAt: new Date(),
      },
      include: { stats: true },
    });
  }

  async unpublish(storeId: string, pageId: string) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, storeId },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return this.prisma.page.update({
      where: { id: pageId },
      data: {
        status: PageStatus.DRAFT,
      },
      include: { stats: true },
    });
  }

  async archive(storeId: string, pageId: string) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, storeId },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return this.prisma.page.update({
      where: { id: pageId },
      data: {
        status: PageStatus.ARCHIVED,
        archivedAt: new Date(),
      },
      include: { stats: true },
    });
  }

  async duplicate(storeId: string, pageId: string, newName?: string) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, storeId },
      include: {
        variants: {
          include: { options: true },
        },
        customFields: true,
      },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const name = newName || `${page.name} (Copy)`;
    const baseSlug = slugify(name, { lower: true, strict: true });

    // Find unique slug
    let slug = baseSlug;
    let counter = 1;
    while (await this.prisma.page.findUnique({ where: { storeId_slug: { storeId, slug } } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create duplicated page
    const duplicatedPage = await this.prisma.page.create({
      data: {
        storeId,
        name,
        slug,
        description: page.description,
        pricingType: page.pricingType,
        price: page.price,
        currency: page.currency,
        minPrice: page.minPrice,
        maxPrice: page.maxPrice,
        suggestedPrice: page.suggestedPrice,
        subscriptionInterval: page.subscriptionInterval,
        subscriptionIntervalCount: page.subscriptionIntervalCount,
        trialDays: page.trialDays,
        headline: page.headline,
        subheadline: page.subheadline,
        buttonText: page.buttonText,
        imageUrl: page.imageUrl,
        galleryImages: page.galleryImages,
        confirmationTitle: page.confirmationTitle,
        confirmationMessage: page.confirmationMessage,
        redirectUrl: page.redirectUrl,
        requireShipping: page.requireShipping,
        allowCoupons: page.allowCoupons,
        layoutType: page.layoutType,
        customCss: page.customCss,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        sessionTtlMinutes: page.sessionTtlMinutes,
        status: PageStatus.DRAFT,
        stats: {
          create: {},
        },
        variants: {
          create: page.variants.map((v) => ({
            name: v.name,
            displayOrder: v.displayOrder,
            isRequired: v.isRequired,
            options: {
              create: v.options.map((o) => ({
                name: o.name,
                priceModifier: o.priceModifier,
                isDefault: o.isDefault,
                displayOrder: o.displayOrder,
              })),
            },
          })),
        },
        customFields: {
          create: page.customFields.map((f) => ({
            name: f.name,
            label: f.label,
            type: f.type,
            placeholder: f.placeholder,
            helpText: f.helpText,
            isRequired: f.isRequired,
            displayOrder: f.displayOrder,
            options: f.options,
            defaultValue: f.defaultValue,
            validationRegex: f.validationRegex,
            minValue: f.minValue,
            maxValue: f.maxValue,
            conditions: f.conditions as Record<string, any> | undefined,
          })),
        },
      },
      include: {
        stats: true,
        variants: { include: { options: true } },
        customFields: true,
      },
    });

    return duplicatedPage;
  }

  private validatePricing(dto: Partial<CreatePageDto>) {
    const { pricingType, price, minPrice, maxPrice, subscriptionInterval } = dto;

    if (pricingType === PricingType.FIXED && price === undefined) {
      throw new BadRequestException('Price is required for fixed pricing');
    }

    if (pricingType === PricingType.PAY_WHAT_YOU_WANT) {
      if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
        throw new BadRequestException('Minimum price cannot be greater than maximum price');
      }
    }

    if (pricingType === PricingType.SUBSCRIPTION && !subscriptionInterval) {
      throw new BadRequestException('Subscription interval is required for subscription pricing');
    }
  }

  private validateForPublishing(page: any) {
    const errors: string[] = [];

    if (page.pricingType === PricingType.FIXED && !page.price) {
      errors.push('Price is required for fixed pricing');
    }

    if (page.pricingType === PricingType.SUBSCRIPTION && !page.subscriptionInterval) {
      errors.push('Subscription interval is required');
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join('. '));
    }
  }
}
