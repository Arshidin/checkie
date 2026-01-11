/**
 * Central module exports for Checkie Backend
 * Import modules from here for cleaner imports:
 *
 * @example
 * import { AuthModule, UsersModule, PaymentsService } from '../modules';
 */

// Phase 1: Foundation
export * from './auth';
export * from './users';
export * from './stores';
export * from './redis';

// Phase 2: Pages & Configuration
export * from './pages';
export * from './coupons';

// Phase 3: Checkout
export * from './checkout';

// Phase 4: Payments & PSP
export * from './providers';
export * from './payments';
export * from './balance';

// Phase 5: Subscriptions
export * from './subscriptions';

// Phase 6: Refunds & Payouts
export * from './refunds';
export * from './payouts';

// Phase 7: Webhooks
export * from './webhooks';

// Phase 8: Widget & Customer Portal
export * from './widget';
export * from './customers';

// Future phases (uncomment when implemented):
// export * from './notifications';
