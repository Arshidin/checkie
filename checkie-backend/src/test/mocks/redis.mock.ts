import { RedisService } from '../../modules/redis/redis.service';

export function createMockRedisService(): Partial<RedisService> {
  const store = new Map<string, string>();

  return {
    get: jest.fn((key: string) => Promise.resolve(store.get(key) || null)),
    set: jest.fn((key: string, value: string, _ttl?: number) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    del: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    keys: jest.fn((pattern: string) => {
      const keys = Array.from(store.keys()).filter((k) => k.includes(pattern.replace('*', '')));
      return Promise.resolve(keys);
    }),
    exists: jest.fn((key: string) => Promise.resolve(store.has(key))),
    ttl: jest.fn((_key: string) => Promise.resolve(-1)),
    expire: jest.fn((_key: string, _seconds: number) => Promise.resolve()),
    incr: jest.fn((key: string) => {
      const val = parseInt(store.get(key) || '0', 10) + 1;
      store.set(key, String(val));
      return Promise.resolve(val);
    }),
    hset: jest.fn(),
    hget: jest.fn(),
    hgetall: jest.fn(),
  };
}
