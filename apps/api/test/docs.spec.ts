import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createTestApp, TestCtx } from './helpers';

describe('Documentação OpenAPI', () => {
  let ctx: TestCtx;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });

  it('documenta as rotas e os corpos das requisições a partir dos schemas reais', () => {
    const doc = SwaggerModule.createDocument(ctx.app, new DocumentBuilder().setTitle('t').setVersion('1').addBearerAuth().build());
    const paths = Object.keys(doc.paths);
    for (const p of ['/api/v1/auth/login', '/api/v1/expenses', '/api/v1/incomes', '/api/v1/credit-cards', '/api/v1/reports/summary', '/api/v1/months/{ym}/open', '/api/v1/crypto-holdings/valuation']) {
      expect(paths).toContain(p);
    }
    const body: any = (doc.paths['/api/v1/expenses'] as any).post.requestBody.content['application/json'].schema;
    expect(body.properties.amountCents).toMatchObject({ type: 'integer', maximum: 2_000_000_000 });
    expect(body.required).toEqual(expect.arrayContaining(['ym', 'name']));
  });
});
