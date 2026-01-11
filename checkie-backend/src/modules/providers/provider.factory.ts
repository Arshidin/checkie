import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentProvider } from './interfaces/payment-provider.interface';
import { StripeProvider } from './stripe/stripe.provider';

@Injectable()
export class ProviderFactory {
  private readonly providers: Map<string, PaymentProvider>;

  constructor(private readonly stripeProvider: StripeProvider) {
    this.providers = new Map([['stripe', stripeProvider]]);
  }

  getProvider(code: string): PaymentProvider {
    const provider = this.providers.get(code.toLowerCase());
    if (!provider) {
      throw new NotFoundException(`Payment provider '${code}' not found`);
    }
    return provider;
  }

  getDefaultProvider(): PaymentProvider {
    return this.stripeProvider;
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
