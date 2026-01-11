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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { StoreUserRole } from '@prisma/client';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreAccessGuard } from '../../common/guards/store-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Coupons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StoreAccessGuard)
@Controller('stores/:storeId/coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new coupon' })
  @ApiResponse({ status: 201, description: 'Coupon created' })
  @ApiResponse({ status: 409, description: 'Coupon code already exists' })
  async create(
    @Param('storeId') storeId: string,
    @Body() dto: CreateCouponDto,
  ) {
    return this.couponsService.create(storeId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all coupons for a store' })
  @ApiResponse({ status: 200, description: 'List of coupons' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  async findAll(
    @Param('storeId') storeId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.couponsService.findAllByStore(
      storeId,
      includeInactive === 'true',
    );
  }

  @Get(':couponId')
  @ApiOperation({ summary: 'Get coupon by ID' })
  @ApiResponse({ status: 200, description: 'Coupon details' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async findById(
    @Param('storeId') storeId: string,
    @Param('couponId') couponId: string,
  ) {
    return this.couponsService.findById(storeId, couponId);
  }

  @Patch(':couponId')
  @UseGuards(RolesGuard)
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN, StoreUserRole.MANAGER)
  @ApiOperation({ summary: 'Update a coupon' })
  @ApiResponse({ status: 200, description: 'Coupon updated' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async update(
    @Param('storeId') storeId: string,
    @Param('couponId') couponId: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.couponsService.update(storeId, couponId, dto);
  }

  @Delete(':couponId')
  @UseGuards(RolesGuard)
  @Roles(StoreUserRole.OWNER, StoreUserRole.ADMIN)
  @ApiOperation({ summary: 'Delete (deactivate) a coupon' })
  @ApiResponse({ status: 200, description: 'Coupon deactivated' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async delete(
    @Param('storeId') storeId: string,
    @Param('couponId') couponId: string,
  ) {
    return this.couponsService.delete(storeId, couponId);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate a coupon code' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validate(
    @Param('storeId') storeId: string,
    @Body() dto: ValidateCouponDto,
  ) {
    return this.couponsService.validateCoupon(storeId, dto);
  }
}
