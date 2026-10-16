import { authed, createTestApp, signup, TestCtx } from './helpers';

describe('Meses, recorrência e relatórios', () => {
  let ctx: TestCtx; let A: ReturnType<typeof authed>;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await ctx.prisma.user.deleteMany(); A = authed(ctx, (await signup(ctx, 'a@teste.com')).accessToken); });

  const seedSeptember = async () => {
    await A.post('/incomes', { ym: '2026-09', name: 'Salário', amountCents: 500000, recurring: true }).expect(201);
    await A.post('/incomes', { ym: '2026-09', name: 'Bônus', amountCents: 100000, recurring: false }).expect(201);
    await A.post('/expenses', { ym: '2026-09', name: 'Aluguel', color: '#1F6F54', amountCents: 150000, recurring: true, dueDay: 5 }).expect(201);
    await A.post('/expenses', { ym: '2026-09', name: 'Mercado', color: '#C9A227', amountCents: 80000, recurring: false }).expect(201);
  };

  describe('recorrência ao abrir o mês', () => {
    it('copia só o que é recorrente (rendas e despesas), com todos os campos', async () => {
      await seedSeptember();
      const m = (await A.post('/months/2026-10/open').expect(200)).body.data;
      expect(m.incomes.map((i: any) => i.name)).toEqual(['Salário']);
      expect(m.incomes[0]).toMatchObject({ amountCents: 500000, recurring: true });
      expect(m.expenses.map((e: any) => e.name)).toEqual(['Aluguel']);
      expect(m.expenses[0]).toMatchObject({ amountCents: 150000, dueDay: 5, color: '#1F6F54', recurring: true });
      expect(m.expenses[0].id).not.toBe((await A.get('/expenses?ym=2026-09&type=fixed')).body.data[0].id); // é cópia, não a mesma linha
    });
    it('é idempotente: abrir de novo não duplica', async () => {
      await seedSeptember();
      await A.post('/months/2026-10/open').expect(200);
      await A.post('/months/2026-10/open').expect(200);
      expect((await A.get('/expenses?ym=2026-10')).body.meta.total).toBe(1);
      expect((await A.get('/incomes?ym=2026-10')).body.data).toHaveLength(1);
    });
    it('abrir várias vezes AO MESMO TEMPO não duplica (concorrência)', async () => {
      await seedSeptember();
      await Promise.all(Array.from({ length: 6 }, () => A.post('/months/2026-10/open')));
      expect((await A.get('/expenses?ym=2026-10')).body.meta.total).toBe(1);
      expect((await A.get('/incomes?ym=2026-10')).body.data).toHaveLength(1);
    });
    it('MUDANÇA INTENCIONAL: apagar tudo e reabrir NÃO ressuscita as recorrentes', async () => {
      await seedSeptember();
      const m = (await A.post('/months/2026-10/open').expect(200)).body.data;
      await A.del(`/expenses/${m.expenses[0].id}`).expect(204);
      const again = (await A.post('/months/2026-10/open').expect(200)).body.data;
      expect(again.expenses).toHaveLength(0);
    });
    it('não sobrescreve o que o usuário já lançou antes de abrir', async () => {
      await seedSeptember();
      await A.post('/expenses', { ym: '2026-10', name: 'Já lançado', amountCents: 1 }).expect(201);
      const m = (await A.post('/months/2026-10/open').expect(200)).body.data;
      expect(m.expenses.map((e: any) => e.name)).toEqual(['Já lançado']);   // despesas já existiam -> não copia
      expect(m.incomes.map((i: any) => i.name)).toEqual(['Salário']);        // rendas estavam vazias -> copia (independente)
    });
    it('vira o ano (dezembro -> janeiro)', async () => {
      await A.post('/expenses', { ym: '2026-12', name: 'Plano', amountCents: 10, recurring: true }).expect(201);
      expect((await A.post('/months/2027-01/open').expect(200)).body.data.expenses).toHaveLength(1);
    });
    it('mês sem anterior simplesmente abre vazio', async () => {
      expect((await A.post('/months/2026-05/open').expect(200)).body.data).toMatchObject({ incomes: [], expenses: [] });
    });
    it('mês inválido => 400', async () => { await A.post('/months/2026-13/open').expect(400); });
  });

  describe('copiar mês', () => {
    it('copia tudo (inclusive não recorrentes); protege destino com dados; overwrite substitui', async () => {
      await seedSeptember();
      const r = (await A.post('/months/2026-09/copy', { target: '2026-11' }).expect(200)).body.data;
      expect(r).toEqual({ copiedIncomes: 2, copiedExpenses: 2 });
      const c = await A.post('/months/2026-09/copy', { target: '2026-11' }).expect(409);
      expect(c.body.error.code).toBe('MONTH_NOT_EMPTY');
      await A.post('/expenses', { ym: '2026-11', name: 'Extra', amountCents: 1 }).expect(201);
      await A.post('/months/2026-09/copy', { target: '2026-11', overwrite: true }).expect(200);
      const names = (await A.get('/expenses?ym=2026-11')).body.data.map((e: any) => e.name).sort();
      expect(names).toEqual(['Aluguel', 'Mercado']);                          // 'Extra' foi substituído
      await A.post('/months/2026-09/copy', { target: '2026-09' }).expect(400); // origem = destino
    });
  });

  describe('relatórios', () => {
    it('resumo mensal bate com a conta feita à mão', async () => {
      await seedSeptember();
      await A.patch('/me/settings', { monthlyGoalCents: 200000 }).expect(200);
      const s = (await A.get('/reports/summary?ym=2026-09&reserveMonths=6').expect(200)).body.data;
      expect(s).toMatchObject({
        ym: '2026-09', incomeCents: 600000, expensesCents: 230000, balanceCents: 370000, committedPercent: 38,
        fixedCents: 150000, variableCents: 80000,
        goal: { goalCents: 200000, exceeded: true, differenceCents: 30000, usedPercent: 100 },
        reserve: { months: 6, baseCents: 230000, baseSource: 'expenses', targetCents: 1380000 },
      });
      expect(s.distribution.map((d: any) => d.name)).toEqual(['Aluguel', 'Mercado']);
      expect(s.distribution[0].percentOfTotal).toBe(65);
    });
    it('mês vazio => zeros, sem erro', async () => {
      const s = (await A.get('/reports/summary?ym=2030-01').expect(200)).body.data;
      expect(s).toMatchObject({ incomeCents: 0, expensesCents: 0, balanceCents: 0, committedPercent: 0, goal: null });
    });
    it('anual soma só meses gravados e acha o maior mês', async () => {
      await A.post('/expenses', { ym: '2026-03', name: 'a', amountCents: 10000 }).expect(201);
      await A.post('/expenses', { ym: '2026-03', name: 'b', amountCents: 5000 }).expect(201);
      await A.post('/expenses', { ym: '2026-07', name: 'c', amountCents: 20000 }).expect(201);
      await A.post('/expenses', { ym: '2025-07', name: 'outro-ano', amountCents: 999999 }).expect(201);
      const y = (await A.get('/reports/yearly?year=2026').expect(200)).body.data;
      expect(y.months).toHaveLength(12);
      expect(y.months[2]).toMatchObject({ ym: '2026-03', expensesCents: 15000 });
      expect(y).toMatchObject({ totalYearCents: 35000, averageMonthlyCents: 2917, biggestMonth: { ym: '2026-07', expensesCents: 20000 } });
    });
    it('vencimentos: mês futuro lista tudo ordenado; agenda junta os próximos meses', async () => {
      await A.post('/expenses', { ym: '2099-01', name: 'B', amountCents: 1, dueDay: 20 }).expect(201);
      await A.post('/expenses', { ym: '2099-01', name: 'A', amountCents: 1, dueDay: 3 }).expect(201);
      await A.post('/expenses', { ym: '2099-01', name: 'sem-venc', amountCents: 1 }).expect(201);
      const d = (await A.get('/reports/dues?ym=2099-01').expect(200)).body.data;
      expect(d.map((x: any) => x.name)).toEqual(['A', 'B']);
      expect(d[0]).toMatchObject({ daysUntil: null, urgent: false });
    });
    it('vencimentos do mês ATUAL (no fuso do usuário) ignoram contas já vencidas', async () => {
      const { todayIn } = await import('@fin/shared');
      const t = todayIn('America/Sao_Paulo');
      const past = Math.max(1, t.day - 1), future = Math.min(28, t.day + 1);
      if (t.day > 1 && t.day < 28) {
        await A.post('/expenses', { ym: t.ym, name: 'vencida', amountCents: 1, dueDay: past }).expect(201);
        await A.post('/expenses', { ym: t.ym, name: 'amanhã', amountCents: 1, dueDay: future }).expect(201);
        const d = (await A.get(`/reports/dues?ym=${t.ym}`).expect(200)).body.data;
        expect(d.map((x: any) => x.name)).toEqual(['amanhã']);
        expect(d[0]).toMatchObject({ daysUntil: 1, urgent: true });
      }
    });
  });
});
