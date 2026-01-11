import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsEnum,
  IsObject,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CustomFieldType } from '@prisma/client';

export class CreateCustomFieldDto {
  @ApiProperty({ example: 'company_name' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @ApiProperty({ example: 'Company Name' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label!: string;

  @ApiProperty({ enum: CustomFieldType })
  @IsEnum(CustomFieldType)
  type!: CustomFieldType;

  @ApiPropertyOptional({ example: 'Enter your company name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeholder?: string;

  @ApiPropertyOptional({ example: 'This will appear on your invoice' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  helpText?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  displayOrder?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['Option 1', 'Option 2'],
    description: 'Options for DROPDOWN, RADIO, CHECKBOX types',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({ example: 'Default Value' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  defaultValue?: string;

  @ApiPropertyOptional({ example: '^[a-zA-Z0-9]+$' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  validationRegex?: string;

  @ApiPropertyOptional({ example: '1', description: 'Minimum value for NUMBER type' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  minValue?: string;

  @ApiPropertyOptional({ example: '100', description: 'Maximum value for NUMBER type' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  maxValue?: string;

  @ApiPropertyOptional({
    description: 'Conditional display logic',
    example: { showIf: { field: 'country', value: 'US' } },
  })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, any>;
}
