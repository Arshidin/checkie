// Parse Redis URL to extract host, port, password
function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisParsed = parseRedisUrl(redisUrl);

export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    widgetUrl: process.env.WIDGET_URL || 'http://localhost:3001',
    apiUrl: process.env.API_URL || 'http://localhost:3000/api',
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: redisUrl,
    host: process.env.REDIS_HOST || redisParsed.host,
    port: parseInt(process.env.REDIS_PORT || String(redisParsed.port), 10),
    password: process.env.REDIS_PASSWORD || redisParsed.password,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiration: process.env.JWT_EXPIRATION || '15m',
    refreshTokenExpiration: process.env.REFRESH_TOKEN_EXPIRATION || '7d',
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY,
    ivLength: parseInt(process.env.ENCRYPTION_IV_LENGTH || '16', 10),
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  platform: {
    feePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT || '0.029'),
  },
});
