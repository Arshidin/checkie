import { ConfigService } from '@nestjs/config';

export function createMockConfigService(
  overrides: Record<string, any> = {},
): Partial<ConfigService> {
  const defaultConfig: Record<string, any> = {
    'jwt.expiration': '15m',
    'jwt.refreshTokenExpiration': '7d',
    'jwt.secret': 'test-jwt-secret',
    'platform.feePercent': 0.029,
    'stripe.secretKey': 'sk_test_mock',
    'stripe.webhookSecret': 'whsec_test_mock',
    'app.url': 'http://localhost:3000',
    'widget.url': 'http://localhost:3001',
    PLATFORM_FEE_PERCENT: 0.029,
    ...overrides,
  };

  return {
    get: jest.fn((key: string, defaultValue?: any) => {
      return defaultConfig[key] ?? defaultValue;
    }),
    getOrThrow: jest.fn((key: string) => {
      const value = defaultConfig[key];
      if (value === undefined) {
        throw new Error(`Config key "${key}" not found`);
      }
      return value;
    }),
  };
}
