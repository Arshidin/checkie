import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface AuthenticatedUser {
  id: string;
  email: string;
}

@Injectable()
export class StoreAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    const storeId = request.params.storeId;

    if (!storeId) {
      throw new NotFoundException('Store ID is required');
    }

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const storeUser = await this.prisma.storeUser.findUnique({
      where: {
        storeId_userId: {
          storeId,
          userId: user.id,
        },
      },
      include: {
        store: true,
      },
    });

    if (!storeUser) {
      throw new ForbiddenException('You do not have access to this store');
    }

    if (!storeUser.store.isActive) {
      throw new ForbiddenException('This store is inactive');
    }

    request.storeContext = {
      storeId: storeUser.storeId,
      userId: user.id,
      role: storeUser.role,
    };

    return true;
  }
}
