import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import slugify from 'slugify';
import { StoreUserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStoreDto, UpdateStoreDto, InviteMemberDto } from './dto';

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateStoreDto) {
    // Generate slug if not provided
    const slug =
      dto.slug || slugify(dto.name, { lower: true, strict: true });

    // Check if slug is taken
    const existingStore = await this.prisma.store.findUnique({
      where: { slug },
    });

    if (existingStore) {
      throw new ConflictException('Store slug is already taken');
    }

    // Create store with owner
    const store = await this.prisma.store.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        websiteUrl: dto.websiteUrl,
        isActive: true,
        storeUsers: {
          create: {
            userId,
            role: StoreUserRole.OWNER,
          },
        },
      },
      include: {
        storeUsers: {
          where: { userId },
          select: { role: true },
        },
      },
    });

    const { storeUsers, ...storeData } = store;
    return {
      ...storeData,
      role: storeUsers[0]?.role,
    };
  }

  async findById(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return store;
  }

  async findBySlug(slug: string) {
    const store = await this.prisma.store.findUnique({
      where: { slug },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return store;
  }

  async update(storeId: string, dto: UpdateStoreDto) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return this.prisma.store.update({
      where: { id: storeId },
      data: dto,
    });
  }

  async getMembers(storeId: string) {
    const members = await this.prisma.storeUser.findMany({
      where: { storeId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return members.map((m) => ({
      ...m.user,
      role: m.role,
      joinedAt: m.createdAt,
    }));
  }

  async inviteMember(storeId: string, dto: InviteMemberDto) {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if already a member
    const existingMember = await this.prisma.storeUser.findUnique({
      where: {
        storeId_userId: {
          userId: user.id,
          storeId,
        },
      },
    });

    if (existingMember) {
      throw new ConflictException('User is already a member of this store');
    }

    // Cannot invite as owner
    if (dto.role === StoreUserRole.OWNER) {
      throw new ForbiddenException('Cannot invite as owner');
    }

    await this.prisma.storeUser.create({
      data: {
        userId: user.id,
        storeId,
        role: dto.role,
      },
    });

    return { message: 'Member invited successfully' };
  }

  async removeMember(storeId: string, memberId: string) {
    const member = await this.prisma.storeUser.findUnique({
      where: {
        storeId_userId: {
          userId: memberId,
          storeId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === StoreUserRole.OWNER) {
      throw new ForbiddenException('Cannot remove store owner');
    }

    await this.prisma.storeUser.delete({
      where: {
        storeId_userId: {
          userId: memberId,
          storeId,
        },
      },
    });

    return { message: 'Member removed successfully' };
  }

  async updateMemberRole(
    storeId: string,
    memberId: string,
    role: StoreUserRole,
  ) {
    const member = await this.prisma.storeUser.findUnique({
      where: {
        storeId_userId: {
          userId: memberId,
          storeId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === StoreUserRole.OWNER) {
      throw new ForbiddenException('Cannot change owner role');
    }

    if (role === StoreUserRole.OWNER) {
      throw new ForbiddenException('Cannot promote to owner');
    }

    await this.prisma.storeUser.update({
      where: {
        storeId_userId: {
          userId: memberId,
          storeId,
        },
      },
      data: { role },
    });

    return { message: 'Role updated successfully' };
  }

  async getUserRole(storeId: string, userId: string): Promise<StoreUserRole | null> {
    const storeUser = await this.prisma.storeUser.findUnique({
      where: {
        storeId_userId: {
          userId,
          storeId,
        },
      },
    });

    return storeUser?.role || null;
  }
}
