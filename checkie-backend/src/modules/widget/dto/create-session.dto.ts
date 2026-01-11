import {
  IsString,
  IsEmail,
  IsOptional,
  IsObject,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateSessionDto {
  @IsString()
  pageId!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsObject()
  selectedVariants?: Record<string, string>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}
