import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { env } from './config/env';

/** Configuração HTTP compartilhada entre produção e testes (para testar exatamente o que roda em produção). */
export function setupApp(app: INestApplication) {
  const express = app as NestExpressApplication;
  express.set('trust proxy', env().TRUST_PROXY); // atrás do proxy da hospedagem: IP real para o rate limit
  express.disable('x-powered-by');
  app.use(helmet());
  app.setGlobalPrefix('api/v1');
  const origins = env().CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({ origin: origins, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'], maxAge: 600 });
}
