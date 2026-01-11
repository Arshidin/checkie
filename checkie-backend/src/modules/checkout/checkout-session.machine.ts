import { createMachine, assign } from 'xstate';

export interface PaymentAttemptInfo {
  id: string;
  attemptNumber: number;
  status: string;
  failureCode?: string;
  failureMessage?: string;
  requires3DS?: boolean;
  redirectUrl?: string;
}

export interface CheckoutSessionContext {
  sessionId: string;
  storeId: string;
  pageId: string;
  customerId: string | null;
  customerEmail: string | null;
  amount: number;
  currency: string;
  selectedVariants: Record<string, string>;
  customFieldValues: Record<string, string>;
  couponId: string | null;
  discountAmount: number;
  paymentId: string | null;
  attempts: PaymentAttemptInfo[];
  error: string | null;
  redirectUrl: string | null;
  expiresAt: number;
}

export type CheckoutSessionEvent =
  | { type: 'UPDATE_SESSION'; data: Partial<CheckoutSessionContext> }
  | { type: 'INITIATE_PAYMENT'; paymentMethodId: string }
  | { type: 'PAYMENT_SUCCEEDED'; providerPaymentId: string; amount: number; providerData?: any }
  | { type: 'PAYMENT_FAILED'; failureCode: string; failureMessage: string }
  | { type: 'REQUIRES_ACTION'; actionType: string; redirectUrl: string }
  | { type: 'ACTION_COMPLETED'; threeDSResult?: string }
  | { type: 'ACTION_FAILED'; failureReason: string }
  | { type: 'TIMEOUT' }
  | { type: 'ABANDON'; reason?: string }
  | { type: 'CANCEL' };

const MAX_ATTEMPTS = 3;
const SESSION_TTL_MS = 60 * 60 * 1000; // 60 minutes
// Timeouts are exported for use in services that manage timeout jobs
export const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const ACTION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export const checkoutSessionMachine = createMachine(
  {
    id: 'checkoutSession',
    initial: 'open',
    types: {} as {
      context: CheckoutSessionContext;
      events: CheckoutSessionEvent;
    },
    context: {
      sessionId: '',
      storeId: '',
      pageId: '',
      customerId: null,
      customerEmail: null,
      amount: 0,
      currency: 'USD',
      selectedVariants: {},
      customFieldValues: {},
      couponId: null,
      discountAmount: 0,
      paymentId: null,
      attempts: [],
      error: null,
      redirectUrl: null,
      expiresAt: Date.now() + SESSION_TTL_MS,
    },
    states: {
      open: {
        on: {
          UPDATE_SESSION: {
            target: 'open',
            actions: 'updateSessionData',
          },
          INITIATE_PAYMENT: [
            {
              target: 'processing',
              guard: 'isValidForPayment',
            },
            {
              target: 'open',
              actions: 'setValidationError',
            },
          ],
          TIMEOUT: {
            target: 'expired',
          },
          ABANDON: {
            target: 'abandoned',
          },
          CANCEL: {
            target: 'abandoned',
          },
        },
      },
      processing: {
        on: {
          PAYMENT_SUCCEEDED: [
            {
              target: 'completed',
              guard: 'isAmountValid',
            },
            {
              target: 'open',
              actions: 'setAmountMismatchError',
            },
          ],
          PAYMENT_FAILED: [
            {
              target: 'open',
              guard: 'canRetry',
              actions: 'recordFailure',
            },
            {
              target: 'expired',
              actions: 'recordFailure',
            },
          ],
          REQUIRES_ACTION: {
            target: 'awaiting_action',
            actions: 'storeActionDetails',
          },
          TIMEOUT: {
            target: 'expired',
          },
        },
      },
      awaiting_action: {
        on: {
          ACTION_COMPLETED: {
            target: 'processing',
            actions: 'clearActionDetails',
          },
          ACTION_FAILED: [
            {
              target: 'open',
              guard: 'canRetry',
              actions: 'recordActionFailure',
            },
            {
              target: 'expired',
              actions: 'recordActionFailure',
            },
          ],
          TIMEOUT: {
            target: 'expired',
          },
          ABANDON: {
            target: 'abandoned',
          },
        },
      },
      completed: {
        type: 'final',
      },
      expired: {
        type: 'final',
      },
      abandoned: {
        type: 'final',
      },
    },
  },
  {
    guards: {
      isValidForPayment: ({ context }) => {
        if (!context.customerEmail && !context.customerId) {
          return false;
        }
        if (!context.amount || context.amount <= 0) {
          return false;
        }
        if (Date.now() > context.expiresAt) {
          return false;
        }
        return true;
      },
      canRetry: ({ context }) => {
        if (context.attempts.length >= MAX_ATTEMPTS) {
          return false;
        }
        if (Date.now() > context.expiresAt) {
          return false;
        }
        const lastAttempt = context.attempts[context.attempts.length - 1];
        if (lastAttempt) {
          const nonRetryableCodes = ['card_declined_fraud', 'stolen_card', 'lost_card'];
          if (nonRetryableCodes.includes(lastAttempt.failureCode || '')) {
            return false;
          }
        }
        return true;
      },
      isAmountValid: ({ context, event }) => {
        if (event.type !== 'PAYMENT_SUCCEEDED') return false;
        const tolerance = 0.01;
        return Math.abs(context.amount - event.amount) <= tolerance;
      },
    },
    actions: {
      updateSessionData: assign(({ context, event }) => {
        if (event.type !== 'UPDATE_SESSION') return context;
        return { ...context, ...event.data, error: null };
      }),
      setValidationError: assign({
        error: 'Validation failed: missing required fields or session expired',
      }),
      setAmountMismatchError: assign({
        error: 'Amount mismatch between session and payment',
      }),
      recordFailure: assign(({ context, event }) => {
        if (event.type !== 'PAYMENT_FAILED') return context;
        const newAttempt: PaymentAttemptInfo = {
          id: `attempt_${context.attempts.length + 1}`,
          attemptNumber: context.attempts.length + 1,
          status: 'FAILED',
          failureCode: event.failureCode,
          failureMessage: event.failureMessage,
        };
        return {
          ...context,
          attempts: [...context.attempts, newAttempt],
          error: event.failureMessage,
        };
      }),
      recordActionFailure: assign(({ context, event }) => {
        if (event.type !== 'ACTION_FAILED') return context;
        const newAttempt: PaymentAttemptInfo = {
          id: `attempt_${context.attempts.length + 1}`,
          attemptNumber: context.attempts.length + 1,
          status: 'FAILED',
          failureCode: 'action_failed',
          failureMessage: event.failureReason,
        };
        return {
          ...context,
          attempts: [...context.attempts, newAttempt],
          error: event.failureReason,
          redirectUrl: null,
        };
      }),
      storeActionDetails: assign(({ context, event }) => {
        if (event.type !== 'REQUIRES_ACTION') return context;
        return {
          ...context,
          redirectUrl: event.redirectUrl,
        };
      }),
      clearActionDetails: assign({
        redirectUrl: null,
      }),
    },
  },
);

export type CheckoutSessionMachine = typeof checkoutSessionMachine;
export type CheckoutSessionState =
  | 'open'
  | 'processing'
  | 'awaiting_action'
  | 'completed'
  | 'expired'
  | 'abandoned';
