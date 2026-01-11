import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StoreUserRole } from '@prisma/client';
import { StoresService } from './stores.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('StoresService', () => {
  let service: StoresService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockStore = {
    id: 'store-123',
    name: 'Test Store',
    slug: 'test-store',
    description: 'A test store',
    websiteUrl: 'https://example.com',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    logoUrl: null,
    brandColor: null,
    stripeAccountId: null,
    stripeAccountStatus: null,
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  const mockStoreUser = {
    storeId: 'store-123',
    userId: 'user-123',
    role: StoreUserRole.OWNER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoresService,
        {
          provide: PrismaService,
          useValue: {
            store: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            storeUser: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
              update: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<StoresService>(StoresService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      name: 'Test Store',
      description: 'A test store',
      websiteUrl: 'https://example.com',
    };

    it('should create a store successfully', async () => {
      (prismaService.store.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.store.create as jest.Mock).mockResolvedValue({
        ...mockStore,
        storeUsers: [{ role: StoreUserRole.OWNER }],
      });

      const result = await service.create('user-123', createDto);

      expect(prismaService.store.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Store',
          slug: 'test-store',
          storeUsers: {
            create: {
              userId: 'user-123',
              role: StoreUserRole.OWNER,
            },
          },
        }),
        include: expect.any(Object),
      });
      expect(result.name).toBe('Test Store');
      expect(result.role).toBe(StoreUserRole.OWNER);
    });

    it('should throw ConflictException if slug is taken', async () => {
      (prismaService.store.findUnique as jest.Mock).mockResolvedValue(mockStore);

      await expect(service.create('user-123', createDto)).rejects.toThrow(ConflictException);
    });

    it('should use provided slug if given', async () => {
      const dtoWithSlug = { ...createDto, slug: 'custom-slug' };
      (prismaService.store.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.store.create as jest.Mock).mockResolvedValue({
        ...mockStore,
        slug: 'custom-slug',
        storeUsers: [{ role: StoreUserRole.OWNER }],
      });

      await service.create('user-123', dtoWithSlug);

      expect(prismaService.store.findUnique).toHaveBeenCalledWith({
        where: { slug: 'custom-slug' },
      });
    });
  });

  describe('findById', () => {
    it('should return store if found', async () => {
      (prismaService.store.findUnique as jest.Mock).mockResolvedValue(mockStore);

      const result = await service.findById('store-123');

      expect(result).toEqual(mockStore);
    });

    it('should throw NotFoundException if store not found', async () => {
      (prismaService.store.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Updated Store' };

    it('should update store successfully', async () => {
      (prismaService.store.findUnique as jest.Mock).mockResolvedValue(mockStore);
      (prismaService.store.update as jest.Mock).mockResolvedValue({
        ...mockStore,
        name: 'Updated Store',
      });

      const result = await service.update('store-123', updateDto);

      expect(result.name).toBe('Updated Store');
    });

    it('should throw NotFoundException if store not found', async () => {
      (prismaService.store.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.update('invalid-id', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMembers', () => {
    it('should return all members with user info', async () => {
      (prismaService.storeUser.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockStoreUser,
          user: mockUser,
        },
      ]);

      const result = await service.getMembers('store-123');

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('test@example.com');
      expect(result[0].role).toBe(StoreUserRole.OWNER);
    });
  });

  describe('inviteMember', () => {
    const inviteDto = {
      email: 'new@example.com',
      role: StoreUserRole.ADMIN,
    };

    it('should invite member successfully', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'new-user-123',
        email: 'new@example.com',
      });
      (prismaService.storeUser.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.storeUser.create as jest.Mock).mockResolvedValue({});

      const result = await service.inviteMember('store-123', inviteDto);

      expect(result.message).toBe('Member invited successfully');
    });

    it('should throw NotFoundException if user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.inviteMember('store-123', inviteDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if user is already a member', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-user',
      });
      (prismaService.storeUser.findUnique as jest.Mock).mockResolvedValue(mockStoreUser);

      await expect(service.inviteMember('store-123', inviteDto)).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException if trying to invite as owner', async () => {
      const ownerInvite = { ...inviteDto, role: StoreUserRole.OWNER };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'new-user',
      });
      (prismaService.storeUser.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.inviteMember('store-123', ownerInvite)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('removeMember', () => {
    it('should remove member successfully', async () => {
      (prismaService.storeUser.findUnique as jest.Mock).mockResolvedValue({
        ...mockStoreUser,
        role: StoreUserRole.ADMIN,
      });
      (prismaService.storeUser.delete as jest.Mock).mockResolvedValue({});

      const result = await service.removeMember('store-123', 'member-123');

      expect(result.message).toBe('Member removed successfully');
    });

    it('should throw NotFoundException if member not found', async () => {
      (prismaService.storeUser.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.removeMember('store-123', 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if trying to remove owner', async () => {
      (prismaService.storeUser.findUnique as jest.Mock).mockResolvedValue(mockStoreUser); // OWNER role

      await expect(service.removeMember('store-123', 'owner-id')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role successfully', async () => {
      (prismaService.storeUser.findUnique as jest.Mock).mockResolvedValue({
        ...mockStoreUser,
        role: StoreUserRole.ADMIN,
      });
      (prismaService.storeUser.update as jest.Mock).mockResolvedValue({});

      const result = await service.updateMemberRole(
        'store-123',
        'member-123',
        StoreUserRole.MANAGER,
      );

      expect(result.message).toBe('Role updated successfully');
    });

    it('should throw NotFoundException if member not found', async () => {
      (prismaService.storeUser.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateMemberRole('store-123', 'invalid-id', StoreUserRole.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if trying to change owner role', async () => {
      (prismaService.storeUser.findUnique as jest.Mock).mockResolvedValue(mockStoreUser); // OWNER role

      await expect(
        service.updateMemberRole('store-123', 'owner-id', StoreUserRole.ADMIN),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if trying to promote to owner', async () => {
      (prismaService.storeUser.findUnique as jest.Mock).mockResolvedValue({
        ...mockStoreUser,
        role: StoreUserRole.ADMIN,
      });

      await expect(
        service.updateMemberRole('store-123', 'admin-id', StoreUserRole.OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUserRole', () => {
    it('should return user role if member', async () => {
      (prismaService.storeUser.findUnique as jest.Mock).mockResolvedValue(mockStoreUser);

      const result = await service.getUserRole('store-123', 'user-123');

      expect(result).toBe(StoreUserRole.OWNER);
    });

    it('should return null if not a member', async () => {
      (prismaService.storeUser.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getUserRole('store-123', 'non-member');

      expect(result).toBeNull();
    });
  });
});
