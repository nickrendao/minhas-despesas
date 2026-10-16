import { authed, createTestApp, signup, TestCtx } from './helpers';

describe('Recursos: validação, limites e ISOLAMENTO entre usuários', () => {
  let ctx: TestCtx; let A: ReturnType<typeof authed>; let B: ReturnType<typeof authed>;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => {
    await ctx.prisma.user.deleteMany();
    A = authed(ctx, (await signup(ctx, 'a@teste.com')).accessToken);
    B = authed(ctx, (await signup(ctx, 'b@teste.com')).accessToken);
  });

  describe('despesas', () => {
    it('CRUD completo com dinheiro em centavos', async () => {
      const c = await A.post('/expenses', { ym: '2026-10', name: 'Aluguel', color: '#1F6F54', amountCents: 150050, recurring: true, dueDay: 5 }).expect(201);
      expect(c.body.data).toMatchObject({ name: 'Aluguel', amountCents: 150050, recurring: true, dueDay: 5, icon: 'receipt' });   // padrão novo: chave de ícone de linha (antes: emoji)
      const id = c.body.data.id;
      const u = await A.patch(`/expenses/${id}`, { amountCents: 160000, installmentCurrent: 2, installmentTotal: 12 }).expect(200);
      expect(u.body.data).toMatchObject({ amountCents: 160000, installmentCurrent: 2, installmentTotal: 12 });
      await A.del(`/expenses/${id}`).expect(204);
      await A.del(`/expenses/${id}`).expect(404);
    });
    it('rejeita valores inválidos: negativo, decimal (float), gigante, mês e cor ruins', async () => {
      const bad = async (b: any) => (await A.post('/expenses', { ym: '2026-10', name: 'x', color: '#000000', ...b }).expect(400)).body.error.code;
      expect(await bad({ amountCents: -1 })).toBe('VALIDATION_ERROR');
      expect(await bad({ amountCents: 10.5 })).toBe('VALIDATION_ERROR');       // float proibido
      expect(await bad({ amountCents: 2_000_000_001 })).toBe('VALIDATION_ERROR');
      expect(await bad({ ym: '2026-13' })).toBe('VALIDATION_ERROR');
      expect(await bad({ color: 'vermelho' })).toBe('VALIDATION_ERROR');
      expect(await bad({ name: '   ' })).toBe('VALIDATION_ERROR');
      expect(await bad({ dueDay: 32 })).toBe('VALIDATION_ERROR');
      expect(await bad({ installmentCurrent: 5, installmentTotal: 3 })).toBe('VALIDATION_ERROR');
    });
    it('atualização parcial valida a combinação com o que já estava salvo (parcela)', async () => {
      const id = (await A.post('/expenses', { ym: '2026-10', name: 'TV', amountCents: 100, installmentCurrent: 1, installmentTotal: 3 }).expect(201)).body.data.id;
      const r = await A.patch(`/expenses/${id}`, { installmentCurrent: 9 }).expect(400); // 9 > total 3 já salvo
      expect(r.body.error.code).toBe('VALIDATION_ERROR');
    });
    it('rejeita campos desconhecidos no PATCH (impede mass assignment, ex.: trocar userId)', async () => {
      const id = (await A.post('/expenses', { ym: '2026-10', name: 'x', amountCents: 1 }).expect(201)).body.data.id;
      await A.patch(`/expenses/${id}`, { userId: '00000000-0000-0000-0000-000000000000' }).expect(400);
      await A.patch(`/expenses/${id}`, { ym: '2030-01' }).expect(400);
    });
    it('cor padrão vem da paleta quando não informada', async () => {
      const r = await A.post('/expenses', { ym: '2026-10', name: 'x', amountCents: 1 }).expect(201);
      expect(r.body.data.color).toMatch(/^#[0-9A-F]{6}$/i);
    });
    it('lista com filtro fixa/variável, busca por nome e paginação; busca sem mês varre todos', async () => {
      for (const [ym, name, rec] of [['2026-09', 'Mercado', false], ['2026-10', 'Mercado Extra', false], ['2026-10', 'Aluguel', true], ['2026-10', 'Internet', true]] as const) {
        await A.post('/expenses', { ym, name, amountCents: 100, recurring: rec }).expect(201);
      }
      expect((await A.get('/expenses?ym=2026-10&type=fixed').expect(200)).body.data.map((e: any) => e.name).sort()).toEqual(['Aluguel', 'Internet']);
      expect((await A.get('/expenses?ym=2026-10&type=variable').expect(200)).body.data).toHaveLength(1);
      expect((await A.get('/expenses?q=mercado').expect(200)).body.data).toHaveLength(2); // acha em 2 meses, sem diferenciar maiúscula
      const p = await A.get('/expenses?ym=2026-10&limit=2&page=2').expect(200);
      expect(p.body.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
      expect(p.body.data).toHaveLength(1);
    });
  });

  describe('rendas', () => {
    it('limite de 3 por mês — inclusive sob requisições SIMULTÂNEAS (sem corrida)', async () => {
      const results = await Promise.all(Array.from({ length: 8 }, (_, i) => A.post('/incomes', { ym: '2026-10', name: `R${i}`, amountCents: 100 })));
      expect(results.filter((r) => r.status === 201)).toHaveLength(3);
      expect(results.filter((r) => r.status === 409).every((r) => r.body.error.code === 'LIMIT_REACHED')).toBe(true);
      expect(await ctx.prisma.income.count({ where: { ym: '2026-10' } })).toBe(3);
      await A.post('/incomes', { ym: '2026-11', name: 'Outro mês', amountCents: 100 }).expect(201); // limite é por mês
    });
  });

  describe('ISOLAMENTO: o usuário B nunca enxerga nem altera dados do usuário A', () => {
    it('despesa, renda, cartão, compra, investimento e cripto => 404 (e nada muda)', async () => {
      const exp = (await A.post('/expenses', { ym: '2026-10', name: 'Segredo', amountCents: 999 }).expect(201)).body.data.id;
      const inc = (await A.post('/incomes', { ym: '2026-10', name: 'Salário', amountCents: 500000 }).expect(201)).body.data.id;
      const card = (await A.post('/credit-cards', { name: 'Visa', limitCents: 100000 }).expect(201)).body.data.id;
      const pur = (await A.post(`/credit-cards/${card}/purchases`, { name: 'TV', amountCents: 5000 }).expect(201)).body.data.id;
      const inv = (await A.post('/investments', { name: 'CDB' }).expect(201)).body.data.id;
      const cry = (await A.post('/crypto-holdings', { coinId: 'bitcoin', quantity: '1' }).expect(201)).body.data.id;

      await B.patch(`/expenses/${exp}`, { name: 'hack' }).expect(404);
      await B.del(`/expenses/${exp}`).expect(404);
      await B.patch(`/incomes/${inc}`, { amountCents: 1 }).expect(404);
      await B.del(`/incomes/${inc}`).expect(404);
      await B.get(`/credit-cards/${card}`).expect(404);
      await B.patch(`/credit-cards/${card}`, { name: 'hack' }).expect(404);
      await B.post(`/credit-cards/${card}/purchases`, { name: 'inj', amountCents: 1 }).expect(404);
      await B.del(`/credit-cards/${card}/purchases/${pur}`).expect(404);
      await B.del(`/credit-cards/${card}`).expect(404);
      await B.patch(`/investments/${inv}`, { name: 'hack' }).expect(404);
      await B.del(`/investments/${inv}`).expect(404);
      await B.patch(`/crypto-holdings/${cry}`, { quantity: '999' }).expect(404);
      await B.del(`/crypto-holdings/${cry}`).expect(404);

      // listagens do B vêm vazias
      expect((await B.get('/expenses?ym=2026-10').expect(200)).body.data).toHaveLength(0);
      expect((await B.get('/expenses?q=Segredo').expect(200)).body.data).toHaveLength(0);
      expect((await B.get('/incomes?ym=2026-10').expect(200)).body.data).toHaveLength(0);
      expect((await B.get('/credit-cards').expect(200)).body.data).toHaveLength(0);
      expect((await B.get('/investments').expect(200)).body.data).toHaveLength(0);
      expect((await B.get('/reports/summary?ym=2026-10').expect(200)).body.data.expensesCents).toBe(0);

      // tudo do A continua intacto
      expect((await A.get('/expenses?ym=2026-10').expect(200)).body.data[0].name).toBe('Segredo');
      expect((await A.get(`/credit-cards/${card}`).expect(200)).body.data.purchases).toHaveLength(1);
    });
    it('não dá para criar compra em cartão de outro usuário nem forjar userId no corpo', async () => {
      const card = (await A.post('/credit-cards', { name: 'Visa' }).expect(201)).body.data.id;
      await B.post(`/credit-cards/${card}/purchases`, { name: 'x', amountCents: 5, userId: 'qualquer' }).expect(404);
      const r = await B.post('/expenses', { ym: '2026-10', name: 'mine', amountCents: 1, userId: (await A.get('/me')).body.data.id });
      // campo extra é ignorado pela criação: o dono é SEMPRE quem tem o token
      const own = await ctx.prisma.expense.findFirstOrThrow({ where: { name: 'mine' } });
      const bId = (await B.get('/me')).body.data.id;
      expect(own.userId).toBe(bId);
      expect(r.status).toBe(201);
    });
  });

  describe('cartões', () => {
    it('limite de 5 cartões (com corrida), uso/alerta calculados no servidor', async () => {
      const results = await Promise.all(Array.from({ length: 8 }, (_, i) => A.post('/credit-cards', { name: `C${i}`, limitCents: 100000 })));
      expect(results.filter((r) => r.status === 201)).toHaveLength(5);
      expect(await ctx.prisma.creditCard.count()).toBe(5);
    });
    it('uso, disponível, alerta de 80% e exclusão em cascata', async () => {
      const card = (await A.post('/credit-cards', { name: 'Nubank', limitCents: 100000 }).expect(201)).body.data.id;
      await A.post(`/credit-cards/${card}/purchases`, { name: 'Mercado', amountCents: 50000 }).expect(201);
      let c = (await A.get(`/credit-cards/${card}`).expect(200)).body.data;
      expect(c).toMatchObject({ usedCents: 50000, availableCents: 50000, usagePercent: 50, warn: false });
      await A.post(`/credit-cards/${card}/purchases`, { name: 'TV', amountCents: 30000, installmentCurrent: 1, installmentTotal: 10 }).expect(201);
      c = (await A.get(`/credit-cards/${card}`).expect(200)).body.data;
      expect(c).toMatchObject({ usedCents: 80000, warn: true });
      expect(c.purchases[1]).toMatchObject({ installmentCurrent: 1, installmentTotal: 10 });
      await A.post(`/credit-cards/${card}/purchases`, { name: 'zero', amountCents: 0 }).expect(400);
      await A.del(`/credit-cards/${card}`).expect(204);
      expect(await ctx.prisma.cardPurchase.count()).toBe(0);
    });
  });

  describe('investimentos e configurações', () => {
    it('plano calcula meses até a meta; tipo inválido é rejeitado', async () => {
      const r = await A.post('/investments', { name: 'Reserva', type: 'cdb', targetLimitCents: 100000, monthlyAmountCents: 30000 }).expect(201);
      expect(r.body.data.monthsToTarget).toBe(4);
      await A.post('/investments', { type: 'bitcoin-magico' }).expect(400);
    });
    it('configurações: atualiza, valida, e PIN é guardado como hash', async () => {
      const s = await A.patch('/me/settings', { displayName: 'Ana', locale: 'en', theme: 'dark', monthlyGoalCents: 400000, privacyMode: true }).expect(200);
      expect(s.body.data).toMatchObject({ displayName: 'Ana', locale: 'en', theme: 'dark', monthlyGoalCents: 400000, privacyMode: true });
      await A.patch('/me/settings', { locale: 'klingon' }).expect(400);
      await A.patch('/me/settings', { privacyPinHash: 'x' }).expect(400);           // não dá para escrever o hash direto
      await A.put('/me/pin', { pin: '12' }).expect(400);
      await A.put('/me/pin', { pin: '4821' }).expect(200);
      const row = await ctx.prisma.userSettings.findFirstOrThrow({ where: { user: { email: 'a@teste.com' } } });
      expect(row.privacyPinHash).toBeTruthy(); expect(row.privacyPinHash).not.toContain('4821');
      expect((await A.post('/me/pin/verify', { pin: '4821' }).expect(200)).body.data.valid).toBe(true);
      expect((await A.post('/me/pin/verify', { pin: '0000' }).expect(200)).body.data.valid).toBe(false);
      expect((await A.get('/me')).body.data.settings.hasPin).toBe(true);
    });
    it('exportação LGPD devolve tudo do usuário e nada de outro', async () => {
      await A.post('/expenses', { ym: '2026-10', name: 'Meu', amountCents: 1 }).expect(201);
      await B.post('/expenses', { ym: '2026-10', name: 'Dele', amountCents: 2 }).expect(201);
      const e = (await A.get('/me/export').expect(200)).body.data;
      expect(e.expenses.map((x: any) => x.name)).toEqual(['Meu']);
      expect(JSON.stringify(e)).not.toMatch(/passwordHash|tokenHash/);
    });
  });
});
