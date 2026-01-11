import { IsString, IsNumber, Min } from 'class-validator';

export class WidgetValidateCouponDto {
  @IsString()
  code!: string;

  @IsString()
  pageId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CouponValidationResponseDto {
  valid!: boolean;
  coupon?: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
  };
  discountAmount?: number;
  finalAmount?: number;
  message?: string;
}
