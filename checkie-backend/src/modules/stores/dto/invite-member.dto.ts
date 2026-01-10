import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum } from 'class-validator';
import { StoreUserRole } from '@prisma/client';

export class InviteMemberDto {
  @ApiProperty({ example: 'member@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: StoreUserRole, example: StoreUserRole.MANAGER })
  @IsEnum(StoreUserRole)
  role!: StoreUserRole;
}
