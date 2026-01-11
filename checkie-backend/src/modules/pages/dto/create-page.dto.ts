import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  IsUrl,
  MinLength,
  MaxLength,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PricingType, Currency, SubscriptionInterval } from '@prisma/client';

export class CreatePageDto {
  @ApiProperty({ example: 'Premium Course' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'premium-course' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens',
  })
  slug?: string;

  @ApiPropertyOptional({ example: 'Learn advanced techniques' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: PricingType, default: PricingType.FIXED })
  @IsOptional()
  @IsEnum(PricingType)
  pricingType?: PricingType;

  @ApiPropertyOptional({ example: 99.99 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  price?: number;

  @ApiPropertyOptional({ enum: Currency, default: Currency.USD })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ example: 10.0, description: 'Minimum price for PWYW' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @ApiPropertyOptional({ example: 1000.0, description: 'Maximum price for PWYW' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;

  @ApiPropertyOptional({ example: 50.0, description: 'Suggested price for PWYW' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  suggestedPrice?: number;

  @ApiPropertyOptional({ enum: SubscriptionInterval })
  @IsOptional()
  @IsEnum(SubscriptionInterval)
  subscriptionInterval?: SubscriptionInterval;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  subscriptionIntervalCount?: number;

  @ApiPropertyOptional({ example: 7, description: 'Trial period in days' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(90)
  @Type(() => Number)
  trialDays?: number;

  @ApiPropertyOptional({ example: 'Get Instant Access' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  headline?: string;

  @ApiPropertyOptional({ example: 'Limited time offer' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  subheadline?: string;

  @ApiPropertyOptional({ example: 'Buy Now' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  buttonText?: string;

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  galleryImages?: string[];

  @ApiPropertyOptional({ example: 'Thank you for your purchase!' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  confirmationTitle?: string;

  @ApiPropertyOptional({ example: 'You will receive an email shortly.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  confirmationMessage?: string;

  @ApiPropertyOptional({ example: 'https://example.com/thank-you' })
  @IsOptional()
  @IsUrl()
  redirectUrl?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requireShipping?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowCoupons?: boolean;

  @ApiPropertyOptional({ example: 'standard' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  layoutType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  customCss?: string;

  @ApiPropertyOptional({ example: 'Premium Course - Best Deal' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  metaTitle?: string;

  @ApiPropertyOptional({ example: 'Get access to our premium course' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  metaDescription?: string;

  @ApiPropertyOptional({ example: 60, default: 60 })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(1440)
  @Type(() => Number)
  sessionTtlMinutes?: number;
}
