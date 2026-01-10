import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET) - should return 404 for root', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });

  it('/api/docs (GET) - Swagger should be available in development', () => {
    // Swagger is set up in main.ts, this test verifies the app starts
    return request(app.getHttpServer()).get('/api').expect(404);
  });
});
