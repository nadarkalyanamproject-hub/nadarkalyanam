import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { parseCorsOrigins } from './common/cors-origins.js';
import type { Env } from './modules/config/env.schema.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const configService = app.get(ConfigService<Env, true>);
  const proxyHops =
    configService.get('TRUST_PROXY_HOPS', { infer: true }) ??
    (configService.get('NODE_ENV', { infer: true }) === 'production' ? 1 : 0);
  app.getHttpAdapter().getInstance().set('trust proxy', proxyHops);
  app.enableCors({ origin: parseCorsOrigins(configService.get('CORS_ORIGIN', { infer: true })) });

  const port = configService.get('PORT', { infer: true });
  // Explicit 0.0.0.0: the default bind (no host arg) works locally, but
  // Render's proxy/health-check traffic needs the process listening on all
  // interfaces, not just loopback.
  await app.listen(port, '0.0.0.0');
}

await bootstrap();
