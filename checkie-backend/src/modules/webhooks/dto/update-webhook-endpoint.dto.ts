import {
  IsString,
  IsUrl,
  IsArray,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class UpdateWebhookEndpointDto {
  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
