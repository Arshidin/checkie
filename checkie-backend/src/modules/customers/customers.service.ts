import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';
import {
  CustomerResponseDto,
  CustomerListResponseDto,
  CustomerDetailResponseDto,
  CustomerQueryDto,
  UpdateCustomerDto,
} from './dto';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List customers for a store (dashboard)
   */
  async findAll(storeId: string, query: CustomerQueryDto): Promise<CustomerListResponseDto> {
    const { search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: any = { storeId };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              payments: true,
              subscriptions: true,
            },
          },
          payments: {
            select: {
              amount: true,
            },
            where: {
              status: PaymentStatus.COMPLETED,
            },
          },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      customers: customers.map((c) => this.mapToResponse(c)),
      total,
      page,
      limit,
      hasMore: skip + customers.length < total,
    };
  }

  /**
   * Get customer by ID (dashboard)
   */
  async findOne(storeId: string, customerId: string): Promise<CustomerDetailResponseDto> {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        storeId,
      },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            createdAt: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
          },
        },
        _count: {
          select: {
            payments: true,
            subscriptions: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Calculate total spent
    const totalSpent = await this.prisma.payment.aggregate({
      where: {
        customerId: customer.id,
        status: PaymentStatus.COMPLETED,
      },
      _sum: {
        amount: true,
      },
    });

    return {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName || undefined,
      lastName: customer.lastName || undefined,
      phone: customer.phone || undefined,
      billingAddress: customer.billingAddress as Record<string, any> | undefined,
      shippingAddress: customer.shippingAddress as Record<string, any> | undefined,
      providerCustomerId: customer.providerCustomerId || undefined,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      totalSpent: totalSpent._sum?.amount ? Number(totalSpent._sum.amount) : 0,
      paymentsCount: customer._count.payments,
      subscriptionsCount: customer._count.subscriptions,
      payments: customer.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
      subscriptions: customer.subscriptions.map((s) => ({
        id: s.id,
        status: s.status,
        currentPeriodStart: s.currentPeriodStart.toISOString(),
        currentPeriodEnd: s.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      })),
    };
  }

  /**
   * Update customer (dashboard)
   */
  async update(
    storeId: string,
    customerId: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        storeId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Check email uniqueness if changing
    if (dto.email && dto.email !== customer.email) {
      const existing = await this.prisma.customer.findFirst({
        where: {
          storeId,
          email: dto.email,
          id: { not: customerId },
        },
      });

      if (existing) {
        throw new ConflictException('Customer with this email already exists');
      }
    }

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        billingAddress: dto.billingAddress,
        shippingAddress: dto.shippingAddress,
      },
      include: {
        _count: {
          select: {
            payments: true,
            subscriptions: true,
          },
        },
        payments: {
          select: { amount: true },
          where: { status: PaymentStatus.COMPLETED },
        },
      },
    });

    this.logger.log(`Updated customer ${customerId}`);

    return this.mapToResponse(updated);
  }

  /**
   * Delete customer (dashboard)
   */
  async delete(storeId: string, customerId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        storeId,
      },
      include: {
        _count: {
          select: {
            payments: true,
            subscriptions: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer._count.subscriptions > 0) {
      throw new ConflictException('Cannot delete customer with active subscriptions');
    }

    await this.prisma.customer.delete({
      where: { id: customerId },
    });

    this.logger.log(`Deleted customer ${customerId}`);
  }

  /**
   * Get customer stats for dashboard
   */
  async getStats(storeId: string) {
    const [totalCustomers, newCustomersThisMonth, totalRevenue] = await Promise.all([
      this.prisma.customer.count({ where: { storeId } }),
      this.prisma.customer.count({
        where: {
          storeId,
          createdAt: {
            gte: new Date(new Date().setDate(1)), // First day of current month
          },
        },
      }),
      this.prisma.payment.aggregate({
        where: {
          storeId,
          status: PaymentStatus.COMPLETED,
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalCustomers,
      newCustomersThisMonth,
      totalRevenue: totalRevenue._sum?.amount ? Number(totalRevenue._sum.amount) : 0,
    };
  }

  private mapToResponse(customer: any): CustomerResponseDto {
    const totalSpent =
      customer.payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;

    return {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName || undefined,
      lastName: customer.lastName || undefined,
      phone: customer.phone || undefined,
      billingAddress: customer.billingAddress as Record<string, any> | undefined,
      shippingAddress: customer.shippingAddress as Record<string, any> | undefined,
      providerCustomerId: customer.providerCustomerId || undefined,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      totalSpent,
      paymentsCount: customer._count?.payments || 0,
      subscriptionsCount: customer._count?.subscriptions || 0,
    };
  }
}
