import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConsoleMailer, Mailer } from '../src/auth/mailer';
import { PriceProvider, CoinPrice } from '../src/crypto/price.provider';

export class FakePrices extends PriceProvider {
  table: Record<string, CoinPrice> = {};
  fail = false;
  async getBrlPrices(ids: string[]) {
    if (this.fail) return {};
    return Object.fromEntries(ids.filter((i) => this.table[i]).map((i) => [i, this.table[i]]));
  }
}

export async function createTestApp() {
  const prices = new FakePrices();
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PriceProvider).useValue(prices).compile();
  const app = mod.createNestApplication<NestExpressApplication>();
  setupApp(app);
  await app.init();
  const http = () => request(app.getHttpServer());
  const prisma = app.get(PrismaService);
  const mailer = app.get(Mailer) as ConsoleMailer;
  return { app, http, prisma, mailer, prices };
}
export type TestCtx = Awaited<ReturnType<typeof createTestApp>>;

export const PASSWORD = 'Senha-Forte-123';

/** Cadastra, confirma o e-mail pelo link "enviado" e faz login. Retorna os tokens. */
export async function signup(ctx: TestCtx, email: string, password = PASSWORD) {
  await ctx.http().post('/api/v1/auth/register').send({ email, password }).expect(201);
  const mail = [...ctx.mailer.sent].reverse().find((m) => m.to === email && m.subject.includes('Confirme'))!;
  const token = /token=([\w-]+)/.exec(mail.text)![1];
  await ctx.http().post('/api/v1/auth/verify-email').send({ token }).expect(204);
  const res = await ctx.http().post('/api/v1/auth/login').send({ email, password }).expect(200);
  return res.body.data as { accessToken: string; refreshToken: string };
}

export const authed = (ctx: TestCtx, accessToken: string) => ({
  get: (u: string) => ctx.http().get('/api/v1' + u).set('Authorization', `Bearer ${accessToken}`),
  post: (u: string, b?: unknown) => ctx.http().post('/api/v1' + u).set('Authorization', `Bearer ${accessToken}`).send(b as any),
  patch: (u: string, b?: unknown) => ctx.http().patch('/api/v1' + u).set('Authorization', `Bearer ${accessToken}`).send(b as any),
  put: (u: string, b?: unknown) => ctx.http().put('/api/v1' + u).set('Authorization', `Bearer ${accessToken}`).send(b as any),
  del: (u: string) => ctx.http().delete('/api/v1' + u).set('Authorization', `Bearer ${accessToken}`),
});
