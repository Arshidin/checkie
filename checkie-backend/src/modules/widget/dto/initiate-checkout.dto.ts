import { IsString, IsOptional, IsUrl } from 'class-validator';

export class InitiateCheckoutDto {
  @IsString()
  sessionId!: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsUrl()
  returnUrl?: string;

  @IsOptional()
  @IsUrl()
  cancelUrl?: string;
}
