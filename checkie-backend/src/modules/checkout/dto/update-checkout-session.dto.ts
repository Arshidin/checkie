import { IsString, IsOptional, IsObject, IsEmail, IsNumber } from 'class-validator';

export class UpdateCheckoutSessionDto {
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  customerFirstName?: string;

  @IsOptional()
  @IsString()
  customerLastName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsObject()
  selectedVariants?: Record<string, string>;

  @IsOptional()
  @IsObject()
  customFieldValues?: Record<string, string>;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsObject()
  billingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };

  @IsOptional()
  @IsObject()
  shippingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}
