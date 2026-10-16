import * as bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { applyPlan } from '../src/legacy/apply';
import { transformLegacyUser } from '../src/legacy/transform';
import { authed, createTestApp, TestCtx } from './helpers';

const U1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const U2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const U3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

// ===== Dados NO FORMATO REAL do site atual: valores são TEXTO (JSON.stringify), dinheiro em reais (float) =====
const blobU1 = {
  'month:2026-09': JSON.stringify({ salary: 5000.5, expenses: [
    { id: 'a1b2c3d', name: 'Aluguel', icon: '🏠', color: '#B85C38', value: 1500.1, recurring: true, dueDay: 5 },
    { id: 'e4f5g6h', name: 'Mercado', icon: '🛒', color: '#C9A227', value: 0.1, recurring: false },
    { id: 'i7j8k9l', name: 'Padaria', icon: '🥖', color: '#1F6F54', value: 0.2, recurring: false },
  ] }),
  'month:2026-10': JSON.stringify({ salary: 6000.99, incomes: [
    { id: 'x1', name: 'Salário', value: 5000, recurring: true }, { id: 'x2', name: 'Freela', value: 1000.99, recurring: false },
  ], expenses: [
    { id: 'm1', name: 'Internet', icon: '🌐', color: '#3B6B8C', value: 99.9, recurring: true, dueDay: 10, installmentCurrent: 2, installmentTotal: 12 },
    { id: 'm2', name: 'Dado sujo', color: 'azul', value: -5, installmentCurrent: 9, installmentTotal: 3 }, // negativo, cor ruim, parcela impossível
  ] }),
  cards: JSON.stringify([
    { id: 'c1', name: 'Nubank', color: '#3B6B8C', limit: 5000, purchases: [
      { id: 'p1', name: 'TV', value: 1999.99, installmentCurrent: 1, installmentTotal: 10 }, { id: 'p2', name: 'Mercado', value: 300.5 } ] },
    { id: 'c2', name: 'Cartão antigo', color: '#7A4B8C', limit: 1000, used: 250 }, // formato antigo: sem lista de compras
  ]),
  investments: JSON.stringify([
    { id: 'i1', name: 'Reserva', type: 'Tesouro Selic', targetLimit: 10000, monthlyAmount: 500 },
    { id: 'i2', name: 'Esquisito', type: 'Tipo Inexistente', targetLimit: 1, monthlyAmount: 1 },
  ]),
  cryptoHoldings: JSON.stringify([
    { id: 'k1', coinId: 'bitcoin', quantity: 0.0123, buyPrice: 300000 },
    { id: 'k2', coinId: '', quantity: 0, buyPrice: 0 },
    { id: 'k3', coinId: 'moeda-nova', quantity: 1, buyPrice: 1 },
  ]),
  monthlyGoal: '3000', theme: 'dark', lang: 'en', displayName: 'Nicolas', privacyMode: 'true', privacyPin: '4821', onboarded: 'true', nameAsked: 'true',
};
const blobU3 = { salaryRecurring: 'true', salaryBase: '4200', 'month:2026-10': JSON.stringify({ salary: 0, expenses: [{ name: 'Luz', value: 150, color: '#8C5B3B', recurring: true }] }) };

