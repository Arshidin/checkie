import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsDateString,
  IsIn,
  MinLength,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCouponDto {
  @ApiProperty({ example: 'SAVE20' })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'Code can only contain uppercase letters, numbers, underscores, and hyphens',
  })
  code!: string;

  @ApiProperty({ enum: ['percent', 'fixed'], example: 'percent' })
  @IsString()
  @IsIn(['percent', 'fixed'])
  discountType!: 'percent' | 'fixed';

  @ApiProperty({ example: 20 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  discountValue!: number;

  @ApiPropertyOptional({ example: 100, description: 'Maximum number of uses' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  maxUses?: number;

  @ApiPropertyOptional({ example: 50.0, description: 'Minimum purchase amount' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  minPurchase?: number;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Limit to specific page IDs (empty = all pages)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pageIds?: string[];
}
