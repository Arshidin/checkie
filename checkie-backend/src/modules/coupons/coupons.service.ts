import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto, CouponValidationResult } from './dto';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  async create(storeId: string, dto: CreateCouponDto) {
    // Check for existing coupon code in this store
    const existingCoupon = await this.prisma.coupon.findUnique({
      where: { storeId_code: { storeId, code: dto.code.toUpperCase() } },
    });

    if (existingCoupon) {
      throw new ConflictException('Coupon code already exists in this store');
    }

    // Validate discount value for percent type
    if (dto.discountType === 'percent' && dto.discountValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

    // Create coupon
    const coupon = await this.prisma.coupon.create({
      data: {
        storeId,
        code: dto.code.toUpperCase(),
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxUses: dto.maxUses,
        minPurchase: dto.minPurchase,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
        pageCoupons: dto.pageIds?.length
          ? {
              create: dto.pageIds.map((pageId) => ({ pageId })),
            }
          : undefined,
      },
      include: {
        pageCoupons: {
          include: {
            page: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    return this.formatCouponResponse(coupon);
  }

  async findAllByStore(storeId: string, includeInactive = false) {
    const where: any = { storeId };

    if (!includeInactive) {
      where.isActive = true;
    }

    const coupons = await this.prisma.coupon.findMany({
      where,
      include: {
        pageCoupons: {
          include: {
            page: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return coupons.map((c) => this.formatCouponResponse(c));
  }

  async findById(storeId: string, couponId: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id: couponId, storeId },
      include: {
        pageCoupons: {
          include: {
            page: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return this.formatCouponResponse(coupon);
  }

  async findByCode(storeId: string, code: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { storeId_code: { storeId, code: code.toUpperCase() } },
      include: {
        pageCoupons: true,
      },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return coupon;
  }

  async update(storeId: string, couponId: string, dto: UpdateCouponDto) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id: couponId, storeId },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    // Validate discount value for percent type
    const discountType = dto.discountType || coupon.discountType;
    const discountValue = dto.discountValue ?? coupon.discountValue.toNumber();

    if (discountType === 'percent' && discountValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

    // Update page associations if provided
    if (dto.pageIds !== undefined) {
      // Delete existing associations
      await this.prisma.pageCoupon.deleteMany({
        where: { couponId },
      });

      // Create new associations
      if (dto.pageIds.length > 0) {
        await this.prisma.pageCoupon.createMany({
          data: dto.pageIds.map((pageId) => ({ couponId, pageId })),
        });
      }
    }

    const updated = await this.prisma.coupon.update({
      where: { id: couponId },
      data: {
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxUses: dto.maxUses,
        minPurchase: dto.minPurchase,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        isActive: dto.isActive,
      },
      include: {
        pageCoupons: {
          include: {
            page: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    return this.formatCouponResponse(updated);
  }

  async delete(storeId: string, couponId: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id: couponId, storeId },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    // Soft delete - just deactivate
    await this.prisma.coupon.update({
      where: { id: couponId },
      data: { isActive: false },
    });

    return { message: 'Coupon deactivated successfully' };
  }

  async validateCoupon(storeId: string, dto: ValidateCouponDto): Promise<CouponValidationResult> {
    try {
      const coupon = await this.findByCode(storeId, dto.code);

      // Check if coupon is active
      if (!coupon.isActive) {
        return { valid: false, error: 'Coupon is not active' };
      }

      // Check if expired
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return { valid: false, error: 'Coupon has expired' };
      }

      // Check max uses
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        return { valid: false, error: 'Coupon has reached maximum uses' };
      }

      // Check minimum purchase
      if (coupon.minPurchase && dto.amount !== undefined) {
        if (dto.amount < coupon.minPurchase.toNumber()) {
          return {
            valid: false,
            error: `Minimum purchase of ${coupon.minPurchase} required`,
          };
        }
      }

      // Check if coupon is valid for this page
      if (coupon.pageCoupons.length > 0 && dto.pageId) {
        const validForPage = coupon.pageCoupons.some((pc) => pc.pageId === dto.pageId);
        if (!validForPage) {
          return { valid: false, error: 'Coupon is not valid for this page' };
        }
      }

      // Calculate discount
      let discountAmount = 0;
      if (dto.amount !== undefined) {
        if (coupon.discountType === 'percent') {
          discountAmount = (dto.amount * coupon.discountValue.toNumber()) / 100;
        } else {
          discountAmount = Math.min(coupon.discountValue.toNumber(), dto.amount);
        }
      }

      return {
        valid: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue.toNumber(),
        },
        discountAmount,
      };
    } catch {
      return { valid: false, error: 'Invalid coupon code' };
    }
  }

  async incrementUsage(couponId: string) {
    await this.prisma.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    });
  }

  private formatCouponResponse(coupon: any) {
    const { pageCoupons, ...rest } = coupon;

    return {
      ...rest,
      discountValue:
        rest.discountValue instanceof Decimal ? rest.discountValue.toNumber() : rest.discountValue,
      minPurchase:
        rest.minPurchase instanceof Decimal ? rest.minPurchase.toNumber() : rest.minPurchase,
      pages: pageCoupons?.map((pc: any) => pc.page) || [],
    };
  }
}
