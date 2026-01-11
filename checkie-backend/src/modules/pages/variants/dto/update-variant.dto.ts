import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateVariantDto, CreateVariantOptionDto } from './create-variant.dto';

export class UpdateVariantDto extends PartialType(
  OmitType(CreateVariantDto, ['options'] as const),
) {}

export class UpdateVariantOptionDto extends PartialType(CreateVariantOptionDto) {}
