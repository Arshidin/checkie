import { IsString, IsOptional, IsUrl } from 'class-validator';

export class PaymentInitiationDto {
  @IsString()
  @IsOptional()
  paymentMethodId?: string;

  @IsUrl()
  @IsOptional()
  returnUrl?: string;
}
