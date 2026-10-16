import { ApiError, createApiClient, MemoryTokenStorage } from '@fin/api-client';
import { createTestApp, PASSWORD, signup, TestCtx } from './helpers';

describe('@fin/api-client contra a API real (servidor HTTP de verdade)', () => {
  let ctx: TestCtx; let baseUrl: string;
  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.listen(0);                                   // porta aleatória, HTTP real
    baseUrl = `${await ctx.app.getUrl()}/api/v1`.replace('[::1]', 'localhost');
  });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await ctx.prisma.user.deleteMany(); ctx.mailer.sent.length = 0; });

  const mk = (storage = new MemoryTokenStorage(), onAuthLost = jest.fn()) => ({ storage, onAuthLost, api: createApiClient({ baseUrl, storage, onAuthLost }) });
  const confirmEmail = async (email: string) => {
    const mail = ctx.mailer.sent.filter((m) => m.to === email && m.subject.includes('Confirme')).pop()!;
    return /token=([\w-]+)/.exec(mail.text)![1];
  };

  it('cadastro -> confirmação -> login -> chamadas autenticadas, com dados já "desembrulhados"', async () => {
    const { api } = mk();
    await api.auth.register('ana@teste.com', PASSWORD);
    await api.auth.verifyEmail(await confirmEmail('ana@teste.com'));
    await api.auth.login('ana@teste.com', PASSWORD);
    expect((await api.me.get()).email).toBe('ana@teste.com');
    const e = await api.expenses.create({ ym: '2026-10', name: 'Aluguel', amountCents: 150000 });
    expect(e.amountCents).toBe(150000);
    const list = await api.expenses.list({ ym: '2026-10' });
    expect(list.data).toHaveLength(1); expect(list.meta).toMatchObject({ total: 1 });
    expect((await api.reports.summary('2026-10')).expensesCents).toBe(150000);
  });

  it('erros viram ApiError com code estável e detalhes de validação', async () => {
    const { api } = mk();
    await expect(api.auth.login('naoexiste@teste.com', 'qualquer-senha')).rejects.toMatchObject({ name: 'ApiError', status: 401, code: 'INVALID_CREDENTIALS' });
    const err = (await api.auth.register('invalido', '1').catch((e: ApiError) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    expect(err.details.map((d: any) => d.path).sort()).toEqual(['email', 'password']);
  });

  it('token de acesso VENCIDO é renovado sozinho e a chamada original é repetida', async () => {
    const t = await signup(ctx, 'ana@teste.com');
    const storage = new MemoryTokenStorage(); await storage.set({ accessToken: 'token.vencido.falso', refreshToken: t.refreshToken });
    const { api, onAuthLost } = mk(storage);
    expect((await api.me.get()).email).toBe('ana@teste.com');
    const after = (await storage.get())!;
    expect(after.accessToken).not.toBe('token.vencido.falso'); expect(after.refreshToken).not.toBe(t.refreshToken); // rotacionou
    expect(onAuthLost).not.toHaveBeenCalled();
  });

  it('10 chamadas SIMULTÂNEAS com token vencido => UMA só renovação (sem derrubar a sessão por "reuso")', async () => {
    const t = await signup(ctx, 'ana@teste.com');
    const storage = new MemoryTokenStorage(); await storage.set({ accessToken: 'vencido', refreshToken: t.refreshToken });
    const { api, onAuthLost } = mk(storage);
    const results = await Promise.all(Array.from({ length: 10 }, () => api.me.get()));
    expect(results.every((r) => r.email === 'ana@teste.com')).toBe(true);
    expect(onAuthLost).not.toHaveBeenCalled();
    const rows = await ctx.prisma.refreshToken.findMany({ orderBy: { createdAt: 'asc' } });
    expect(rows).toHaveLength(2);                                       // o do login + exatamente UM novo
    expect(rows.filter((r) => r.revokedAt === null)).toHaveLength(1);   // a sessão segue viva
  });

  it('refresh token inválido/revogado => limpa a sessão e avisa (onAuthLost) para ir ao login', async () => {
    const storage = new MemoryTokenStorage(); await storage.set({ accessToken: 'vencido', refreshToken: 'x'.repeat(43) });
    const { api, onAuthLost } = mk(storage);
    await expect(api.me.get()).rejects.toMatchObject({ status: 401 });
    expect(onAuthLost).toHaveBeenCalledTimes(1);
    expect(await storage.get()).toBeNull();
  });

  it('logout revoga no servidor e limpa o armazenamento; trocar a senha atualiza os tokens', async () => {
    const { api, storage } = mk();
    await api.auth.register('ana@teste.com', PASSWORD); await api.auth.verifyEmail(await confirmEmail('ana@teste.com'));
    await api.auth.login('ana@teste.com', PASSWORD);
    const oldRefresh = (await storage.get())!.refreshToken;
    await api.auth.changePassword(PASSWORD, 'Nova-Senha-456');
    expect((await storage.get())!.refreshToken).not.toBe(oldRefresh);
    expect((await api.me.get()).email).toBe('ana@teste.com');
    const current = (await storage.get())!.refreshToken;
    await api.auth.logout();
    expect(await storage.get()).toBeNull();
    const r = await fetch(`${baseUrl}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: current }) });
    expect(r.status).toBe(401);
  });

  it('204 (sem corpo) e fluxo de mês/recorrência funcionam pelo cliente', async () => {
    const t = await signup(ctx, 'ana@teste.com');
    const storage = new MemoryTokenStorage(); await storage.set(t);
    const { api } = mk(storage);
    await api.incomes.create({ ym: '2026-09', name: 'Salário', amountCents: 500000, recurring: true });
    const e = await api.expenses.create({ ym: '2026-09', name: 'Plano', amountCents: 9900, recurring: true });
    const oct = await api.months.open('2026-10');
    expect(oct.incomes).toHaveLength(1); expect(oct.expenses).toHaveLength(1);
    await expect(api.expenses.remove(e.id)).resolves.toBeUndefined();
  });

  it('modo BFF: sem token na memória, restaura a sessão pela função renew; 10 chamadas => UMA renovação', async () => {
    const t = await signup(ctx, 'ana@teste.com');
    const storage = new MemoryTokenStorage();
    const renew = jest.fn(async () => { await new Promise((r) => setTimeout(r, 30)); return t.accessToken; });
    const onAuthLost = jest.fn();
    const api = createApiClient({ baseUrl, storage, renew, onAuthLost });
    const results = await Promise.all(Array.from({ length: 10 }, () => api.me.get()));
    expect(results.every((r) => r.email === 'ana@teste.com')).toBe(true);
    expect(renew).toHaveBeenCalledTimes(1);
    expect((await storage.get())!.refreshToken).toBe('');           // o refresh token NUNCA passa pelo JavaScript do site
    expect(onAuthLost).not.toHaveBeenCalled();
  });

  it('modo BFF: renew devolve null (cookie expirado/ausente) => 401 + onAuthLost', async () => {
    const onAuthLost = jest.fn();
    const api = createApiClient({ baseUrl, storage: new MemoryTokenStorage(), renew: async () => null, onAuthLost });
    await expect(api.me.get()).rejects.toMatchObject({ status: 401 });
    expect(onAuthLost).toHaveBeenCalledTimes(1);
  });

  it('modo BFF: com a página recém-aberta renova ANTES de chamar (nenhuma chamada autenticada sai sem token)', async () => {
    const t = await signup(ctx, 'ana@teste.com'); const seen: { path: string; auth: boolean }[] = [];
    const fetchImpl: typeof fetch = async (u, init) => { seen.push({ path: String(u).replace(baseUrl, ''), auth: !!(init?.headers as any)?.authorization }); return fetch(u, init); };
    const api = createApiClient({ baseUrl, storage: new MemoryTokenStorage(), renew: async () => t.accessToken, fetchImpl });
    expect((await api.me.get()).email).toBe('ana@teste.com');
    expect(seen).toEqual([{ path: '/me', auth: true }]);                 // uma única chamada, já com token: sem 401 intermediário
  });
});
