import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CustomFieldType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCustomFieldDto, UpdateCustomFieldDto } from './dto';

@Injectable()
export class CustomFieldsService {
  constructor(private prisma: PrismaService) {}

  async create(pageId: string, dto: CreateCustomFieldDto) {
    // Verify page exists
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Validate options for certain field types
    this.validateFieldConfiguration(dto);

    // Get max display order
    const maxOrder = await this.prisma.pageCustomField.aggregate({
      where: { pageId },
      _max: { displayOrder: true },
    });

    return this.prisma.pageCustomField.create({
      data: {
        pageId,
        name: dto.name,
        label: dto.label,
        type: dto.type,
        placeholder: dto.placeholder,
        helpText: dto.helpText,
        isRequired: dto.isRequired ?? false,
        displayOrder: dto.displayOrder ?? (maxOrder._max.displayOrder ?? -1) + 1,
        options: dto.options || [],
        defaultValue: dto.defaultValue,
        validationRegex: dto.validationRegex,
        minValue: dto.minValue,
        maxValue: dto.maxValue,
        conditions: dto.conditions,
      },
    });
  }

  async findAllByPage(pageId: string) {
    return this.prisma.pageCustomField.findMany({
      where: { pageId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async findById(pageId: string, fieldId: string) {
    const field = await this.prisma.pageCustomField.findFirst({
      where: { id: fieldId, pageId },
    });

    if (!field) {
      throw new NotFoundException('Custom field not found');
    }

    return field;
  }

  async update(pageId: string, fieldId: string, dto: UpdateCustomFieldDto) {
    const field = await this.prisma.pageCustomField.findFirst({
      where: { id: fieldId, pageId },
    });

    if (!field) {
      throw new NotFoundException('Custom field not found');
    }

    // Validate field configuration if type is being changed
    if (dto.type || dto.options) {
      this.validateFieldConfiguration({
        type: dto.type || field.type,
        options: dto.options || field.options,
      });
    }

    return this.prisma.pageCustomField.update({
      where: { id: fieldId },
      data: {
        ...dto,
        options: dto.options || undefined,
        conditions: dto.conditions || undefined,
      },
    });
  }

  async delete(pageId: string, fieldId: string) {
    const field = await this.prisma.pageCustomField.findFirst({
      where: { id: fieldId, pageId },
    });

    if (!field) {
      throw new NotFoundException('Custom field not found');
    }

    await this.prisma.pageCustomField.delete({
      where: { id: fieldId },
    });

    return { message: 'Custom field deleted successfully' };
  }

  async reorder(pageId: string, fieldIds: string[]) {
    // Verify all fields belong to the page
    const fields = await this.prisma.pageCustomField.findMany({
      where: { pageId },
      select: { id: true },
    });

    const existingIds = new Set(fields.map((f) => f.id));
    const invalidIds = fieldIds.filter((id) => !existingIds.has(id));

    if (invalidIds.length > 0) {
      throw new BadRequestException(`Invalid field IDs: ${invalidIds.join(', ')}`);
    }

    // Update order in transaction
    await this.prisma.$transaction(
      fieldIds.map((id, index) =>
        this.prisma.pageCustomField.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );

    return this.findAllByPage(pageId);
  }

  async bulkCreate(pageId: string, fields: CreateCustomFieldDto[]) {
    // Verify page exists
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Validate all fields
    fields.forEach((field) => this.validateFieldConfiguration(field));

    // Get max display order
    const maxOrder = await this.prisma.pageCustomField.aggregate({
      where: { pageId },
      _max: { displayOrder: true },
    });

    const startOrder = (maxOrder._max.displayOrder ?? -1) + 1;

    // Create all fields in transaction
    const created = await this.prisma.$transaction(
      fields.map((field, index) =>
        this.prisma.pageCustomField.create({
          data: {
            pageId,
            name: field.name,
            label: field.label,
            type: field.type,
            placeholder: field.placeholder,
            helpText: field.helpText,
            isRequired: field.isRequired ?? false,
            displayOrder: field.displayOrder ?? startOrder + index,
            options: field.options || [],
            defaultValue: field.defaultValue,
            validationRegex: field.validationRegex,
            minValue: field.minValue,
            maxValue: field.maxValue,
            conditions: field.conditions,
          },
        }),
      ),
    );

    return created;
  }

  private validateFieldConfiguration(dto: Partial<CreateCustomFieldDto>) {
    const { type, options } = dto;

    // Types that require options
    const typesRequiringOptions: CustomFieldType[] = [
      CustomFieldType.DROPDOWN,
      CustomFieldType.RADIO,
    ];

    if (type && typesRequiringOptions.includes(type)) {
      if (!options || options.length === 0) {
        throw new BadRequestException(`Options are required for ${type} field type`);
      }
    }
  }
}
