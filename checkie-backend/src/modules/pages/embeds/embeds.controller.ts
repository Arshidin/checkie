import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StoreUserRole } from '@prisma/client';
import { EmbedsService } from './embeds.service';
import { CreateEmbedDto, UpdateEmbedDto } from './dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../../common/guards/store-access.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('Page Embeds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StoreAccessGuard, RolesGuard)
@Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER)
@Controller('stores/:storeId/pages/:pageId/embeds')
export class EmbedsController {
  constructor(private readonly embedsService: EmbedsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new embed configuration for a page' })
  @ApiResponse({ status: 201, description: 'Embed created' })
  async create(@Param('pageId') pageId: string, @Body() dto: CreateEmbedDto) {
    return this.embedsService.create(pageId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all embed configurations for a page' })
  @ApiResponse({ status: 200, description: 'List of embeds' })
  async findAll(@Param('pageId') pageId: string) {
    return this.embedsService.findAllByPage(pageId);
  }

  @Get(':embedId')
  @ApiOperation({ summary: 'Get embed by ID' })
  @ApiResponse({ status: 200, description: 'Embed details' })
  async findById(@Param('pageId') pageId: string, @Param('embedId') embedId: string) {
    return this.embedsService.findById(pageId, embedId);
  }

  @Get(':embedId/code')
  @ApiOperation({ summary: 'Get embed code' })
  @ApiResponse({ status: 200, description: 'Embed code' })
  async getCode(@Param('pageId') pageId: string, @Param('embedId') embedId: string) {
    return this.embedsService.getEmbedCode(pageId, embedId);
  }

  @Patch(':embedId')
  @ApiOperation({ summary: 'Update an embed configuration' })
  @ApiResponse({ status: 200, description: 'Embed updated' })
  async update(
    @Param('pageId') pageId: string,
    @Param('embedId') embedId: string,
    @Body() dto: UpdateEmbedDto,
  ) {
    return this.embedsService.update(pageId, embedId, dto);
  }

  @Post(':embedId/regenerate')
  @ApiOperation({ summary: 'Regenerate embed code' })
  @ApiResponse({ status: 200, description: 'Embed code regenerated' })
  async regenerate(@Param('pageId') pageId: string, @Param('embedId') embedId: string) {
    return this.embedsService.regenerateCode(pageId, embedId);
  }

  @Delete(':embedId')
  @ApiOperation({ summary: 'Delete an embed configuration' })
  @ApiResponse({ status: 200, description: 'Embed deleted' })
  async delete(@Param('pageId') pageId: string, @Param('embedId') embedId: string) {
    return this.embedsService.delete(pageId, embedId);
  }
}
