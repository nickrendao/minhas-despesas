import { handleLogin, handleLogout, handleRefresh } from '../../web/src/lib/bff';
import { REFRESH_COOKIE, parseCookies } from '../../web/src/lib/cookies';
import { createTestApp, PASSWORD, signup, TestCtx } from './helpers';

const SITE = 'http://site.test';
const post = (path: string, body?: unknown, extra: Record<string, string> = {}, origin: string | null = SITE) =>
  new Request(SITE + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
const setCookie = (r: Response) => r.headers.get('set-cookie') ?? '';
const rtFrom = (r: Response) => decodeURIComponent(new RegExp(`${REFRESH_COOKIE}=([^;]*)`).exec(setCookie(r))![1]);

describe('BFF do site (cookie httpOnly) contra a API real', () => {
  let ctx: TestCtx; let apiUrl: string;
  beforeAll(async () => {
    ctx = await createTestApp(); await ctx.app.listen(0);
    apiUrl = `${(await ctx.app.getUrl()).replace('[::1]', 'localhost')}/api/v1`;
    process.env.API_URL = apiUrl;
  });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await ctx.prisma.user.deleteMany(); process.env.API_URL = apiUrl; delete process.env.WEB_ORIGINS; });

  const registerVerified = async (email: string) => { await signup(ctx, email); };

  it('login: devolve só o access token; o refresh token vai em cookie HttpOnly/SameSite=Lax restrito a /api/auth', async () => {
    await registerVerified('ana@teste.com');
    const r = await handleLogin(post('/api/auth/login', { email: 'ana@teste.com', password: PASSWORD }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.data.accessToken).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain('refreshToken');           // o JavaScript da página nunca vê o refresh token
    const c = setCookie(r);
    expect(c).toMatch(/HttpOnly/); expect(c).toMatch(/SameSite=Lax/); expect(c).toMatch(/Path=\/api\/auth/); expect(c).toMatch(/Max-Age=\d+/);
    expect(c).not.toMatch(/Secure/);                                      // http local
    expect(r.headers.get('cache-control')).toBe('no-store');
    // o cookie guardado é um refresh token VÁLIDO na API
    const ok = await fetch(`${apiUrl}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: rtFrom(r) }) });
    expect(ok.status).toBe(200);
  });

  it('login com senha errada repassa o erro padronizado e NÃO cria cookie', async () => {
    await registerVerified('ana@teste.com');
    const r = await handleLogin(post('/api/auth/login', { email: 'ana@teste.com', password: 'errada-errada' }));
    expect(r.status).toBe(401); expect((await r.json()).error.code).toBe('INVALID_CREDENTIALS'); expect(setCookie(r)).toBe('');
  });

  it('refresh: lê o cookie, ROTACIONA (novo cookie) e devolve novo access token', async () => {
    await registerVerified('ana@teste.com');
    const login = await handleLogin(post('/api/auth/login', { email: 'ana@teste.com', password: PASSWORD }));
    const rt1 = rtFrom(login);
    const r = await handleRefresh(post('/api/auth/refresh', undefined, { cookie: `${REFRESH_COOKIE}=${encodeURIComponent(rt1)}` }));
    expect(r.status).toBe(200); expect((await r.json()).data.accessToken).toBeTruthy();
    const rt2 = rtFrom(r); expect(rt2).not.toBe(rt1);
    // reaproveitar o cookie antigo => sessão derrubada e cookie apagado
    const reuse = await handleRefresh(post('/api/auth/refresh', undefined, { cookie: `${REFRESH_COOKIE}=${encodeURIComponent(rt1)}` }));
    expect(reuse.status).toBe(401); expect(setCookie(reuse)).toMatch(/Max-Age=0/);
  });

  it('refresh sem cookie => 401 NO_SESSION', async () => {
    const r = await handleRefresh(post('/api/auth/refresh'));
    expect(r.status).toBe(401); expect((await r.json()).error.code).toBe('NO_SESSION');
  });

  it('logout: revoga na API e apaga o cookie', async () => {
    await registerVerified('ana@teste.com');
    const rt = rtFrom(await handleLogin(post('/api/auth/login', { email: 'ana@teste.com', password: PASSWORD })));
    const r = await handleLogout(post('/api/auth/logout', undefined, { cookie: `${REFRESH_COOKIE}=${encodeURIComponent(rt)}` }));
    expect(r.status).toBe(204); expect(setCookie(r)).toMatch(/Max-Age=0/);
    const after = await fetch(`${apiUrl}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }) });
    expect(after.status).toBe(401);
  });

  it('CSRF: POST sem Origin, ou com Origin de outro site, é recusado (403) em login, refresh e logout', async () => {
    await registerVerified('ana@teste.com');
    for (const [fn, path] of [[handleLogin, '/api/auth/login'], [handleRefresh, '/api/auth/refresh'], [handleLogout, '/api/auth/logout']] as const) {
      expect((await fn(post(path, { email: 'ana@teste.com', password: PASSWORD }, {}, 'http://site-malvado.com'))).status).toBe(403);
      expect((await fn(post(path, { email: 'ana@teste.com', password: PASSWORD }, {}, null))).status).toBe(403);
    }
    expect(await ctx.prisma.refreshToken.count()).toBe(1);                // só o do signup(): nenhum login foi feito pelos ataques
    process.env.WEB_ORIGINS = 'https://app.exemplo.com';
    expect((await handleLogin(post('/api/auth/login', { email: 'ana@teste.com', password: PASSWORD }, {}, 'https://app.exemplo.com'))).status).toBe(200);
  });

  it('CSRF — sinais do navegador: sem Origin vale Sec-Fetch-Site=same-origin ou Referer do próprio site; o resto é recusado', async () => {
    await registerVerified('ana@teste.com'); const body = { email: 'ana@teste.com', password: PASSWORD }; const st = async (extra: Record<string, string>, origin: string | null = null) => (await handleLogin(post('/api/auth/login', body, extra, origin))).status;
    expect(await st({ 'sec-fetch-site': 'same-origin' })).toBe(200);                                   // o caso real do Chrome
    expect(await st({ referer: `${SITE}/login` })).toBe(200);                                          // sem Origin e sem Sec-Fetch-Site: Referer do próprio site
    expect(await st({ 'sec-fetch-site': 'cross-site' })).toBe(403); expect(await st({ 'sec-fetch-site': 'same-site' })).toBe(403); expect(await st({ 'sec-fetch-site': 'none' })).toBe(403);
    expect(await st({ referer: 'http://site-malvado.com/x' })).toBe(403); expect(await st({ referer: 'lixo-não-url' })).toBe(403);
    expect(await st({}, 'null')).toBe(403);                                                            // Origin literal "null" (iframe isolado)
    expect(await st({ 'sec-fetch-site': 'same-origin' }, 'http://site-malvado.com')).toBe(403);       // Origin presente manda mais que Sec-Fetch-Site
    expect(await st({ 'sec-fetch-site': 'cross-site', referer: `${SITE}/login` })).toBe(403);          // sinal forte vence o fraco
    expect(await st({})).toBe(403);                                                                    // nenhum sinal
    for (const fn of [handleRefresh, handleLogout]) expect((await fn(post('/api/auth/x', undefined, { 'sec-fetch-site': 'cross-site' }, null))).status).toBe(403);
  });

  it('em produção/HTTPS o cookie ganha o atributo Secure', async () => {
    await registerVerified('ana@teste.com');
    const r = await handleLogin(post('/api/auth/login', { email: 'ana@teste.com', password: PASSWORD }, { 'x-forwarded-proto': 'https' }));
    expect(setCookie(r)).toMatch(/Secure/);
  });

  it('API fora do ar => 502 com mensagem amigável, sem vazar detalhes', async () => {
    process.env.API_URL = 'http://127.0.0.1:1/api/v1';
    const r = await handleLogin(post('/api/auth/login', { email: 'a@a.com', password: 'x' }));
    expect(r.status).toBe(502); expect((await r.json()).error.code).toBe('API_UNAVAILABLE');
  });

  it('cookie malformado não derruba o servidor', () => {
    expect(parseCookies('a=%E0%A4%A; fin_rt=ok; =x; b')).toMatchObject({ fin_rt: 'ok' });
  });
});

