import { PrismaService } from '../../prisma/prisma.service';

export type MockPrismaService = {
  [K in keyof PrismaService]: K extends `$${string}`
    ? jest.Mock
    : {
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        findMany: jest.Mock;
        create: jest.Mock;
        update: jest.Mock;
        updateMany: jest.Mock;
        delete: jest.Mock;
        deleteMany: jest.Mock;
        count: jest.Mock;
        upsert: jest.Mock;
        aggregate: jest.Mock;
      };
};

export function createMockPrismaService(): MockPrismaService {
  const createModelMock = () => ({
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
    aggregate: jest.fn(),
  });

  return {
    user: createModelMock(),
    store: createModelMock(),
    storeUser: createModelMock(),
    page: createModelMock(),
    pageVariant: createModelMock(),
    variantOption: createModelMock(),
    pageCustomField: createModelMock(),
    pageEmbed: createModelMock(),
    pageStats: createModelMock(),
    customer: createModelMock(),
    checkoutSession: createModelMock(),
    payment: createModelMock(),
    paymentAttempt: createModelMock(),
    subscription: createModelMock(),
    refund: createModelMock(),
    balanceTransaction: createModelMock(),
    payout: createModelMock(),
    coupon: createModelMock(),
    webhookEndpoint: createModelMock(),
    webhookEvent: createModelMock(),
    webhookDelivery: createModelMock(),
    idempotencyKey: createModelMock(),
    customFieldValue: createModelMock(),
    customerPortalSession: createModelMock(),
    $transaction: jest.fn((callback) =>
      callback({
        balanceTransaction: createModelMock(),
        payment: createModelMock(),
        refund: createModelMock(),
        payout: createModelMock(),
        subscription: createModelMock(),
        checkoutSession: createModelMock(),
      }),
    ),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
  } as unknown as MockPrismaService;
}
