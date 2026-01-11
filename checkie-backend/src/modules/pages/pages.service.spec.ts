import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PageStatus, PricingType, Currency } from '@prisma/client';
import { PagesService } from './pages.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('PagesService', () => {
  let service: PagesService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockPage = {
    id: 'page-123',
    storeId: 'store-123',
    name: 'Test Page',
    slug: 'test-page',
    description: 'A test page',
    pricingType: PricingType.FIXED,
    price: new Decimal(99.99),
    currency: 'USD',
    minPrice: null,
    maxPrice: null,
    suggestedPrice: null,
    subscriptionInterval: null,
    subscriptionIntervalCount: null,
    trialDays: null,
    headline: null,
    subheadline: null,
    buttonText: 'Pay Now',
    imageUrl: null,
    galleryImages: [],
    confirmationTitle: null,
    confirmationMessage: null,
    redirectUrl: null,
    requireShipping: false,
    allowCoupons: true,
    layoutType: 'standard',
    customCss: null,
    metaTitle: null,
    metaDescription: null,
    sessionTtlMinutes: 60,
    status: PageStatus.DRAFT,
    publishedAt: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    stats: {
      id: 'stats-123',
      pageId: 'page-123',
      viewCount: 0,
      conversionCount: 0,
      totalRevenue: new Decimal(0),
      lastViewAt: null,
      lastConversionAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagesService,
        {
          provide: PrismaService,
          useValue: {
            page: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PagesService>(PagesService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      name: 'Test Page',
      description: 'A test page',
      pricingType: PricingType.FIXED,
      price: 99.99,
      currency: Currency.USD,
    };

    it('should create a page successfully', async () => {
      (prismaService.page.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.page.create as jest.Mock).mockResolvedValue(mockPage);

      const result = await service.create('store-123', createDto);

      expect(prismaService.page.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storeId: 'store-123',
          name: 'Test Page',
          slug: 'test-page',
          pricingType: PricingType.FIXED,
          stats: { create: {} },
        }),
        include: { stats: true },
      });
      expect(result.name).toBe('Test Page');
    });

    it('should throw ConflictException if slug is taken', async () => {
      (prismaService.page.findUnique as jest.Mock).mockResolvedValue(mockPage);

      await expect(service.create('store-123', createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if fixed pricing without price', async () => {
      const dtoWithoutPrice = {
        name: 'Test Page',
        pricingType: PricingType.FIXED,
      };
      (prismaService.page.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create('store-123', dtoWithoutPrice),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if subscription without interval', async () => {
      const subscriptionDto = {
        name: 'Subscription Page',
        pricingType: PricingType.SUBSCRIPTION,
        price: 9.99,
      };
      (prismaService.page.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create('store-123', subscriptionDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if PWYW minPrice > maxPrice', async () => {
      const pwywDto = {
        name: 'PWYW Page',
        pricingType: PricingType.PAY_WHAT_YOU_WANT,
        minPrice: 100,
        maxPrice: 50,
      };
      (prismaService.page.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.create('store-123', pwywDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findById', () => {
    it('should return page if found', async () => {
      (prismaService.page.findFirst as jest.Mock).mockResolvedValue({
        ...mockPage,
        variants: [],
        customFields: [],
        embeds: [],
      });

      const result = await service.findById('store-123', 'page-123');

      expect(result.name).toBe('Test Page');
    });

    it('should throw NotFoundException if page not found', async () => {
      (prismaService.page.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findById('store-123', 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllByStore', () => {
    it('should return pages excluding archived by default', async () => {
      (prismaService.page.findMany as jest.Mock).mockResolvedValue([mockPage]);

      const result = await service.findAllByStore('store-123');

      expect(prismaService.page.findMany).toHaveBeenCalledWith({
        where: { storeId: 'store-123', archivedAt: null },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should include archived when specified', async () => {
      (prismaService.page.findMany as jest.Mock).mockResolvedValue([]);

      await service.findAllByStore('store-123', true);

      expect(prismaService.page.findMany).toHaveBeenCalledWith({
        where: { storeId: 'store-123' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Updated Page' };

    it('should update page successfully', async () => {
      (prismaService.page.findFirst as jest.Mock).mockResolvedValue(mockPage);
      (prismaService.page.update as jest.Mock).mockResolvedValue({
        ...mockPage,
        name: 'Updated Page',
      });

      const result = await service.update('store-123', 'page-123', updateDto);

      expect(result.name).toBe('Updated Page');
    });

    it('should throw NotFoundException if page not found', async () => {
      (prismaService.page.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('store-123', 'invalid-id', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if new slug is taken', async () => {
      (prismaService.page.findFirst as jest.Mock).mockResolvedValue(mockPage);
      (prismaService.page.findUnique as jest.Mock).mockResolvedValue({
        ...mockPage,
        id: 'other-page',
      });

      await expect(
        service.update('store-123', 'page-123', { slug: 'taken-slug' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete (archive)', () => {
    it('should archive page successfully', async () => {
      (prismaService.page.findFirst as jest.Mock).mockResolvedValue(mockPage);
      (prismaService.page.update as jest.Mock).mockResolvedValue({
        ...mockPage,
        status: PageStatus.ARCHIVED,
      });

      const result = await service.delete('store-123', 'page-123');

      expect(prismaService.page.update).toHaveBeenCalledWith({
        where: { id: 'page-123' },
        data: {
          status: PageStatus.ARCHIVED,
          archivedAt: expect.any(Date),
        },
      });
      expect(result.message).toBe('Page archived successfully');
    });

    it('should throw NotFoundException if page not found', async () => {
      (prismaService.page.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.delete('store-123', 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('publish', () => {
    it('should publish page successfully', async () => {
      (prismaService.page.findFirst as jest.Mock).mockResolvedValue(mockPage);
      (prismaService.page.update as jest.Mock).mockResolvedValue({
        ...mockPage,
        status: PageStatus.ACTIVE,
      });

      const result = await service.publish('store-123', 'page-123');

      expect(prismaService.page.update).toHaveBeenCalledWith({
        where: { id: 'page-123' },
        data: {
          status: PageStatus.ACTIVE,
          publishedAt: expect.any(Date),
        },
        include: { stats: true },
      });
      expect(result.status).toBe(PageStatus.ACTIVE);
    });

    it('should throw NotFoundException if page not found', async () => {
      (prismaService.page.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.publish('store-123', 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if page is archived', async () => {
      (prismaService.page.findFirst as jest.Mock).mockResolvedValue({
        ...mockPage,
        status: PageStatus.ARCHIVED,
      });

      await expect(
        service.publish('store-123', 'page-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if fixed pricing page has no price', async () => {
      (prismaService.page.findFirst as jest.Mock).mockResolvedValue({
        ...mockPage,
        pricingType: PricingType.FIXED,
        price: null,
      });

      await expect(
        service.publish('store-123', 'page-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('unpublish', () => {
    it('should unpublish page successfully', async () => {
      (prismaService.page.findFirst as jest.Mock).mockResolvedValue({
        ...mockPage,
        status: PageStatus.ACTIVE,
      });
      (prismaService.page.update as jest.Mock).mockResolvedValue({
        ...mockPage,
        status: PageStatus.DRAFT,
      });

      const result = await service.unpublish('store-123', 'page-123');

      expect(result.status).toBe(PageStatus.DRAFT);
    });
  });

  describe('duplicate', () => {
    it('should duplicate page successfully', async () => {
      (prismaService.page.findFirst as jest.Mock).mockResolvedValue({
        ...mockPage,
        variants: [],
        customFields: [],
      });
      (prismaService.page.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.page.create as jest.Mock).mockResolvedValue({
        ...mockPage,
        id: 'new-page-123',
        name: 'Test Page (Copy)',
        slug: 'test-page-copy',
      });

      const result = await service.duplicate('store-123', 'page-123');

      expect(result.name).toBe('Test Page (Copy)');
    });

    it('should throw NotFoundException if page not found', async () => {
      (prismaService.page.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.duplicate('store-123', 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle slug collision by adding counter', async () => {
      (prismaService.page.findFirst as jest.Mock).mockResolvedValue({
        ...mockPage,
        variants: [],
        customFields: [],
      });
      // First slug check returns existing, second returns null
      (prismaService.page.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null);
      (prismaService.page.create as jest.Mock).mockResolvedValue({
        ...mockPage,
        slug: 'test-page-copy-1',
      });

      await service.duplicate('store-123', 'page-123');

      expect(prismaService.page.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: 'test-page-copy-1',
          }),
        }),
      );
    });
  });
});
