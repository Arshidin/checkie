import { SetMetadata } from '@nestjs/common';
import { StoreUserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: StoreUserRole[]) => SetMetadata(ROLES_KEY, roles);
