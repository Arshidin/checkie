import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StoreUserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { StoreContext } from '../decorators/store-context.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<StoreUserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const storeContext = request.storeContext as StoreContext;

    if (!storeContext) {
      throw new ForbiddenException('Store context is required');
    }

    const hasRole = requiredRoles.includes(storeContext.role as StoreUserRole);

    if (!hasRole) {
      throw new ForbiddenException(
        `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
