import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StoreUserRole } from '@prisma/client';
import { VariantsService } from './variants.service';
import {
  CreateVariantDto,
  CreateVariantOptionDto,
  UpdateVariantDto,
  UpdateVariantOptionDto,
} from './dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../../common/guards/store-access.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('Page Variants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StoreAccessGuard, RolesGuard)
@Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER)
@Controller('stores/:storeId/pages/:pageId/variants')
export class VariantsController {
  constructor(private readonly variantsService: VariantsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new variant for a page' })
  @ApiResponse({ status: 201, description: 'Variant created' })
  async create(
    @Param('pageId') pageId: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.variantsService.create(pageId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all variants for a page' })
  @ApiResponse({ status: 200, description: 'List of variants' })
  async findAll(@Param('pageId') pageId: string) {
    return this.variantsService.findAllByPage(pageId);
  }

  @Get(':variantId')
  @ApiOperation({ summary: 'Get variant by ID' })
  @ApiResponse({ status: 200, description: 'Variant details' })
  async findById(
    @Param('pageId') pageId: string,
    @Param('variantId') variantId: string,
  ) {
    return this.variantsService.findById(pageId, variantId);
  }

  @Patch(':variantId')
  @ApiOperation({ summary: 'Update a variant' })
  @ApiResponse({ status: 200, description: 'Variant updated' })
  async update(
    @Param('pageId') pageId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.variantsService.update(pageId, variantId, dto);
  }

  @Delete(':variantId')
  @ApiOperation({ summary: 'Delete a variant' })
  @ApiResponse({ status: 200, description: 'Variant deleted' })
  async delete(
    @Param('pageId') pageId: string,
    @Param('variantId') variantId: string,
  ) {
    return this.variantsService.delete(pageId, variantId);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder variants' })
  @ApiResponse({ status: 200, description: 'Variants reordered' })
  async reorder(
    @Param('pageId') pageId: string,
    @Body('variantIds') variantIds: string[],
  ) {
    return this.variantsService.reorder(pageId, variantIds);
  }

  // ============================================
  // Variant Options
  // ============================================

  @Post(':variantId/options')
  @ApiOperation({ summary: 'Create a new option for a variant' })
  @ApiResponse({ status: 201, description: 'Option created' })
  async createOption(
    @Param('variantId') variantId: string,
    @Body() dto: CreateVariantOptionDto,
  ) {
    return this.variantsService.createOption(variantId, dto);
  }

  @Patch('options/:optionId')
  @ApiOperation({ summary: 'Update an option' })
  @ApiResponse({ status: 200, description: 'Option updated' })
  async updateOption(
    @Param('optionId') optionId: string,
    @Body() dto: UpdateVariantOptionDto,
  ) {
    return this.variantsService.updateOption(optionId, dto);
  }

  @Delete('options/:optionId')
  @ApiOperation({ summary: 'Delete an option' })
  @ApiResponse({ status: 200, description: 'Option deleted' })
  async deleteOption(@Param('optionId') optionId: string) {
    return this.variantsService.deleteOption(optionId);
  }

  @Patch(':variantId/options/reorder')
  @ApiOperation({ summary: 'Reorder options' })
  @ApiResponse({ status: 200, description: 'Options reordered' })
  async reorderOptions(
    @Param('variantId') variantId: string,
    @Body('optionIds') optionIds: string[],
  ) {
    return this.variantsService.reorderOptions(variantId, optionIds);
  }
}