describe('Migração dos dados legados (formato real do site atual)', () => {
  let ctx: TestCtx; let legacy: Client;
  const authRow = (id: string, email: string, pw: string) => ({ id, email, encryptedPassword: bcrypt.hashSync(pw, 10), emailConfirmedAt: new Date() });

  beforeAll(async () => {
    ctx = await createTestApp();
    legacy = new Client({ connectionString: process.env.DATABASE_URL }); await legacy.connect();
    await legacy.query('CREATE SCHEMA IF NOT EXISTS auth; CREATE TABLE IF NOT EXISTS auth.users(id uuid primary key, email text, encrypted_password text, email_confirmed_at timestamptz)');
    await legacy.query('CREATE TABLE IF NOT EXISTS public.app_data(user_id uuid primary key, data jsonb, updated_at timestamptz)');
  });
  afterAll(async () => { await legacy.query('DROP TABLE IF EXISTS public.app_data; DROP SCHEMA IF EXISTS auth CASCADE'); await legacy.end(); await ctx.app.close(); });
  beforeEach(async () => { await ctx.prisma.user.deleteMany(); });

  const migrate = async (id: string, blob: any, auth: any, refresh = false) => {
    const plan = transformLegacyUser(id, JSON.parse(JSON.stringify(blob)), auth);
    return { plan, rep: await applyPlan(ctx.prisma as any, plan, { refresh }) };
  };

  it('transformação pura: converte reais->centavos sem erro de float e sinaliza dados sujos', () => {
    const p = transformLegacyUser(U1, blobU1, authRow(U1, 'Nicolas@Teste.com', 'x'));
    expect(p.user!.email).toBe('nicolas@teste.com');
    const sep = p.months.find((m) => m.ym === '2026-09')!;
    expect(sep.expenses.map((e) => e.amountCents)).toEqual([150010, 10, 20]);       // 0.1 e 0.2 viram 10 e 20 centavos exatos
    expect(sep.incomes).toEqual([{ name: 'Renda', amountCents: 500050, recurring: false }]); // salário solto vira renda (regra do applyRecurring legado)
    const oct = p.months.find((m) => m.ym === '2026-10')!;
    expect(oct.expenses[1]).toMatchObject({ amountCents: 0, installmentCurrent: null, installmentTotal: null });
    expect(oct.expenses[1].color).toMatch(/^#[0-9A-F]{6}$/i);
    expect(p.cards[1].purchases).toEqual([{ name: 'Gastos anteriores', amountCents: 25000, installmentCurrent: null, installmentTotal: null }]);
    expect(p.investments[1].type).toBe('outro');
    expect(p.crypto.map((c) => c.coinId)).toEqual(['bitcoin', null, null]);
    expect(p.crypto[0].quantity).toBe('0.0123');
    expect(p.warnings.join(' | ')).toMatch(/negativo/); expect(p.warnings.join(' | ')).toMatch(/parcelas inválidas/); expect(p.warnings.join(' | ')).toMatch(/Moeda desconhecida/);
  });

  it('usuário sem conta em auth.users é pulado (nada gravado) e reportado', async () => {
    const { rep } = await migrate(U2, blobU1, null);
    expect(rep.status).toBe('skipped_no_auth');
    expect(await ctx.prisma.user.count()).toBe(0);
  });

  it('FIM A FIM: migra, faz login com a SENHA ANTIGA e vê os mesmos totais', async () => {
    const { rep } = await migrate(U1, blobU1, authRow(U1, 'nicolas@teste.com', 'minha-senha-antiga'));
    expect(rep.status).toBe('migrated');
    expect(rep.check).toMatchObject({ ok: true, counts: { months: 2, incomes: 3, expenses: 5, cards: 2, purchases: 3, investments: 2, crypto: 3 } });

    // login com a senha do Supabase (bcrypt) na API nova
    const login = await ctx.http().post('/api/v1/auth/login').send({ email: 'nicolas@teste.com', password: 'minha-senha-antiga' }).expect(200);
    const A = authed(ctx, login.body.data.accessToken);
    expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: U1 } })).passwordAlgo).toBe('scrypt'); // migrou o hash no 1º login
    await ctx.http().post('/api/v1/auth/login').send({ email: 'nicolas@teste.com', password: 'senha-errada' }).expect(401);

    const me = (await A.get('/me').expect(200)).body.data;
    expect(me.settings).toMatchObject({ displayName: 'Nicolas', locale: 'en', theme: 'dark', monthlyGoalCents: 300000, privacyMode: true, hasPin: true, onboarded: true });
    expect((await A.post('/me/pin/verify', { pin: '4821' }).expect(200)).body.data.valid).toBe(true);   // PIN legado (texto puro) agora é hash

    const sep = (await A.get('/reports/summary?ym=2026-09').expect(200)).body.data;
    expect(sep).toMatchObject({ incomeCents: 500050, expensesCents: 150040, balanceCents: 350010, fixedCents: 150010, variableCents: 30 });
    const oct = (await A.get('/reports/summary?ym=2026-10').expect(200)).body.data;
    expect(oct).toMatchObject({ incomeCents: 600099, expensesCents: 9990 });
    expect(oct.goal).toMatchObject({ goalCents: 300000, exceeded: false });

    const cards = (await A.get('/credit-cards').expect(200)).body.data;
    expect(cards[0]).toMatchObject({ name: 'Nubank', usedCents: 230049, availableCents: 269951 });
    expect(cards[1]).toMatchObject({ name: 'Cartão antigo', usedCents: 25000, limitCents: 100000 });
    expect((await A.get('/investments').expect(200)).body.data[0]).toMatchObject({ type: 'tesouro_selic', monthsToTarget: 20 });
    expect((await A.get('/expenses?q=padaria').expect(200)).body.data[0]).toMatchObject({ ym: '2026-09', amountCents: 20, icon: '🥖' });

    // a recorrência continua funcionando a partir dos dados migrados
    const nov = (await A.post('/months/2026-11/open').expect(200)).body.data;
    expect(nov.incomes.map((i: any) => i.name)).toEqual(['Salário']);
    expect(nov.expenses.map((e: any) => e.name)).toEqual(['Internet']);
    // e um mês migrado NÃO é "reaberto" (não recopia por cima)
    const before = (await A.get('/expenses?ym=2026-10')).body.meta.total;
    await A.post('/months/2026-10/open').expect(200);
    expect((await A.get('/expenses?ym=2026-10')).body.meta.total).toBe(before);
  });

  it('renda recorrente global do site antigo (salaryRecurring+salaryBase) é preservada para os meses futuros', async () => {
    await migrate(U3, blobU3, authRow(U3, 'maria@teste.com', 'senha-da-maria'));
    const t = (await ctx.http().post('/api/v1/auth/login').send({ email: 'maria@teste.com', password: 'senha-da-maria' }).expect(200)).body.data.accessToken;
    const nov = (await authed(ctx, t).post('/months/2026-11/open').expect(200)).body.data;
    expect(nov.incomes).toMatchObject([{ name: 'Renda', amountCents: 420000, recurring: true }]);
    expect(nov.expenses.map((e: any) => e.name)).toEqual(['Luz']);
  });

  it('é seguro rodar de novo: sem --refresh pula quem já existe; com --refresh substitui SEM duplicar', async () => {
    const auth = authRow(U1, 'nicolas@teste.com', 'minha-senha-antiga');
    await migrate(U1, blobU1, auth);
    expect((await migrate(U1, blobU1, auth)).rep.status).toBe('skipped_exists');
    const r = await migrate(U1, blobU1, auth, true);
    expect(r.rep.status).toBe('migrated');
    expect(await ctx.prisma.expense.count({ where: { userId: U1 } })).toBe(5);
    expect(await ctx.prisma.creditCard.count({ where: { userId: U1 } })).toBe(2);
    expect(await ctx.prisma.monthLedger.count({ where: { userId: U1 } })).toBe(2);
  });

  it('se a conferência falhar, TUDO é desfeito (rollback) — nunca fica usuário pela metade', async () => {
    const plan = transformLegacyUser(U1, JSON.parse(JSON.stringify(blobU1)), authRow(U1, 'nicolas@teste.com', 'x'));
    plan.legacyTotals.expensesReais += 50; // simula divergência de valores
    const rep = await applyPlan(ctx.prisma as any, plan, { refresh: false });
    expect(rep.status).toBe('failed'); expect(rep.error).toMatch(/CONFERÊNCIA FALHOU.*despesas/);
    expect(await ctx.prisma.user.count()).toBe(0); expect(await ctx.prisma.expense.count()).toBe(0);
    expect(await ctx.prisma.creditCard.count()).toBe(0);
  });

  it('o blob legado é lido como veio do Postgres (jsonb) e não é alterado pela migração', async () => {
    await legacy.query('DELETE FROM public.app_data');
    await legacy.query('INSERT INTO public.app_data(user_id, data) VALUES ($1, $2)', [U1, JSON.stringify(blobU1)]);
    const before = (await legacy.query('SELECT data FROM public.app_data WHERE user_id=$1', [U1])).rows[0].data;
    await migrate(U1, before, authRow(U1, 'nicolas@teste.com', 'x'));
    const after = (await legacy.query('SELECT data FROM public.app_data WHERE user_id=$1', [U1])).rows[0].data;
    expect(after).toEqual(before); // migração só LÊ a origem
  });
});
