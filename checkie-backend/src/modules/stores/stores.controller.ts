import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StoreUserRole } from '@prisma/client';
import { StoresService } from './stores.service';
import { CreateStoreDto, UpdateStoreDto, InviteMemberDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Stores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new store' })
  @ApiResponse({ status: 201, description: 'Store created' })
  @ApiResponse({ status: 409, description: 'Slug already taken' })
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateStoreDto) {
    return this.storesService.create(user.id, dto);
  }

  @Get(':storeId')
  @UseGuards(StoreAccessGuard)
  @ApiOperation({ summary: 'Get store by ID' })
  @ApiResponse({ status: 200, description: 'Store details' })
  async findById(@Param('storeId') storeId: string) {
    return this.storesService.findById(storeId);
  }

  @Patch(':storeId')
  @UseGuards(StoreAccessGuard, RolesGuard)
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  @ApiOperation({ summary: 'Update store' })
  @ApiResponse({ status: 200, description: 'Store updated' })
  async update(@Param('storeId') storeId: string, @Body() dto: UpdateStoreDto) {
    return this.storesService.update(storeId, dto);
  }

  @Get(':storeId/members')
  @UseGuards(StoreAccessGuard)
  @ApiOperation({ summary: 'Get store members' })
  @ApiResponse({ status: 200, description: 'List of members' })
  async getMembers(@Param('storeId') storeId: string) {
    return this.storesService.getMembers(storeId);
  }

  @Post(':storeId/members')
  @UseGuards(StoreAccessGuard, RolesGuard)
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  @ApiOperation({ summary: 'Invite a member' })
  @ApiResponse({ status: 201, description: 'Member invited' })
  async inviteMember(@Param('storeId') storeId: string, @Body() dto: InviteMemberDto) {
    return this.storesService.inviteMember(storeId, dto);
  }

  @Delete(':storeId/members/:memberId')
  @UseGuards(StoreAccessGuard, RolesGuard)
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  @ApiOperation({ summary: 'Remove a member' })
  @ApiResponse({ status: 200, description: 'Member removed' })
  async removeMember(@Param('storeId') storeId: string, @Param('memberId') memberId: string) {
    return this.storesService.removeMember(storeId, memberId);
  }

  @Patch(':storeId/members/:memberId/role')
  @UseGuards(StoreAccessGuard, RolesGuard)
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  @ApiOperation({ summary: 'Update member role' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  async updateMemberRole(
    @Param('storeId') storeId: string,
    @Param('memberId') memberId: string,
    @Body('role') role: StoreUserRole,
  ) {
    return this.storesService.updateMemberRole(storeId, memberId, role);
  }
}
