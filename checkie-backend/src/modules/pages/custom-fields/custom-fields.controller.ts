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
import { CustomFieldsService } from './custom-fields.service';
import { CreateCustomFieldDto, UpdateCustomFieldDto } from './dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../../common/guards/store-access.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('Page Custom Fields')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StoreAccessGuard, RolesGuard)
@Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER)
@Controller('stores/:storeId/pages/:pageId/custom-fields')
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new custom field for a page' })
  @ApiResponse({ status: 201, description: 'Custom field created' })
  async create(
    @Param('pageId') pageId: string,
    @Body() dto: CreateCustomFieldDto,
  ) {
    return this.customFieldsService.create(pageId, dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create multiple custom fields at once' })
  @ApiResponse({ status: 201, description: 'Custom fields created' })
  async bulkCreate(
    @Param('pageId') pageId: string,
    @Body() fields: CreateCustomFieldDto[],
  ) {
    return this.customFieldsService.bulkCreate(pageId, fields);
  }

  @Get()
  @ApiOperation({ summary: 'Get all custom fields for a page' })
  @ApiResponse({ status: 200, description: 'List of custom fields' })
  async findAll(@Param('pageId') pageId: string) {
    return this.customFieldsService.findAllByPage(pageId);
  }

  @Get(':fieldId')
  @ApiOperation({ summary: 'Get custom field by ID' })
  @ApiResponse({ status: 200, description: 'Custom field details' })
  async findById(
    @Param('pageId') pageId: string,
    @Param('fieldId') fieldId: string,
  ) {
    return this.customFieldsService.findById(pageId, fieldId);
  }

  @Patch(':fieldId')
  @ApiOperation({ summary: 'Update a custom field' })
  @ApiResponse({ status: 200, description: 'Custom field updated' })
  async update(
    @Param('pageId') pageId: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateCustomFieldDto,
  ) {
    return this.customFieldsService.update(pageId, fieldId, dto);
  }

  @Delete(':fieldId')
  @ApiOperation({ summary: 'Delete a custom field' })
  @ApiResponse({ status: 200, description: 'Custom field deleted' })
  async delete(
    @Param('pageId') pageId: string,
    @Param('fieldId') fieldId: string,
  ) {
    return this.customFieldsService.delete(pageId, fieldId);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder custom fields' })
  @ApiResponse({ status: 200, description: 'Custom fields reordered' })
  async reorder(
    @Param('pageId') pageId: string,
    @Body('fieldIds') fieldIds: string[],
  ) {
    return this.customFieldsService.reorder(pageId, fieldIds);
  }
}
