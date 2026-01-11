import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../modules/redis/redis.service';
import { Public } from '../common/decorators/public.decorator';

interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  services: {
    database: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
    redis: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
  };
  version: string;
  environment: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async check(): Promise<HealthStatus> {
    const status: HealthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: { status: 'ok' },
        redis: { status: 'ok' },
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    // Check database
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      status.services.database.latencyMs = Date.now() - dbStart;
    } catch (error) {
      status.status = 'error';
      status.services.database.status = 'error';
      status.services.database.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Check Redis
    try {
      const redisStart = Date.now();
      await this.redis.set('health:check', 'ok', 10);
      const result = await this.redis.get('health:check');
      if (result !== 'ok') {
        throw new Error('Redis read/write failed');
      }
      status.services.redis.latencyMs = Date.now() - redisStart;
    } catch (error) {
      status.status = 'error';
      status.services.redis.status = 'error';
      status.services.redis.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return status;
  }

  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Liveness probe - checks if the service is running' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  live(): { status: 'ok'; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness probe - checks if the service is ready to accept traffic' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async ready(): Promise<{ status: 'ok' | 'error'; checks: Record<string, boolean> }> {
    const checks: Record<string, boolean> = {
      database: false,
      redis: false,
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }

    try {
      await this.redis.set('ready:check', 'ok', 10);
      checks.redis = true;
    } catch {
      checks.redis = false;
    }

    const allReady = Object.values(checks).every((v) => v);

    return {
      status: allReady ? 'ok' : 'error',
      checks,
    };
  }
}
