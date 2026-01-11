import { IsOptional, IsBoolean, IsString } from 'class-validator';

export class CancelSubscriptionDto {
  @IsOptional()
  @IsBoolean()
  cancelImmediately?: boolean = false;

  @IsOptional()
  @IsString()
  reason?: string;
}
