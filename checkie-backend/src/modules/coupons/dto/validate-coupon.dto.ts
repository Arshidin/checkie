import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ValidateCouponDto {
  @ApiProperty({ example: 'SAVE20' })
  @IsString()
  code!: string;

  @ApiPropertyOptional({ example: 'page_123' })
  @IsOptional()
  @IsString()
  pageId?: string;

  @ApiPropertyOptional({ example: 99.99 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  amount?: number;
}

export class CouponValidationResult {
  valid!: boolean;
  coupon?: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
  };
  discountAmount?: number;
  error?: string;
}
