import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

export interface IdempotencyResult {
  isNew: boolean;
  existingResponse?: {
    status: number;
    body: any;
  };
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly REDIS_PREFIX = 'idempotency:';
  private readonly REDIS_TTL = 60 * 60 * 24; // 24 hours
  private readonly DB_EXPIRY_DAYS = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async checkOrCreate(
    key: string,
    storeId: string | null,
    endpoint: string,
    requestBody: any,
  ): Promise<IdempotencyResult> {
    const requestHash = this.hashRequest(requestBody);
    const redisKey = `${this.REDIS_PREFIX}${key}`;

    // First check Redis cache
    const cached = await this.redis.getJson<{
      requestHash: string;
      responseStatus: number;
      responseBody: any;
    }>(redisKey);

    if (cached) {
      if (cached.requestHash !== requestHash) {
        throw new ConflictException(
          'Idempotency key already used with different request body',
        );
      }
      return {
        isNew: false,
        existingResponse: {
          status: cached.responseStatus,
          body: cached.responseBody,
        },
      };
    }

    // Check database
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          'Idempotency key already used with different request body',
        );
      }

      // Cache in Redis for future requests
      await this.redis.setJson(
        redisKey,
        {
          requestHash: existing.requestHash,
          responseStatus: existing.responseStatus,
          responseBody: existing.responseBody,
        },
        this.REDIS_TTL,
      );

      return {
        isNew: false,
        existingResponse: {
          status: existing.responseStatus,
          body: existing.responseBody as any,
        },
      };
    }

    // Create new idempotency key record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.DB_EXPIRY_DAYS);

    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key,
          storeId,
          endpoint,
          requestHash,
          responseStatus: 0, // Will be updated when response is set
          responseBody: Prisma.JsonNull,
          expiresAt,
        },
      });
    } catch (error: any) {
      // Handle race condition - another request might have created it
      if (error.code === 'P2002') {
        // Unique constraint violation
        const existing = await this.prisma.idempotencyKey.findUnique({
          where: { key },
        });

        if (existing && existing.requestHash !== requestHash) {
          throw new ConflictException(
            'Idempotency key already used with different request body',
          );
        }

        if (existing?.responseStatus) {
          return {
            isNew: false,
            existingResponse: {
              status: existing.responseStatus,
              body: existing.responseBody,
            },
          };
        }
      }
      throw error;
    }

    return { isNew: true };
  }

  async setResponse(
    key: string,
    status: number,
    body: any,
  ): Promise<void> {
    const redisKey = `${this.REDIS_PREFIX}${key}`;

    // Update database
    const updated = await this.prisma.idempotencyKey.update({
      where: { key },
      data: {
        responseStatus: status,
        responseBody: body,
      },
    });

    // Cache in Redis
    await this.redis.setJson(
      redisKey,
      {
        requestHash: updated.requestHash,
        responseStatus: status,
        responseBody: body,
      },
      this.REDIS_TTL,
    );

    this.logger.debug(`Idempotency response saved for key: ${key}`);
  }

  async invalidate(key: string): Promise<void> {
    const redisKey = `${this.REDIS_PREFIX}${key}`;
    await this.redis.del(redisKey);
    await this.prisma.idempotencyKey.delete({
      where: { key },
    }).catch(() => {
      // Ignore if not found
    });
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.idempotencyKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired idempotency keys`);
    return result.count;
  }

  private hashRequest(body: any): string {
    const normalized = JSON.stringify(body, Object.keys(body || {}).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  generateKey(): string {
    return crypto.randomUUID();
  }
}
