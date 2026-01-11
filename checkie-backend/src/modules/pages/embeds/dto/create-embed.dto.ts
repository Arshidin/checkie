import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsObject } from 'class-validator';
import { EmbedType } from '@prisma/client';

export class EmbedSettingsDto {
  @ApiPropertyOptional({ example: '100%' })
  width?: string;

  @ApiPropertyOptional({ example: '600px' })
  height?: string;

  @ApiPropertyOptional({ example: '#ffffff' })
  backgroundColor?: string;

  @ApiPropertyOptional({ example: '8px' })
  borderRadius?: string;

  @ApiPropertyOptional({ example: true })
  showBorder?: boolean;

  @ApiPropertyOptional({ example: 'Buy Now' })
  buttonText?: string;

  @ApiPropertyOptional({ example: '#ee5a29' })
  buttonColor?: string;

  @ApiPropertyOptional({ example: '#ffffff' })
  buttonTextColor?: string;

  @ApiPropertyOptional({ example: 256, description: 'QR code size in pixels' })
  qrSize?: number;

  @ApiPropertyOptional({ example: '#000000', description: 'QR code foreground color' })
  qrForeground?: string;

  @ApiPropertyOptional({ example: '#ffffff', description: 'QR code background color' })
  qrBackground?: string;
}

export class CreateEmbedDto {
  @ApiProperty({ enum: EmbedType })
  @IsEnum(EmbedType)
  type!: EmbedType;

  @ApiPropertyOptional({ type: EmbedSettingsDto })
  @IsOptional()
  @IsObject()
  settings?: EmbedSettingsDto;
}
