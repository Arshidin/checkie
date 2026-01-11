import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PayoutsService, CreatePayoutParams } from './payouts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BalanceService } from '../balance/balance.service';
import {
  createMockPrismaService,
  createMockConfigService,
  createMockPayout,
} from '../../test/mocks';
import { Decimal } from '@prisma/client/runtime/library';
import { PayoutMethod, PayoutStatus, Currency } from '@prisma/client';

// Mock the crypto utility
jest.mock('../../common/utils/crypto.util', () => ({
  encryptObject: jest.fn().mockReturnValue({
    encrypted: 'encrypted-data',
    iv: 'iv-data',
    keyId: 'key-id',
  }),
  decryptObject: jest.fn().mockReturnValue({
    bankName: 'Test Bank',
    accountNumber: '****1234',
    routingNumber: '****5678',
  }),
}));

describe('PayoutsService', () => {
  let service: PayoutsService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let balanceService: jest.Mocked<BalanceService>;

  const mockPayout = createMockPayout();

  const createParams: CreatePayoutParams = {
    storeId: 'store-123',
    amount: 500,
    currency: Currency.USD,
    method: PayoutMethod.BANK_TRANSFER,
    destination: {
      bankName: 'Test Bank',
      accountNumber: '123456789',
      routingNumber: '987654321',
      accountHolderName: 'John Doe',
    },
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-encryption-key-32bytes!!'),
          },
        },
        {
          provide: BalanceService,
          useValue: {
            addTransaction: jest.fn().mockResolvedValue({}),
            getBalance: jest.fn().mockResolvedValue({ balance: new Decimal(1000) }),
          },
        },
      ],
    }).compile();

    service = module.get<PayoutsService>(PayoutsService);
    balanceService = module.get(BalanceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPayout', () => {
    beforeEach(() => {
      (prisma.payout.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.payout.create as jest.Mock).mockResolvedValue(mockPayout);
    });

    it('should create payout successfully', async () => {
      const result = await service.createPayout(createParams);

      expect(balanceService.getBalance).toHaveBeenCalledWith(
        createParams.storeId,
        createParams.currency,
      );
      expect(prisma.payout.create).toHaveBeenCalled();
      expect(balanceService.addTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PAYOUT_REQUESTED',
        }),
      );
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException for insufficient balance', async () => {
      (balanceService.getBalance as jest.Mock).mockResolvedValue({
        balance: new Decimal(100),
      });

      await expect(
        service.createPayout({ ...createParams, amount: 500 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for amount below minimum', async () => {
      await expect(
        service.createPayout({ ...createParams, amount: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if pending payout exists', async () => {
      (prisma.payout.findFirst as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'PENDING',
      });

      await expect(service.createPayout(createParams)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should encrypt destination data', async () => {
      await service.createPayout(createParams);

      expect(prisma.payout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            destinationEncrypted: 'encrypted-data',
            destinationIV: 'iv-data',
          }),
        }),
      );
    });
  });

  describe('processPayout', () => {
    it('should process pending payout', async () => {
      (prisma.payout.findUnique as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'PENDING',
      });
      (prisma.payout.update as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'PROCESSING',
      });

      const result = await service.processPayout(mockPayout.id);

      expect(result.status).toBe('PROCESSING');
      expect(prisma.payout.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PROCESSING',
            processedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent payout', async () => {
      (prisma.payout.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.processPayout('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for non-pending payout', async () => {
      (prisma.payout.findUnique as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'COMPLETED',
      });

      await expect(service.processPayout(mockPayout.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('completePayout', () => {
    it('should complete processing payout', async () => {
      (prisma.payout.findUnique as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'PROCESSING',
      });
      (prisma.payout.update as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'COMPLETED',
      });

      const result = await service.completePayout(mockPayout.id, 'prov_payout_123');

      expect(result.status).toBe('COMPLETED');
      expect(balanceService.addTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PAYOUT_COMPLETED',
        }),
      );
    });

    it('should throw BadRequestException for invalid state', async () => {
      (prisma.payout.findUnique as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'PENDING',
      });

      await expect(service.completePayout(mockPayout.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('failPayout', () => {
    it('should fail payout and return funds', async () => {
      (prisma.payout.findUnique as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'PROCESSING',
      });
      (prisma.payout.update as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'FAILED',
      });

      const result = await service.failPayout(mockPayout.id, 'Bank rejected');

      expect(result.status).toBe('FAILED');
      expect(balanceService.addTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ADJUSTMENT',
          amount: mockPayout.amount,
        }),
      );
    });

    it('should throw BadRequestException for completed payout', async () => {
      (prisma.payout.findUnique as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'COMPLETED',
      });

      await expect(
        service.failPayout(mockPayout.id, 'Some reason'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelPayout', () => {
    it('should cancel pending payout and return funds', async () => {
      (prisma.payout.findFirst as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'PENDING',
      });
      (prisma.payout.update as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'CANCELLED',
      });

      const result = await service.cancelPayout(mockPayout.id, 'store-123');

      expect(result.status).toBe('CANCELLED');
      expect(balanceService.addTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ADJUSTMENT',
        }),
      );
    });

    it('should throw BadRequestException for non-pending payout', async () => {
      (prisma.payout.findFirst as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'PROCESSING',
      });

      await expect(
        service.cancelPayout(mockPayout.id, 'store-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent payout', async () => {
      (prisma.payout.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.cancelPayout('non-existent', 'store-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByStore', () => {
    it('should return paginated payouts without sensitive data', async () => {
      const payouts = [mockPayout, { ...mockPayout, id: 'payout-456' }];
      (prisma.payout.findMany as jest.Mock).mockResolvedValue(payouts);
      (prisma.payout.count as jest.Mock).mockResolvedValue(2);

      const result = await service.findByStore('store-123', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      result.data.forEach((p) => {
        expect(p.destinationEncrypted).toBeUndefined();
        expect(p.destinationIV).toBeUndefined();
      });
    });

    it('should filter by status', async () => {
      (prisma.payout.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.payout.count as jest.Mock).mockResolvedValue(0);

      await service.findByStore('store-123', { status: PayoutStatus.COMPLETED });

      expect(prisma.payout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: PayoutStatus.COMPLETED,
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return payout', async () => {
      (prisma.payout.findFirst as jest.Mock).mockResolvedValue(mockPayout);

      const result = await service.findById(mockPayout.id, 'store-123');

      expect(result).toEqual(mockPayout);
    });

    it('should throw NotFoundException for non-existent payout', async () => {
      (prisma.payout.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findById('non-existent', 'store-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPayoutDestination', () => {
    it('should return decrypted destination', async () => {
      (prisma.payout.findFirst as jest.Mock).mockResolvedValue(mockPayout);

      const result = await service.getPayoutDestination(mockPayout.id, 'store-123');

      expect(result.bankName).toBe('Test Bank');
    });
  });
});
