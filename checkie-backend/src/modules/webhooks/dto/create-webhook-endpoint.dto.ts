import { IsString, IsUrl, IsArray, IsOptional, IsBoolean, ArrayMinSize } from 'class-validator';

export class CreateWebhookEndpointDto {
  @IsUrl()
  url!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  events!: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
