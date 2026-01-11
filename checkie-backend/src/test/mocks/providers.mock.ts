import { ProviderFactory } from '../../modules/providers/provider.factory';
import {
  PaymentProvider,
  PaymentIntentResult,
  RefundResult,
} from '../../modules/providers/interfaces/payment-provider.interface';

export function createMockPaymentProvider(): PaymentProvider {
  return {
    code: 'stripe',
    createPaymentIntent: jest.fn().mockResolvedValue({
      id: 'pi_test_123',
      clientSecret: 'pi_test_123_secret',
      status: 'requires_payment_method',
      amount: 100,
      currency: 'USD',
      requiresAction: false,
    } as PaymentIntentResult),
    retrievePaymentIntent: jest.fn().mockResolvedValue({
      id: 'pi_test_123',
      clientSecret: 'pi_test_123_secret',
      status: 'succeeded',
      amount: 100,
      currency: 'USD',
      requiresAction: false,
    } as PaymentIntentResult),
    confirmPaymentIntent: jest.fn().mockResolvedValue({
      id: 'pi_test_123',
      clientSecret: 'pi_test_123_secret',
      status: 'succeeded',
      amount: 100,
      currency: 'USD',
      requiresAction: false,
    } as PaymentIntentResult),
    cancelPaymentIntent: jest.fn().mockResolvedValue(undefined),
    createRefund: jest.fn().mockResolvedValue({
      id: 're_test_123',
      status: 'succeeded',
      amount: 50,
      currency: 'USD',
    } as RefundResult),
    createCustomer: jest.fn().mockResolvedValue('cus_test_123'),
    constructWebhookEvent: jest.fn().mockReturnValue({
      type: 'payment_intent.succeeded',
      id: 'evt_test_123',
      data: {},
      metadata: {},
    }),
    createSubscription: jest.fn().mockResolvedValue({
      id: 'sub_test_123',
      status: 'active',
      customerId: 'cus_test_123',
      clientSecret: 'sub_test_123_secret',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    }),
    retrieveSubscription: jest.fn().mockResolvedValue({
      id: 'sub_test_123',
      status: 'active',
      customerId: 'cus_test_123',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    }),
    updateSubscription: jest.fn().mockResolvedValue({
      id: 'sub_test_123',
      status: 'active',
      customerId: 'cus_test_123',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    }),
    cancelSubscription: jest.fn().mockResolvedValue({
      id: 'sub_test_123',
      status: 'canceled',
      customerId: 'cus_test_123',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    }),
    pauseSubscription: jest.fn().mockResolvedValue({
      id: 'sub_test_123',
      status: 'paused',
      customerId: 'cus_test_123',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    }),
    resumeSubscription: jest.fn().mockResolvedValue({
      id: 'sub_test_123',
      status: 'active',
      customerId: 'cus_test_123',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    }),
  };
}

export function createMockProviderFactory(provider?: PaymentProvider): Partial<ProviderFactory> {
  const mockProvider = provider || createMockPaymentProvider();
  return {
    getProvider: jest.fn().mockReturnValue(mockProvider),
    getDefaultProvider: jest.fn().mockReturnValue(mockProvider),
    listProviders: jest.fn().mockReturnValue(['stripe']),
  };
}
