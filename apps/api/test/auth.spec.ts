import { authed, createTestApp, PASSWORD, signup, TestCtx } from './helpers';

describe('Autenticação (API + PostgreSQL reais)', () => {
  let ctx: TestCtx;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await ctx.prisma.user.deleteMany(); ctx.mailer.sent.length = 0; });

  it('cadastro exige confirmar o e-mail antes do login', async () => {
    await ctx.http().post('/api/v1/auth/register').send({ email: 'Ana@Exemplo.com', password: PASSWORD }).expect(201);
    const u = await ctx.prisma.user.findUnique({ where: { email: 'ana@exemplo.com' } }); // normalizado para minúsculas
    expect(u).toBeTruthy();
    expect(u!.passwordHash).not.toContain(PASSWORD);
    const r = await ctx.http().post('/api/v1/auth/login').send({ email: 'ana@exemplo.com', password: PASSWORD }).expect(403);
    expect(r.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('fluxo completo: cadastro -> confirmação -> login -> /me', async () => {
    const t = await signup(ctx, 'ana@exemplo.com');
    const me = await authed(ctx, t.accessToken).get('/me').expect(200);
    expect(me.body.data.email).toBe('ana@exemplo.com');
    expect(me.body.data.emailVerified).toBe(true);
    expect(me.body.data.settings).toMatchObject({ locale: 'pt', theme: 'light', timezone: 'America/Sao_Paulo', hasPin: false });
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|password_hash|privacyPinHash/);
  });

  it('cadastro repetido NÃO revela que o e-mail já existe (mesma resposta)', async () => {
    const a = await ctx.http().post('/api/v1/auth/register').send({ email: 'x@y.com', password: PASSWORD });
    const b = await ctx.http().post('/api/v1/auth/register').send({ email: 'x@y.com', password: PASSWORD });
    expect(b.status).toBe(a.status); expect(b.body).toEqual(a.body);
    expect(await ctx.prisma.user.count({ where: { email: 'x@y.com' } })).toBe(1);
  });

  it('login com senha errada e com e-mail inexistente dão a MESMA resposta', async () => {
    await signup(ctx, 'ana@exemplo.com');
    const wrong = await ctx.http().post('/api/v1/auth/login').send({ email: 'ana@exemplo.com', password: 'errada-errada' }).expect(401);
    const none = await ctx.http().post('/api/v1/auth/login').send({ email: 'nao@existe.com', password: 'errada-errada' }).expect(401);
    expect(wrong.body).toEqual(none.body);
  });

  it('valida senha fraca e e-mail inválido com erro padronizado', async () => {
    const r = await ctx.http().post('/api/v1/auth/register').send({ email: 'nao-e-email', password: '123' }).expect(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
    expect(r.body.error.details.map((d: any) => d.path).sort()).toEqual(['email', 'password']);
  });

  it('política de senha: mínimo de 6 caracteres (5 é recusada, 6 é aceita)', async () => {
    await ctx.http().post('/api/v1/auth/register').send({ email: 'curta@teste.com', password: 'abc12' }).expect(400);
    await ctx.http().post('/api/v1/auth/register').send({ email: 'curta@teste.com', password: 'abc123' }).expect(201);
  });

  it('rota protegida sem token ou com token falso => 401', async () => {
    expect((await ctx.http().get('/api/v1/me').expect(401)).body.error.code).toBe('MISSING_TOKEN');
    expect((await ctx.http().get('/api/v1/me').set('Authorization', 'Bearer abc.def.ghi').expect(401)).body.error.code).toBe('INVALID_TOKEN');
  });

  it('refresh é ROTATIVO: o token antigo deixa de valer', async () => {
    const t = await signup(ctx, 'ana@exemplo.com');
    const r1 = await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: t.refreshToken }).expect(200);
    expect(r1.body.data.refreshToken).not.toBe(t.refreshToken);
    expect(r1.body.data.accessToken).toBeTruthy();
    await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: t.refreshToken }).expect(401);
  });

  it('REUSO de refresh token derruba a sessão inteira (detecção de roubo)', async () => {
    const t = await signup(ctx, 'ana@exemplo.com');
    const r1 = await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: t.refreshToken }).expect(200);
    const reuse = await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: t.refreshToken }).expect(401);
    expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');
    // o token "novo" legítimo também foi invalidado por precaução
    await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: r1.body.data.refreshToken }).expect(401);
  });

  it('refresh tokens ficam no banco só como hash', async () => {
    const t = await signup(ctx, 'ana@exemplo.com');
    const rows = await ctx.prisma.refreshToken.findMany();
    expect(rows.some((r) => r.tokenHash === t.refreshToken)).toBe(false);
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('logout revoga o refresh token', async () => {
    const t = await signup(ctx, 'ana@exemplo.com');
    await ctx.http().post('/api/v1/auth/logout').send({ refreshToken: t.refreshToken }).expect(204);
    await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: t.refreshToken }).expect(401);
  });

  it('recuperação de senha: link, nova senha, sessões antigas derrubadas, link de uso único', async () => {
    const t = await signup(ctx, 'ana@exemplo.com');
    const resp = await ctx.http().post('/api/v1/auth/forgot-password').send({ email: 'ana@exemplo.com' }).expect(202);
    const none = await ctx.http().post('/api/v1/auth/forgot-password').send({ email: 'ninguem@exemplo.com' }).expect(202);
    expect(none.body).toEqual(resp.body);                                  // não revela se o e-mail existe
    const mail = ctx.mailer.sent.filter((m) => m.subject.includes('Redefinir')).pop()!;
    expect(ctx.mailer.sent.filter((m) => m.to === 'ninguem@exemplo.com')).toHaveLength(0);
    const token = /token=([\w-]+)/.exec(mail.text)![1];
    await ctx.http().post('/api/v1/auth/reset-password').send({ token, password: 'Nova-Senha-456' }).expect(204);
    await ctx.http().post('/api/v1/auth/reset-password').send({ token, password: 'Outra-Senha-789' }).expect(400); // 1 uso
    await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: t.refreshToken }).expect(401);              // sessão antiga caiu
    await ctx.http().post('/api/v1/auth/login').send({ email: 'ana@exemplo.com', password: PASSWORD }).expect(401);
    await ctx.http().post('/api/v1/auth/login').send({ email: 'ana@exemplo.com', password: 'Nova-Senha-456' }).expect(200);
  });

  it('token de recuperação expirado é rejeitado', async () => {
    await signup(ctx, 'ana@exemplo.com');
    await ctx.http().post('/api/v1/auth/forgot-password').send({ email: 'ana@exemplo.com' });
    const token = /token=([\w-]+)/.exec(ctx.mailer.sent.filter((m) => m.subject.includes('Redefinir')).pop()!.text)![1];
    await ctx.prisma.authToken.updateMany({ where: { type: 'PASSWORD_RESET' }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await ctx.http().post('/api/v1/auth/reset-password').send({ token, password: 'Nova-Senha-456' }).expect(400);
  });

  it('troca de senha exige a atual, derruba as outras sessões e devolve nova sessão', async () => {
    const t = await signup(ctx, 'ana@exemplo.com');
    const api = authed(ctx, t.accessToken);
    await api.post('/auth/change-password', { currentPassword: 'errada-errada', newPassword: 'Nova-Senha-456' }).expect(400);
    const ok = await api.post('/auth/change-password', { currentPassword: PASSWORD, newPassword: 'Nova-Senha-456' }).expect(200);
    expect(ok.body.data.refreshToken).toBeTruthy();
    await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: t.refreshToken }).expect(401);
    await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: ok.body.data.refreshToken }).expect(200);
  });

  it('usuário legado com hash bcrypt entra e é migrado para scrypt automaticamente', async () => {
    const bcrypt = await import('bcryptjs');
    await ctx.prisma.user.create({ data: { email: 'velho@exemplo.com', passwordHash: bcrypt.hashSync('senha-antiga', 10), passwordAlgo: 'bcrypt', emailVerifiedAt: new Date(), settings: { create: {} } } });
    await ctx.http().post('/api/v1/auth/login').send({ email: 'velho@exemplo.com', password: 'senha-antiga' }).expect(200);
    const u = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'velho@exemplo.com' } });
    expect(u.passwordAlgo).toBe('scrypt');
    await ctx.http().post('/api/v1/auth/login').send({ email: 'velho@exemplo.com', password: 'senha-antiga' }).expect(200); // continua entrando
  });

  it('excluir conta exige senha e APAGA todos os dados do usuário (LGPD)', async () => {
    const t = await signup(ctx, 'ana@exemplo.com');
    const api = authed(ctx, t.accessToken);
    await api.post('/expenses', { ym: '2026-10', name: 'Aluguel', amountCents: 150000 }).expect(201);
    await api.post('/credit-cards', { name: 'Nubank', limitCents: 500000 }).expect(201);
    await api.post('/auth/delete-account', { password: 'errada-errada' }).expect(400);
    await api.post('/auth/delete-account', { password: PASSWORD }).expect(204);
    expect(await ctx.prisma.user.count()).toBe(0);
    expect(await ctx.prisma.expense.count()).toBe(0);
    expect(await ctx.prisma.creditCard.count()).toBe(0);
    expect(await ctx.prisma.refreshToken.count()).toBe(0);
    expect(await ctx.prisma.userSettings.count()).toBe(0);
  });
});
