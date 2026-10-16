import { authed, createTestApp, signup, TestCtx } from './helpers';

describe('Cripto (cotações no servidor)', () => {
  let ctx: TestCtx; let A: ReturnType<typeof authed>;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await ctx.prisma.user.deleteMany(); ctx.prices.fail = false; ctx.prices.table = {}; A = authed(ctx, (await signup(ctx, 'a@teste.com')).accessToken); });

  it('REGRESSÃO do bug real: adicionar moeda vazia (qtd 0, preço 0) funciona e a valoração não quebra', async () => {
    ctx.prices.table = { bitcoin: { brl: 300000, change24h: 1.5 } };
    await A.post('/crypto-holdings', {}).expect(201);                        // posição "em branco", como o botão + do site
    await A.post('/crypto-holdings', { coinId: 'bitcoin' }).expect(201);     // moeda escolhida, qtd 0, preço 0
    const v = (await A.get('/crypto-holdings/valuation').expect(200)).body.data;
    expect(v.items).toHaveLength(2);
    expect(v.items[1]).toMatchObject({ priceAvailable: true, investedCents: 0, currentValueCents: 0, gainPercent: null });
  });
  it('valoração com cotação: investido, valor atual, rendimento e totais', async () => {
    ctx.prices.table = { bitcoin: { brl: 250000, change24h: -2.25 }, ethereum: { brl: 10000, change24h: 0.5 } };
    await A.post('/crypto-holdings', { coinId: 'bitcoin', quantity: '0.5', buyPriceCents: 20000000 }).expect(201);
    await A.post('/crypto-holdings', { coinId: 'ethereum', quantity: '2', buyPriceCents: 1200000 }).expect(201);
    const v = (await A.get('/crypto-holdings/valuation').expect(200)).body.data;
    expect(v.items[0]).toMatchObject({ coinId: 'bitcoin', quantity: '0.5', currentPriceCents: 25000000, change24hPercent: -2.25, investedCents: 10000000, currentValueCents: 12500000, gainCents: 2500000, gainPercent: 25 });
    expect(v.items[1]).toMatchObject({ investedCents: 2400000, currentValueCents: 2000000, gainCents: -400000, gainPercent: -16.67 });
    expect(v.totals).toMatchObject({ pricedCount: 2, investedCents: 12400000, currentValueCents: 14500000, gainCents: 2100000, gainPercent: 16.94 });
  });
  it('se o provedor de cotação cair, a API continua respondendo (sem 500) e marca "sem cotação"', async () => {
    await A.post('/crypto-holdings', { coinId: 'bitcoin', quantity: '1', buyPriceCents: 100 }).expect(201);
    ctx.prices.fail = true;
    const v = (await A.get('/crypto-holdings/valuation').expect(200)).body.data;
    expect(v.items[0]).toMatchObject({ priceAvailable: false, currentValueCents: null, gainCents: null, investedCents: 100 });
    expect(v.totals).toMatchObject({ pricedCount: 0, gainPercent: null });
  });
  it('rejeita moeda fora da lista e quantidade inválida', async () => {
    await A.post('/crypto-holdings', { coinId: 'dinheiro-do-monopoly' }).expect(400);
    await A.post('/crypto-holdings', { quantity: '-1' }).expect(400);
    await A.post('/crypto-holdings', { quantity: '1e5' }).expect(400);
    await A.post('/crypto-holdings', { quantity: 0.1 }).expect(400);          // quantidade só como string decimal
  });
  it('quantidade fracionária preserva precisão de 12 casas', async () => {
    const r = (await A.post('/crypto-holdings', { coinId: 'bitcoin', quantity: '0.000000000123' }).expect(201)).body.data;
    expect(r.quantity).toBe('0.000000000123');                                  // contrato: string decimal, NUNCA notação científica
    expect(r.quantity).toMatch(/^\d+(\.\d+)?$/);                                  // e deve ser aceitável de volta pela própria API
    await A.patch(`/crypto-holdings/${r.id}`, { quantity: r.quantity }).expect(200);
    const row = await ctx.prisma.cryptoHolding.findUniqueOrThrow({ where: { id: r.id } });
    expect(row.quantity.toFixed(12)).toBe('0.000000000123');
  });
});

describe('Segurança HTTP', () => {
  let ctx: TestCtx;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });

  it('cabeçalhos de segurança presentes e sem "X-Powered-By"', async () => {
    const r = await ctx.http().get('/api/v1/health').expect(200);
    expect(r.headers['x-powered-by']).toBeUndefined();
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['strict-transport-security']).toBeDefined();
    expect(r.body).toEqual({ data: { status: 'ok' } });
  });
  it('CORS só libera origens configuradas', async () => {
    const ok = await ctx.http().options('/api/v1/me').set('Origin', 'http://localhost:3000').set('Access-Control-Request-Method', 'GET');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    const bad = await ctx.http().options('/api/v1/me').set('Origin', 'http://site-malvado.com').set('Access-Control-Request-Method', 'GET');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('erros nunca vazam stack/SQL e seguem o formato padrão; JSON malformado => 400', async () => {
    const r = await ctx.http().post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"email": ').expect(400);
    expect(r.body.error).toBeDefined();
    expect(JSON.stringify(r.body)).not.toMatch(/at \w+|node_modules|SELECT|prisma/i);
    const nf = await ctx.http().get('/api/v1/rota-inexistente').expect(404);
    expect(nf.body.error.code).toBe('NOT_FOUND');
  });
  it('tentativa de SQL injection em busca é tratada como texto (e não executa)', async () => {
    const t = await signup(ctx, 'sqli@teste.com');
    const A = authed(ctx, t.accessToken);
    await A.post('/expenses', { ym: '2026-10', name: 'Normal', amountCents: 1 }).expect(201);
    const r = await A.get(`/expenses?q=${encodeURIComponent("'; DROP TABLE expenses; --")}`).expect(200);
    expect(r.body.data).toHaveLength(0);
    expect((await A.get('/expenses?ym=2026-10')).body.data).toHaveLength(1); // tabela segue viva
  });
  it('limitador de tentativas: login é bloqueado (429) após muitas tentativas seguidas', async () => {
    process.env.RATE_LIMIT_DISABLED = 'false';
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 14; i++) statuses.push((await ctx.http().post('/api/v1/auth/login').send({ email: 'alvo@teste.com', password: 'tentativa-errada' })).status);
      expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
      expect(statuses.slice(10).every((s) => s === 429)).toBe(true);
    } finally { process.env.RATE_LIMIT_DISABLED = 'true'; }
  });
});
