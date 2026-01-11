import { IsString, IsOptional } from 'class-validator';

export class InitiatePaymentDto {
  @IsString()
  sessionId!: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
