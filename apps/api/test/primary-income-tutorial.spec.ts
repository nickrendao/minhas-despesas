import { readFileSync } from 'fs';
import { join } from 'path';
import { authed, createTestApp, signup, TestCtx } from './helpers';

const MIG = readFileSync(join(__dirname, '../prisma/migrations/20261007000000_primary_income_tutorial/migration.sql'), 'utf8');
const YM = '2026-10';

describe('Renda principal, tutorial e ícones', () => {
  let ctx: TestCtx; let A: ReturnType<typeof authed>; let userA: string;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await ctx.prisma.user.deleteMany(); ctx.mailer.sent.length = 0; const t = await signup(ctx, 'ana@teste.com'); A = authed(ctx, t.accessToken); userA = (await A.get('/me')).body.data.id; });
  const incomes = async (ym = YM) => (await A.get(`/incomes?ym=${ym}`).expect(200)).body.data as any[];
  const make = async (name: string, extra: any = {}, ym = YM) => (await A.post('/incomes', { ym, name, amountCents: 100000, ...extra }).expect(201)).body.data;
  const primaries = async (ym = YM) => (await incomes(ym)).filter((i) => i.isPrimary);

  describe('regra: exatamente UMA principal por mês', () => {
    it('a primeira renda do mês vira principal sozinha; as seguintes não', async () => {
      const a = await make('Salário'); const b = await make('Freela'); expect(a.isPrimary).toBe(true); expect(b.isPrimary).toBe(false); expect((await primaries()).map((i) => i.name)).toEqual(['Salário']);
    });
    it('criar já como principal troca a anterior; a lista vem com a principal primeiro', async () => {
      await make('Salário'); const novo = await make('Aluguel recebido', { isPrimary: true });
      expect(novo.isPrimary).toBe(true); expect((await primaries()).map((i) => i.name)).toEqual(['Aluguel recebido']); expect((await incomes())[0].name).toBe('Aluguel recebido');
    });
    it('PATCH isPrimary:true troca a principal (a antiga deixa de ser) e renomear/editar valor NÃO mexe nela', async () => {
      const a = await make('Salário'); const b = await make('Freela');
      await A.patch(`/incomes/${b.id}`, { isPrimary: true }).expect(200); expect((await primaries()).map((i) => i.id)).toEqual([b.id]);
      await A.patch(`/incomes/${b.id}`, { name: 'Consultoria', amountCents: 250000 }).expect(200); const p = await primaries(); expect(p).toHaveLength(1); expect(p[0]).toMatchObject({ id: b.id, name: 'Consultoria', amountCents: 250000 });
      expect((await incomes()).find((i) => i.id === a.id).isPrimary).toBe(false);
    });
    it('não dá para "desmarcar" a principal (409 PRIMARY_REQUIRED); desmarcar uma que não é principal é inofensivo', async () => {
      const a = await make('Salário'); const b = await make('Freela');
      const r = await A.patch(`/incomes/${a.id}`, { isPrimary: false }).expect(409); expect(r.body.error.code).toBe('PRIMARY_REQUIRED'); expect((await primaries()).map((i) => i.id)).toEqual([a.id]);
      await A.patch(`/incomes/${b.id}`, { isPrimary: false }).expect(200); expect((await primaries()).map((i) => i.id)).toEqual([a.id]);
    });
    it('apagar a principal promove a renda mais antiga que restar; apagar outra não muda nada; apagar a última deixa o mês sem rendas', async () => {
      const a = await make('Salário'); const b = await make('Freela'); const c = await make('Extra');
      await A.del(`/incomes/${b.id}`).expect(204); expect((await primaries()).map((i) => i.id)).toEqual([a.id]);
      await A.del(`/incomes/${a.id}`).expect(204); expect((await primaries()).map((i) => i.id)).toEqual([c.id]);
      await A.del(`/incomes/${c.id}`).expect(204); expect(await incomes()).toHaveLength(0);
    });
    it('CONCORRÊNCIA: 9 pedidos simultâneos de "tornar principal" em rendas diferentes terminam com exatamente UMA principal', async () => {
      const ids = [(await make('A')).id, (await make('B')).id, (await make('C')).id];
      const rs = await Promise.all(Array.from({ length: 9 }, (_, i) => A.patch(`/incomes/${ids[i % 3]}`, { isPrimary: true })));
      expect(rs.every((r) => r.status === 200)).toBe(true); expect(await primaries()).toHaveLength(1);
    });
    it('o limite de 3 rendas continua valendo e meses diferentes têm principais independentes', async () => {
      await make('1'); await make('2'); await make('3'); await A.post('/incomes', { ym: YM, name: '4', amountCents: 1 }).expect(409);
      const outro = await make('Outro mês', {}, '2026-11'); expect(outro.isPrimary).toBe(true); expect(await primaries()).toHaveLength(1);
    });
  });

  describe('recorrência e cópia de mês preservam a regra', () => {
    it('abrir o mês seguinte copia a principal recorrente como principal', async () => {
      const sal = await make('Salário', { recurring: true }); await make('Freela', { recurring: true });
      const next = (await A.post('/months/2026-11/open').expect(200)).body.data; expect(next.incomes).toHaveLength(2);
      expect(next.incomes.filter((i: any) => i.isPrimary).map((i: any) => i.name)).toEqual(['Salário']); expect(next.incomes[0].name).toBe('Salário'); void sal;
    });
    it('se a principal NÃO era recorrente, a mais antiga das copiadas assume (o mês nunca fica sem principal)', async () => {
      await make('Salário avulso', { recurring: false }); await make('Freela fixo', { recurring: true });
      const next = (await A.post('/months/2026-11/open').expect(200)).body.data; expect(next.incomes).toHaveLength(1); expect(next.incomes[0]).toMatchObject({ name: 'Freela fixo', isPrimary: true });
    });
    it('copiar mês leva a principal e também respeita a regra no destino', async () => {
      await make('Salário'); const b = await make('Freela'); await A.patch(`/incomes/${b.id}`, { isPrimary: true });
      await A.post(`/months/${YM}/copy`, { target: '2026-12' }).expect(200);
      const dst = await primaries('2026-12'); expect(dst).toHaveLength(1); expect(dst[0].name).toBe('Freela');
    });
  });

  describe('banco de dados', () => {
    it('índice único parcial: o BANCO recusa duas principais no mesmo mês (mesmo contornando a API)', async () => {
      const a = await make('Salário'); const b = await make('Freela');
      await expect(ctx.prisma.$executeRawUnsafe(`UPDATE incomes SET is_primary = true WHERE id = '${b.id}'`)).rejects.toThrow(/incomes_one_primary_per_month|unique/i);
      expect((await primaries()).map((i) => i.id)).toEqual([a.id]);
    });
    it('o índice não atrapalha: principais em meses diferentes e de pessoas diferentes são permitidas', async () => {
      await make('Nov', {}, '2026-11'); await make('Out'); const t2 = await signup(ctx, 'bia@teste.com'); const B = authed(ctx, t2.accessToken);
      const r = await B.post('/incomes', { ym: YM, name: 'Da Bia', amountCents: 1 }).expect(201); expect(r.body.data.isPrimary).toBe(true);
      expect((await ctx.prisma.income.count({ where: { isPrimary: true } }))).toBe(3);
    });
    it('MIGRAÇÃO (backfill): contas existentes ganham UMA principal por mês — a renda mais antiga', async () => {
      const x = await make('Mais antiga'); await make('Meio'); await make('Mais nova'); const nov = await make('Nov A', {}, '2026-11'); await make('Nov B', {}, '2026-11');
      await ctx.prisma.$executeRawUnsafe(`UPDATE incomes SET is_primary = false`);                                   // estado "antes da migração"
      await ctx.prisma.$executeRawUnsafe(`UPDATE incomes SET created_at = now() - interval '3 hour' WHERE id = '${x.id}'`);
      await ctx.prisma.$executeRawUnsafe(`UPDATE incomes SET created_at = now() - interval '2 hour' WHERE name = 'Meio'`);
      await ctx.prisma.$executeRawUnsafe(`UPDATE incomes SET created_at = now() - interval '2 hour' WHERE id = '${nov.id}'`);
      const stmt = MIG.split(';').map((s) => s.trim()).find((s) => /^UPDATE "incomes"/m.test(s.replace(/^--.*$/gm, '').trim()))!.replace(/^--.*$/gm, '').trim();
      await ctx.prisma.$executeRawUnsafe(stmt);
      expect((await primaries()).map((i) => i.name)).toEqual(['Mais antiga']); expect((await primaries('2026-11')).map((i) => i.name)).toEqual(['Nov A']);
    });
    it('a migração também criou a coluna do tutorial com padrão 0', async () => {
      const rows: any[] = await ctx.prisma.$queryRawUnsafe(`SELECT column_default FROM information_schema.columns WHERE table_name='user_settings' AND column_name='tutorial_version'`); expect(rows[0].column_default).toBe('0');
    });
  });

  describe('isolamento entre pessoas', () => {
    it('outra pessoa não consegue marcar/ler/apagar a principal alheia', async () => {
      const a = await make('Salário'); const t2 = await signup(ctx, 'bia@teste.com'); const B = authed(ctx, t2.accessToken);
      await B.patch(`/incomes/${a.id}`, { isPrimary: true }).expect(404); await B.del(`/incomes/${a.id}`).expect(404); expect((await primaries()).map((i) => i.id)).toEqual([a.id]); expect((await B.get(`/incomes?ym=${YM}`)).body.data).toHaveLength(0);
    });
    it('exportar dados inclui a marcação de principal', async () => {
      await make('Salário'); const exp = (await A.get('/me/export').expect(200)).body.data; expect(exp.incomes[0]).toMatchObject({ name: 'Salário', isPrimary: true });
    });
  });

  describe('tutorial (versão já vista)', () => {
    it('conta nova começa em 0; salvar 1 persiste; aparece em GET /me', async () => {
      expect((await A.get('/me')).body.data.settings.tutorialVersion).toBe(0);
      await A.patch('/me/settings', { tutorialVersion: 1 }).expect(200); expect((await A.get('/me')).body.data.settings.tutorialVersion).toBe(1);
    });
    it('quem já "terminou o tutorial ANTIGO" (onboarded) continua com versão 0 — vê o tutorial novo', async () => {
      await A.patch('/me/settings', { onboarded: true, nameAsked: true }).expect(200); const s = (await A.get('/me')).body.data.settings; expect(s.onboarded).toBe(true); expect(s.tutorialVersion).toBe(0);
    });
    it('valores inválidos são recusados', async () => {
      for (const v of [-1, 1.5, '1', null, 1001]) await A.patch('/me/settings', { tutorialVersion: v }).expect(400);
      expect((await A.get('/me')).body.data.settings.tutorialVersion).toBe(0);
    });
    it('é por pessoa: uma pessoa ter visto não afeta a outra', async () => {
      await A.patch('/me/settings', { tutorialVersion: 1 }); const t2 = await signup(ctx, 'bia@teste.com'); expect((await authed(ctx, t2.accessToken).get('/me')).body.data.settings.tutorialVersion).toBe(0);
    });
  });

  describe('ícone da despesa (chave de ícone de linha)', () => {
    const exp = (b: any) => A.post('/expenses', { ym: YM, name: 'X', amountCents: 100, ...b });
    it('padrão = "receipt"; aceita chave de ícone e também emoji antigo; recusa texto enorme', async () => {
      expect((await exp({}).expect(201)).body.data.icon).toBe('receipt'); expect((await exp({ icon: 'home' }).expect(201)).body.data.icon).toBe('home');
      expect((await exp({ icon: '🏠' }).expect(201)).body.data.icon).toBe('🏠'); await exp({ icon: 'x'.repeat(25) }).expect(400);
    });
    it('trocar ícone e cor por PATCH; a recorrência leva o ícone escolhido para o mês seguinte', async () => {
      const e = (await exp({ recurring: true }).expect(201)).body.data;
      const u = (await A.patch(`/expenses/${e.id}`, { icon: 'wifi', color: '#3B6B8C' }).expect(200)).body.data; expect(u).toMatchObject({ icon: 'wifi', color: '#3B6B8C' });
      const next = (await A.post('/months/2026-11/open').expect(200)).body.data; expect(next.expenses[0]).toMatchObject({ icon: 'wifi', color: '#3B6B8C' });
      await A.patch(`/expenses/${e.id}`, { color: 'azul' }).expect(400);
    });
  });
});
