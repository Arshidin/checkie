import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateVariantDto,
  CreateVariantOptionDto,
  UpdateVariantDto,
  UpdateVariantOptionDto,
} from './dto';

@Injectable()
export class VariantsService {
  constructor(private prisma: PrismaService) {}

  async create(pageId: string, dto: CreateVariantDto) {
    // Verify page exists
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Get max display order
    const maxOrder = await this.prisma.pageVariant.aggregate({
      where: { pageId },
      _max: { displayOrder: true },
    });

    const variant = await this.prisma.pageVariant.create({
      data: {
        pageId,
        name: dto.name,
        displayOrder: dto.displayOrder ?? (maxOrder._max.displayOrder ?? -1) + 1,
        isRequired: dto.isRequired ?? true,
        options: dto.options
          ? {
              create: dto.options.map((opt, index) => ({
                name: opt.name,
                priceModifier: opt.priceModifier,
                isDefault: opt.isDefault ?? false,
                displayOrder: opt.displayOrder ?? index,
              })),
            }
          : undefined,
      },
      include: {
        options: { orderBy: { displayOrder: 'asc' } },
      },
    });

    return variant;
  }

  async findAllByPage(pageId: string) {
    return this.prisma.pageVariant.findMany({
      where: { pageId },
      include: {
        options: { orderBy: { displayOrder: 'asc' } },
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async findById(pageId: string, variantId: string) {
    const variant = await this.prisma.pageVariant.findFirst({
      where: { id: variantId, pageId },
      include: {
        options: { orderBy: { displayOrder: 'asc' } },
      },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    return variant;
  }

  async update(pageId: string, variantId: string, dto: UpdateVariantDto) {
    const variant = await this.prisma.pageVariant.findFirst({
      where: { id: variantId, pageId },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    return this.prisma.pageVariant.update({
      where: { id: variantId },
      data: dto,
      include: {
        options: { orderBy: { displayOrder: 'asc' } },
      },
    });
  }

  async delete(pageId: string, variantId: string) {
    const variant = await this.prisma.pageVariant.findFirst({
      where: { id: variantId, pageId },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    await this.prisma.pageVariant.delete({
      where: { id: variantId },
    });

    return { message: 'Variant deleted successfully' };
  }

  async reorder(pageId: string, variantIds: string[]) {
    // Verify all variants belong to the page
    const variants = await this.prisma.pageVariant.findMany({
      where: { pageId },
      select: { id: true },
    });

    const existingIds = new Set(variants.map((v) => v.id));
    const invalidIds = variantIds.filter((id) => !existingIds.has(id));

    if (invalidIds.length > 0) {
      throw new BadRequestException(`Invalid variant IDs: ${invalidIds.join(', ')}`);
    }

    // Update order in transaction
    await this.prisma.$transaction(
      variantIds.map((id, index) =>
        this.prisma.pageVariant.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );

    return this.findAllByPage(pageId);
  }

  // ============================================
  // Variant Options
  // ============================================

  async createOption(variantId: string, dto: CreateVariantOptionDto) {
    const variant = await this.prisma.pageVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    // Get max display order
    const maxOrder = await this.prisma.variantOption.aggregate({
      where: { variantId },
      _max: { displayOrder: true },
    });

    // If this is set as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.variantOption.updateMany({
        where: { variantId },
        data: { isDefault: false },
      });
    }

    return this.prisma.variantOption.create({
      data: {
        variantId,
        name: dto.name,
        priceModifier: dto.priceModifier,
        isDefault: dto.isDefault ?? false,
        displayOrder: dto.displayOrder ?? (maxOrder._max.displayOrder ?? -1) + 1,
      },
    });
  }

  async updateOption(optionId: string, dto: UpdateVariantOptionDto) {
    const option = await this.prisma.variantOption.findUnique({
      where: { id: optionId },
    });

    if (!option) {
      throw new NotFoundException('Option not found');
    }

    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.variantOption.updateMany({
        where: { variantId: option.variantId, id: { not: optionId } },
        data: { isDefault: false },
      });
    }

    return this.prisma.variantOption.update({
      where: { id: optionId },
      data: dto,
    });
  }

  async deleteOption(optionId: string) {
    const option = await this.prisma.variantOption.findUnique({
      where: { id: optionId },
    });

    if (!option) {
      throw new NotFoundException('Option not found');
    }

    await this.prisma.variantOption.delete({
      where: { id: optionId },
    });

    return { message: 'Option deleted successfully' };
  }

  async reorderOptions(variantId: string, optionIds: string[]) {
    const options = await this.prisma.variantOption.findMany({
      where: { variantId },
      select: { id: true },
    });

    const existingIds = new Set(options.map((o) => o.id));
    const invalidIds = optionIds.filter((id) => !existingIds.has(id));

    if (invalidIds.length > 0) {
      throw new BadRequestException(`Invalid option IDs: ${invalidIds.join(', ')}`);
    }

    await this.prisma.$transaction(
      optionIds.map((id, index) =>
        this.prisma.variantOption.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );

    return this.prisma.variantOption.findMany({
      where: { variantId },
      orderBy: { displayOrder: 'asc' },
    });
  }
}
