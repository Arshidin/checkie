import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsPositive,
  MaxLength,
} from 'class-validator';
import { RefundReason } from '@prisma/client';

export class CreateRefundDto {
  @IsNumber()
  @IsPositive()
  @IsOptional()
  amount?: number;

  @IsEnum(RefundReason)
  reason!: RefundReason;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  reasonDetails?: string;
}
