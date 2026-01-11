import {
  IsEnum,
  IsNumber,
  IsPositive,
  IsString,
  IsOptional,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PayoutMethod, Currency } from '@prisma/client';

export class BankAccountDestination {
  @IsString()
  accountNumber!: string;

  @IsString()
  routingNumber!: string;

  @IsString()
  accountHolderName!: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  swiftCode?: string;
}

export class CreatePayoutDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsEnum(Currency)
  currency!: Currency;

  @IsEnum(PayoutMethod)
  method!: PayoutMethod;

  @IsObject()
  @ValidateNested()
  @Type(() => BankAccountDestination)
  destination!: BankAccountDestination;
}
