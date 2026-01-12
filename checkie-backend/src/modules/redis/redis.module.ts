import { Global, Module, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from './redis.service';
import { REDIS_CLIENT } from './redis.constants';

export { REDIS_CLIENT };

const logger = new Logger('RedisModule');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL;
        logger.log(`REDIS_URL env: ${redisUrl ? 'set' : 'not set'}`);

        if (!redisUrl) {
          logger.warn('REDIS_URL not set, using localhost fallback');
        }

        const url = redisUrl || 'redis://localhost:6379';

        // Log URL host for debugging (hide password)
        try {
          const parsed = new URL(url);
          logger.log(`Connecting to Redis at ${parsed.host}...`);
        } catch {
          logger.log(`Connecting to Redis with URL: ${url.substring(0, 20)}...`);
        }

        // Only use TLS for rediss:// protocol URLs
        // Railway public TCP proxy does NOT support TLS on redis:// URLs
        const useTls = url.startsWith('rediss://');
        return new Redis(url, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          ...(useTls && { tls: {} }),
        });
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
