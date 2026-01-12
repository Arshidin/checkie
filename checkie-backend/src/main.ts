import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  logger.log('Starting application...');
  logger.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  logger.log(`PORT: ${process.env.PORT}`);
  logger.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'set' : 'NOT SET'}`);
  logger.log(`REDIS_URL: ${process.env.REDIS_URL ? 'set' : 'NOT SET'}`);
  logger.log(`JWT_SECRET: ${process.env.JWT_SECRET ? 'set' : 'NOT SET'}`);
  logger.log(`ENCRYPTION_KEY length: ${process.env.ENCRYPTION_KEY?.length || 0}`);
  logger.log(`ALLOWED_ORIGINS: ${process.env.ALLOWED_ORIGINS}`);

  try {
    const app = await NestFactory.create(AppModule, {
      rawBody: true,
    });

  // Security
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global interceptors
  app.useGlobalInterceptors(new TransformInterceptor());

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Checkie API')
    .setDescription('Hosted Checkout Page Platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('stores', 'Store management')
    .addTag('pages', 'Checkout pages')
    .addTag('payments', 'Payment processing')
    .addTag('subscriptions', 'Subscription management')
    .addTag('balance', 'Balance & transactions')
    .addTag('webhooks', 'Webhook management')
    .addTag('widget', 'Public widget API')
    .addTag('portal', 'Customer portal')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
  } catch (error) {
    logger.error('Failed to start application:', error);
    throw error;
  }
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
