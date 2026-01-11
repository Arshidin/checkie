import { Module, Global } from '@nestjs/common';
import { StripeProvider } from './stripe/stripe.provider';
import { ProviderFactory } from './provider.factory';

@Global()
@Module({
  providers: [StripeProvider, ProviderFactory],
  exports: [StripeProvider, ProviderFactory],
})
export class ProvidersModule {}
