import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('CouponsService', () => {
  let service: CouponsService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockCoupon = {
    id: 'coupon-123',
    storeId: 'store-123',
    code: 'SAVE10',
    discountType: 'percent',
    discountValue: new Decimal(10),
    maxUses: 100,
    usedCount: 0,
    minPurchase: new Decimal(50),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    pageCoupons: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        {
          provide: PrismaService,
          useValue: {
            coupon: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            pageCoupon: {
              deleteMany: jest.fn(),
              createMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      code: 'SAVE10',
      discountType: 'percent' as const,
      discountValue: 10,
      maxUses: 100,
      minPurchase: 50,
    };

    it('should create a coupon successfully', async () => {
      (prismaService.coupon.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.coupon.create as jest.Mock).mockResolvedValue(mockCoupon);

      const result = await service.create('store-123', createDto);

      expect(prismaService.coupon.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storeId: 'store-123',
          code: 'SAVE10',
          discountType: 'percent',
          discountValue: 10,
        }),
        include: expect.any(Object),
      });
      expect(result.code).toBe('SAVE10');
    });

    it('should uppercase the coupon code', async () => {
      const dtoLowercase = { ...createDto, code: 'save10' };
      (prismaService.coupon.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.coupon.create as jest.Mock).mockResolvedValue(mockCoupon);

      await service.create('store-123', dtoLowercase);

      expect(prismaService.coupon.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: 'SAVE10',
        }),
        include: expect.any(Object),
      });
    });

    it('should throw ConflictException if code already exists', async () => {
      (prismaService.coupon.findUnique as jest.Mock).mockResolvedValue(
        mockCoupon,
      );

      await expect(service.create('store-123', createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if percent discount exceeds 100', async () => {
      const invalidDto = { ...createDto, discountValue: 150 };
      (prismaService.coupon.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.create('store-123', invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAllByStore', () => {
    it('should return only active coupons by default', async () => {
      (prismaService.coupon.findMany as jest.Mock).mockResolvedValue([
        mockCoupon,
      ]);

      const result = await service.findAllByStore('store-123');

      expect(prismaService.coupon.findMany).toHaveBeenCalledWith({
        where: { storeId: 'store-123', isActive: true },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should include inactive when specified', async () => {
      (prismaService.coupon.findMany as jest.Mock).mockResolvedValue([]);

      await service.findAllByStore('store-123', true);

      expect(prismaService.coupon.findMany).toHaveBeenCalledWith({
        where: { storeId: 'store-123' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findById', () => {
    it('should return coupon if found', async () => {
      (prismaService.coupon.findFirst as jest.Mock).mockResolvedValue(
        mockCoupon,
      );

      const result = await service.findById('store-123', 'coupon-123');

      expect(result.code).toBe('SAVE10');
    });

    it('should throw NotFoundException if coupon not found', async () => {
      (prismaService.coupon.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findById('store-123', 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = { discountValue: 20 };

    it('should update coupon successfully', async () => {
      (prismaService.coupon.findFirst as jest.Mock).mockResolvedValue(
        mockCoupon,
      );
      (prismaService.coupon.update as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        discountValue: new Decimal(20),
      });

      const result = await service.update('store-123', 'coupon-123', updateDto);

      expect(result.discountValue).toBe(20);
    });

    it('should throw NotFoundException if coupon not found', async () => {
      (prismaService.coupon.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('store-123', 'invalid-id', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if updating percent to exceed 100', async () => {
      (prismaService.coupon.findFirst as jest.Mock).mockResolvedValue(
        mockCoupon,
      );

      await expect(
        service.update('store-123', 'coupon-123', { discountValue: 150 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete (deactivate)', () => {
    it('should deactivate coupon successfully', async () => {
      (prismaService.coupon.findFirst as jest.Mock).mockResolvedValue(
        mockCoupon,
      );
      (prismaService.coupon.update as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        isActive: false,
      });

      const result = await service.delete('store-123', 'coupon-123');

      expect(prismaService.coupon.update).toHaveBeenCalledWith({
        where: { id: 'coupon-123' },
        data: { isActive: false },
      });
      expect(result.message).toBe('Coupon deactivated successfully');
    });

    it('should throw NotFoundException if coupon not found', async () => {
      (prismaService.coupon.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.delete('store-123', 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateCoupon', () => {
    const validateDto = {
      code: 'SAVE10',
      amount: 100,
    };

    it('should validate coupon successfully with percent discount', async () => {
      (prismaService.coupon.findUnique as jest.Mock).mockResolvedValue(
        mockCoupon,
      );

      const result = await service.validateCoupon('store-123', validateDto);

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(10); // 10% of 100
      expect(result.coupon?.code).toBe('SAVE10');
    });

    it('should validate coupon successfully with fixed discount', async () => {
      const fixedCoupon = {
        ...mockCoupon,
        discountType: 'fixed',
        discountValue: new Decimal(15),
      };
      (prismaService.coupon.findUnique as jest.Mock).mockResolvedValue(
        fixedCoupon,
      );

      const result = await service.validateCoupon('store-123', validateDto);

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(15);
    });

    it('should return invalid if coupon not found', async () => {
      (prismaService.coupon.findUnique as jest.Mock).mockRejectedValue(
        new NotFoundException(),
      );

      const result = await service.validateCoupon('store-123', {
        code: 'INVALID',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid coupon code');
    });

    it('should return invalid if coupon is not active', async () => {
      (prismaService.coupon.findUnique as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        isActive: false,
      });

      const result = await service.validateCoupon('store-123', validateDto);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon is not active');
    });

    it('should return invalid if coupon is expired', async () => {
      (prismaService.coupon.findUnique as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        expiresAt: new Date(Date.now() - 1000), // expired
      });

      const result = await service.validateCoupon('store-123', validateDto);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon has expired');
    });

    it('should return invalid if max uses reached', async () => {
      (prismaService.coupon.findUnique as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        maxUses: 10,
        usedCount: 10,
      });

      const result = await service.validateCoupon('store-123', validateDto);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon has reached maximum uses');
    });

    it('should return invalid if below minimum purchase', async () => {
      (prismaService.coupon.findUnique as jest.Mock).mockResolvedValue(
        mockCoupon,
      );

      const result = await service.validateCoupon('store-123', {
        code: 'SAVE10',
        amount: 30, // below minPurchase of 50
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Minimum purchase');
    });

    it('should return invalid if coupon not valid for specific page', async () => {
      (prismaService.coupon.findUnique as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        pageCoupons: [{ pageId: 'page-456' }], // restricted to different page
      });

      const result = await service.validateCoupon('store-123', {
        code: 'SAVE10',
        pageId: 'page-123',
        amount: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon is not valid for this page');
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage count', async () => {
      (prismaService.coupon.update as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        usedCount: 1,
      });

      await service.incrementUsage('coupon-123');

      expect(prismaService.coupon.update).toHaveBeenCalledWith({
        where: { id: 'coupon-123' },
        data: { usedCount: { increment: 1 } },
      });
    });
  });
});
