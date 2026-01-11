import {
  IsString,
  IsEmail,
} from 'class-validator';

export class RequestPortalAccessDto {
  @IsEmail()
  email!: string;

  @IsString()
  storeSlug!: string;
}

export class VerifyPortalTokenDto {
  @IsString()
  token!: string;
}

export class PortalSessionResponseDto {
  accessToken!: string;
  expiresAt!: string;
  customer!: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}