describe('BFF: trocar senha e excluir conta (cookie precisa acompanhar a API)', () => {
  let ctx: TestCtx; let apiUrl: string;
  beforeAll(async () => { ctx = await createTestApp(); await ctx.app.listen(0); apiUrl = `${(await ctx.app.getUrl()).replace('[::1]', 'localhost')}/api/v1`; process.env.API_URL = apiUrl; });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await ctx.prisma.user.deleteMany(); process.env.API_URL = apiUrl; });
  const { handleChangePassword, handleDeleteAccount } = require('../../web/src/lib/bff');

  it('trocar senha: rotaciona o cookie para a NOVA sessão (o antigo deixa de valer) e o access token novo funciona', async () => {
    await signup(ctx, 'ana@teste.com');
    const login = await handleLogin(post('/api/auth/login', { email: 'ana@teste.com', password: PASSWORD }));
    const rtOld = rtFrom(login); const at = (await login.json()).data.accessToken;
    const r = await handleChangePassword(post('/api/auth/change-password', { currentPassword: PASSWORD, newPassword: 'Nova-Senha-456' }, { authorization: `Bearer ${at}` }));
    expect(r.status).toBe(200); const body = await r.json();
    expect(JSON.stringify(body)).not.toContain('refreshToken');
    const rtNew = rtFrom(r); expect(rtNew).not.toBe(rtOld); expect(setCookie(r)).toMatch(/HttpOnly/);
    // o cookie ANTIGO foi revogado pela API; o NOVO renova normalmente
    expect((await handleRefresh(post('/api/auth/refresh', undefined, { cookie: `${REFRESH_COOKIE}=${encodeURIComponent(rtOld)}` }))).status).toBe(401);
    const ok = await handleRefresh(post('/api/auth/refresh', undefined, { cookie: `${REFRESH_COOKIE}=${encodeURIComponent(rtNew)}` })); expect(ok.status).toBe(200);
    // e a senha nova realmente passou a valer
    expect((await handleLogin(post('/api/auth/login', { email: 'ana@teste.com', password: 'Nova-Senha-456' }))).status).toBe(200);
  });
  it('trocar senha: senha atual errada => erro repassado e o cookie NÃO muda', async () => {
    await signup(ctx, 'ana@teste.com');
    const login = await handleLogin(post('/api/auth/login', { email: 'ana@teste.com', password: PASSWORD })); const at = (await login.json()).data.accessToken;
    const r = await handleChangePassword(post('/api/auth/change-password', { currentPassword: 'errada-errada', newPassword: 'Nova-Senha-456' }, { authorization: `Bearer ${at}` }));
    expect(r.status).toBe(400); expect((await r.json()).error.code).toBe('WRONG_PASSWORD'); expect(setCookie(r)).toBe('');
  });
  it('exige Origin do site e token; sem isso nada acontece', async () => {
    expect((await handleChangePassword(post('/api/auth/change-password', {}, { authorization: 'Bearer x' }, 'http://site-malvado.com'))).status).toBe(403);
    expect((await handleChangePassword(post('/api/auth/change-password', {}))).status).toBe(401);
    expect((await handleDeleteAccount(post('/api/auth/delete-account', {}, {}, 'http://site-malvado.com'))).status).toBe(403);
    expect((await handleDeleteAccount(post('/api/auth/delete-account', {}))).status).toBe(401);
  });
  it('excluir conta: apaga TODOS os dados e limpa o cookie', async () => {
    await signup(ctx, 'ana@teste.com');
    const login = await handleLogin(post('/api/auth/login', { email: 'ana@teste.com', password: PASSWORD })); const at = (await login.json()).data.accessToken;
    await fetch(`${apiUrl}/expenses`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${at}` }, body: JSON.stringify({ ym: '2026-10', name: 'x', amountCents: 1 }) });
    const bad = await handleDeleteAccount(post('/api/auth/delete-account', { password: 'errada-errada' }, { authorization: `Bearer ${at}` })); expect(bad.status).toBe(400); expect(setCookie(bad)).toBe('');
    const r = await handleDeleteAccount(post('/api/auth/delete-account', { password: PASSWORD }, { authorization: `Bearer ${at}` }));
    expect(r.status).toBe(204); expect(setCookie(r)).toMatch(/Max-Age=0/);
    expect(await ctx.prisma.user.count()).toBe(0); expect(await ctx.prisma.expense.count()).toBe(0);
  });
});

describe('BFF: atributo Secure do cookie', () => {
  let ctx: TestCtx; let apiUrl: string; const envBefore = process.env.NODE_ENV;
  beforeAll(async () => { ctx = await createTestApp(); await ctx.app.listen(0); apiUrl = `${(await ctx.app.getUrl()).replace('[::1]', 'localhost')}/api/v1`; process.env.API_URL = apiUrl; });
  afterAll(async () => { process.env.NODE_ENV = envBefore; await ctx.app.close(); });
  beforeEach(async () => { await ctx.prisma.user.deleteMany(); });
  const loginAt = async (origin: string) => { await signup(ctx, 'ana@teste.com');
    return handleLogin(new Request(`${origin}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ email: 'ana@teste.com', password: PASSWORD }) })); };
  it('produção em domínio real => Secure; produção em localhost (teste local) => SEM Secure; HTTPS sempre Secure', async () => {
    process.env.NODE_ENV = 'production';
    expect(setCookie(await loginAt('https://minhasdespesas021.com.br'))).toMatch(/Secure/);
    await ctx.prisma.user.deleteMany(); expect(setCookie(await loginAt('http://localhost:3000'))).not.toMatch(/Secure/);
    await ctx.prisma.user.deleteMany(); expect(setCookie(await loginAt('http://meusite.exemplo.com'))).toMatch(/Secure/);
  });
});
