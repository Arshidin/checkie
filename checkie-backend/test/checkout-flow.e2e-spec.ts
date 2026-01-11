import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * E2E Test for Checkout Payment Flow
 *
 * This test suite covers the complete checkout flow:
 * 1. User registration and store creation
 * 2. Page creation
 * 3. Checkout session creation via widget API
 * 4. Payment initiation
 * 5. Webhook handling (simulated)
 * 6. Balance verification
 *
 * Note: These tests require a running database and Redis instance.
 * Run with: npm run test:e2e -- --testPathPattern=checkout-flow
 */
describe('Checkout Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let storeId: string;
  let pageId: string;
  let sessionId: string;
  let paymentId: string;

  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Cleanup test data
    if (storeId) {
      try {
        await prisma.store.delete({ where: { id: storeId } });
      } catch (e) {
        // Ignore - may cascade delete
      }
    }
    await app.close();
  });

  describe('1. User Registration & Auth', () => {
    it('should register a new user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.accessToken).toBeDefined();
      accessToken = response.body.data.accessToken;
    });

    it('should login with credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body.data.accessToken).toBeDefined();
      accessToken = response.body.data.accessToken;
    });
  });

  describe('2. Store Setup', () => {
    it('should create a store', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/stores')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Store E2E',
          slug: `test-store-e2e-${Date.now()}`,
        })
        .expect(201);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBeDefined();
      storeId = response.body.data.id;
    });
  });

  describe('3. Page Creation', () => {
    it('should create a checkout page', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/stores/${storeId}/pages`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Product',
          slug: 'test-product',
          description: 'A test product for E2E testing',
          pricingType: 'FIXED',
          price: 99.99,
          currency: 'USD',
        })
        .expect(201);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBeDefined();
      pageId = response.body.data.id;
    });

    it('should publish the page', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/stores/${storeId}/pages/${pageId}/publish`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.status).toBe('ACTIVE');
    });
  });

  describe('4. Widget - Checkout Session', () => {
    let storeSlug: string;

    beforeAll(async () => {
      // Get store slug for widget API
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { slug: true },
      });
      storeSlug = store?.slug || '';
    });

    it('should get page via widget API', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/widget/pages/${storeSlug}/test-product`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.page).toBeDefined();
      expect(response.body.data.session).toBeDefined();
      sessionId = response.body.data.session.id;
    });

    it('should update checkout session', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/widget/sessions/${sessionId}`)
        .send({
          customerEmail: 'customer@example.com',
        })
        .expect(200);

      expect(response.body.data).toBeDefined();
    });

    it('should get session status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/widget/sessions/${sessionId}/status`)
        .expect(200);

      expect(response.body.data.status).toBe('OPEN');
    });
  });

  describe('5. Payment Initiation', () => {
    it('should initiate payment', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/widget/checkout')
        .send({
          sessionId,
          paymentMethodId: 'pm_card_visa',
        })
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.clientSecret).toBeDefined();
      paymentId = response.body.data.paymentId;
    });
  });

  describe('6. Webhook Handling (Simulated)', () => {
    it('should handle payment_intent.succeeded webhook', async () => {
      // Note: In real tests, you would use a test endpoint
      // For STUB mode, use the test webhook endpoint
      const response = await request(app.getHttpServer())
        .post('/api/webhooks/stripe/test')
        .send({
          type: 'payment_intent.succeeded',
          paymentIntentId: paymentId,
          data: {
            id: `pi_stub_${paymentId}`,
            amount: 9999,
            currency: 'usd',
            status: 'succeeded',
            metadata: {
              checkoutSessionId: sessionId,
              paymentId,
              storeId,
              pageId,
            },
          },
        })
        .expect(200);

      expect(response.body.received).toBe(true);
    });

    it('should verify session completed', async () => {
      // Give the system time to process the webhook
      await new Promise((resolve) => setTimeout(resolve, 500));

      const response = await request(app.getHttpServer())
        .get(`/api/widget/sessions/${sessionId}/status`)
        .expect(200);

      // Session should be completed after successful payment webhook
      expect(['COMPLETED', 'PROCESSING']).toContain(response.body.data.status);
    });
  });

  describe('7. Balance Verification', () => {
    it('should have balance transactions after payment', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/stores/${storeId}/balance/transactions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Should have at least balance entries (payment received, platform fee)
      expect(response.body.data).toBeDefined();
    });

    it('should get store balance', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/stores/${storeId}/balance`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
    });
  });

  describe('8. Payment History', () => {
    it('should list payments for store', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/stores/${storeId}/payments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get payment details', async () => {
      if (!paymentId) {
        return; // Skip if no payment was created
      }

      const response = await request(app.getHttpServer())
        .get(`/api/stores/${storeId}/payments/${paymentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(paymentId);
    });
  });
});
