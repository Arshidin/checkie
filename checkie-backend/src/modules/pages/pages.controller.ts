import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { StoreUserRole } from '@prisma/client';
import { PagesService } from './pages.service';
import { CreatePageDto, UpdatePageDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Pages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StoreAccessGuard)
@Controller('stores/:storeId/pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new checkout page' })
  @ApiResponse({ status: 201, description: 'Page created' })
  @ApiResponse({ status: 409, description: 'Slug already taken' })
  async create(@Param('storeId') storeId: string, @Body() dto: CreatePageDto) {
    return this.pagesService.create(storeId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all pages for a store' })
  @ApiResponse({ status: 200, description: 'List of pages' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  async findAll(
    @Param('storeId') storeId: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.pagesService.findAllByStore(storeId, includeArchived === 'true');
  }

  @Get(':pageId')
  @ApiOperation({ summary: 'Get page by ID' })
  @ApiResponse({ status: 200, description: 'Page details' })
  @ApiResponse({ status: 404, description: 'Page not found' })
  async findById(@Param('storeId') storeId: string, @Param('pageId') pageId: string) {
    return this.pagesService.findById(storeId, pageId);
  }

  @Patch(':pageId')
  @UseGuards(RolesGuard)
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER)
  @ApiOperation({ summary: 'Update a page' })
  @ApiResponse({ status: 200, description: 'Page updated' })
  @ApiResponse({ status: 404, description: 'Page not found' })
  async update(
    @Param('storeId') storeId: string,
    @Param('pageId') pageId: string,
    @Body() dto: UpdatePageDto,
  ) {
    return this.pagesService.update(storeId, pageId, dto);
  }

  @Delete(':pageId')
  @UseGuards(RolesGuard)
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  @ApiOperation({ summary: 'Delete (archive) a page' })
  @ApiResponse({ status: 200, description: 'Page archived' })
  @ApiResponse({ status: 404, description: 'Page not found' })
  async delete(@Param('storeId') storeId: string, @Param('pageId') pageId: string) {
    return this.pagesService.delete(storeId, pageId);
  }

  @Post(':pageId/publish')
  @UseGuards(RolesGuard)
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER)
  @ApiOperation({ summary: 'Publish a page' })
  @ApiResponse({ status: 200, description: 'Page published' })
  @ApiResponse({ status: 400, description: 'Page not ready for publishing' })
  async publish(@Param('storeId') storeId: string, @Param('pageId') pageId: string) {
    return this.pagesService.publish(storeId, pageId);
  }

  @Post(':pageId/unpublish')
  @UseGuards(RolesGuard)
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER)
  @ApiOperation({ summary: 'Unpublish a page (set to draft)' })
  @ApiResponse({ status: 200, description: 'Page unpublished' })
  async unpublish(@Param('storeId') storeId: string, @Param('pageId') pageId: string) {
    return this.pagesService.unpublish(storeId, pageId);
  }

  @Post(':pageId/archive')
  @UseGuards(RolesGuard)
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  @ApiOperation({ summary: 'Archive a page' })
  @ApiResponse({ status: 200, description: 'Page archived' })
  async archive(@Param('storeId') storeId: string, @Param('pageId') pageId: string) {
    return this.pagesService.archive(storeId, pageId);
  }

  @Post(':pageId/duplicate')
  @UseGuards(RolesGuard)
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER)
  @ApiOperation({ summary: 'Duplicate a page' })
  @ApiResponse({ status: 201, description: 'Page duplicated' })
  async duplicate(
    @Param('storeId') storeId: string,
    @Param('pageId') pageId: string,
    @Body('name') name?: string,
  ) {
    return this.pagesService.duplicate(storeId, pageId, name);
  }
}
