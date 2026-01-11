import { Controller, Get, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, StoreAccessGuard, Roles } from '../../common';
import { StoreUserRole } from '@prisma/client';
import { CustomersService } from './customers.service';
import { UpdateCustomerDto, CustomerQueryDto } from './dto';

@Controller('stores/:storeId/customers')
@UseGuards(JwtAuthGuard, StoreAccessGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  /**
   * List customers for a store
   * GET /api/stores/:storeId/customers
   */
  @Get()
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER)
  async findAll(@Param('storeId') storeId: string, @Query() query: CustomerQueryDto) {
    const result = await this.customersService.findAll(storeId, query);
    return { data: result };
  }

  /**
   * Get customer stats
   * GET /api/stores/:storeId/customers/stats
   */
  @Get('stats')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  async getStats(@Param('storeId') storeId: string) {
    const stats = await this.customersService.getStats(storeId);
    return { data: stats };
  }

  /**
   * Get customer by ID
   * GET /api/stores/:storeId/customers/:customerId
   */
  @Get(':customerId')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER)
  async findOne(@Param('storeId') storeId: string, @Param('customerId') customerId: string) {
    const customer = await this.customersService.findOne(storeId, customerId);
    return { data: customer };
  }

  /**
   * Update customer
   * PATCH /api/stores/:storeId/customers/:customerId
   */
  @Patch(':customerId')
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  async update(
    @Param('storeId') storeId: string,
    @Param('customerId') customerId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    const customer = await this.customersService.update(storeId, customerId, dto);
    return { data: customer };
  }

  /**
   * Delete customer
   * DELETE /api/stores/:storeId/customers/:customerId
   */
  @Delete(':customerId')
  @Roles(StoreUserRole.OWNER)
  async delete(@Param('storeId') storeId: string, @Param('customerId') customerId: string) {
    await this.customersService.delete(storeId, customerId);
    return { data: { success: true } };
  }
}
