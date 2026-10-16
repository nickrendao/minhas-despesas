import 'dotenv/config'; // lê apps/api/.env (o npm roda os scripts dentro da pasta do app)
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { env } from './config/env';
import { setupApp } from './setup-app';

async function bootstrap() {
  const config = env(); // falha cedo, com mensagem clara, se o .env estiver errado
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  setupApp(app);
  if (config.NODE_ENV !== 'production') {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Minhas Despesas API').setVersion('1.0').addBearerAuth().build());
    SwaggerModule.setup('api/docs', app, doc);
  }
  app.enableShutdownHooks();
  await app.listen(config.PORT, '0.0.0.0');
}
bootstrap();
