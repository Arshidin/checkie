import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PageStatsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Atomically increment view count for a page
   */
  async incrementView(pageId: string) {
    await this.prisma.$executeRaw`
      UPDATE "PageStats"
      SET "viewCount" = "viewCount" + 1,
          "lastViewAt" = NOW(),
          "updatedAt" = NOW()
      WHERE "pageId" = ${pageId}
    `;
  }

  /**
   * Atomically increment conversion count and add revenue
   */
  async incrementConversion(pageId: string, amount: number | Prisma.Decimal) {
    const amountDecimal = new Prisma.Decimal(amount.toString());

    await this.prisma.$executeRaw`
      UPDATE "PageStats"
      SET "conversionCount" = "conversionCount" + 1,
          "totalRevenue" = "totalRevenue" + ${amountDecimal},
          "lastConversionAt" = NOW(),
          "updatedAt" = NOW()
      WHERE "pageId" = ${pageId}
    `;
  }

  /**
   * Get stats for a page
   */
  async getStats(pageId: string) {
    const stats = await this.prisma.pageStats.findUnique({
      where: { pageId },
    });

    if (!stats) {
      return null;
    }

    return {
      viewCount: stats.viewCount,
      conversionCount: stats.conversionCount,
      totalRevenue: stats.totalRevenue.toNumber(),
      conversionRate:
        stats.viewCount > 0 ? ((stats.conversionCount / stats.viewCount) * 100).toFixed(2) : '0.00',
      lastViewAt: stats.lastViewAt,
      lastConversionAt: stats.lastConversionAt,
    };
  }

  /**
   * Get stats for all pages in a store
   */
  async getStoreStats(storeId: string) {
    const pages = await this.prisma.page.findMany({
      where: { storeId, archivedAt: null },
      include: { stats: true },
      orderBy: { createdAt: 'desc' },
    });

    const stats = pages.map((page) => ({
      pageId: page.id,
      pageName: page.name,
      pageSlug: page.slug,
      status: page.status,
      viewCount: page.stats?.viewCount || 0,
      conversionCount: page.stats?.conversionCount || 0,
      totalRevenue: page.stats?.totalRevenue?.toNumber() || 0,
      conversionRate:
        (page.stats?.viewCount || 0) > 0
          ? (((page.stats?.conversionCount || 0) / (page.stats?.viewCount || 1)) * 100).toFixed(2)
          : '0.00',
    }));

    // Calculate totals
    const totals = stats.reduce(
      (acc, s) => ({
        totalViews: acc.totalViews + s.viewCount,
        totalConversions: acc.totalConversions + s.conversionCount,
        totalRevenue: acc.totalRevenue + s.totalRevenue,
      }),
      { totalViews: 0, totalConversions: 0, totalRevenue: 0 },
    );

    return {
      pages: stats,
      totals: {
        ...totals,
        overallConversionRate:
          totals.totalViews > 0
            ? ((totals.totalConversions / totals.totalViews) * 100).toFixed(2)
            : '0.00',
      },
    };
  }

  /**
   * Ensure stats record exists for a page
   */
  async ensureStatsExist(pageId: string) {
    const exists = await this.prisma.pageStats.findUnique({
      where: { pageId },
    });

    if (!exists) {
      await this.prisma.pageStats.create({
        data: { pageId },
      });
    }
  }

  /**
   * Get time-series stats for a page (daily aggregates)
   * This would typically use a separate analytics table
   * For now, returns current totals
   */
  async getPageAnalytics(pageId: string, _startDate: Date, _endDate: Date) {
    const stats = await this.getStats(pageId);

    return {
      period: {
        start: _startDate,
        end: _endDate,
      },
      summary: stats,
      // In production, you'd have daily/hourly aggregates here
      daily: [],
    };
  }
}
