// Teste ponta a ponta (fumaça): precisa da API (porta 3333, REQUIRE_EMAIL_VERIFICATION=false, CORS_ORIGINS=http://localhost:3000) e do site (porta 3000) rodando em produção.
// Uso: node scripts/e2e-smoke.js
const W = 'http://localhost:3000', A = 'http://localhost:3333/api/v1', ORIGIN = 'http://localhost:3000';
const j = (r) => r.json().catch(() => null);
let n = 0; const ok = (c, m) => { n++; console.log((c ? '✅ ' : '❌ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  let r = await fetch(W + '/login'); const html = await r.text();
  ok(r.status === 200 && html.includes('sem complicação'), 'GET /login renderiza a tela de entrada');
  ok(r.headers.get('x-frame-options') === 'DENY' && r.headers.get('x-content-type-options') === 'nosniff' && !r.headers.get('x-powered-by'), 'cabeçalhos de segurança do site (X-Frame-Options, nosniff, sem X-Powered-By)');
  r = await fetch(W + '/', { redirect: 'manual' }); ok([307, 308].includes(r.status) && r.headers.get('location').endsWith('/mensal'), 'GET / redireciona para /mensal');
  for (const t of ['mensal', 'cartao', 'anual', 'agenda', 'investir', 'cripto', 'config', 'apoie']) {
    r = await fetch(W + '/' + t); ok(r.status === 200, `GET /${t} responde 200 (casca do app; a sessão é checada no navegador)`);
  }
  r = await fetch(W + '/rota-que-nao-existe'); ok(r.status === 404, '404 para rota inexistente');

  const email = `e2e${Date.now()}@teste.com`, password = 'Senha-Forte-123';
  r = await fetch(A + '/auth/register', { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify({ email, password }) });
  ok(r.status === 201, 'cadastro direto na API (como o navegador faria)');

  r = await fetch(W + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://site-malvado.com' }, body: JSON.stringify({ email, password }) });
  ok(r.status === 403, 'CSRF: login com Origin de outro site => 403');

  r = await fetch(W + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify({ email, password }) });
  const login = await j(r); const sc = r.headers.get('set-cookie') || '';
  ok(r.status === 200 && login.data.accessToken, 'login pelo site (BFF) devolve access token');
  ok(!JSON.stringify(login).includes('refreshToken') && /HttpOnly/.test(sc) && /SameSite=Lax/.test(sc) && /Path=\/api\/auth/.test(sc), 'refresh token só em cookie HttpOnly (não aparece no corpo da resposta)');
  const cookie1 = sc.split(';')[0];

  // chamadas diretas à API, com CORS (como o navegador faz depois do login)
  const pre = await fetch(A + '/me', { method: 'OPTIONS', headers: { origin: ORIGIN, 'access-control-request-method': 'GET', 'access-control-request-headers': 'authorization' } });
  ok(pre.headers.get('access-control-allow-origin') === ORIGIN && /authorization/i.test(pre.headers.get('access-control-allow-headers') || ''), 'CORS: API aceita o site e o cabeçalho Authorization');
  const pre2 = await fetch(A + '/me', { method: 'OPTIONS', headers: { origin: 'http://site-malvado.com', 'access-control-request-method': 'GET' } });
  ok(!pre2.headers.get('access-control-allow-origin'), 'CORS: API NÃO libera outro site');

  const H = { authorization: 'Bearer ' + login.data.accessToken, 'content-type': 'application/json', origin: ORIGIN };
  r = await fetch(A + '/months/2026-10/open', { method: 'POST', headers: H, body: '{}' }); ok(r.status === 200, 'abrir mês 2026-10');
  r = await fetch(A + '/incomes', { method: 'POST', headers: H, body: JSON.stringify({ ym: '2026-10', name: 'Salário', amountCents: 500000, recurring: true }) }); ok(r.status === 201, 'criar renda (R$ 5.000,00 = 500000 centavos)');
  r = await fetch(A + '/expenses', { method: 'POST', headers: H, body: JSON.stringify({ ym: '2026-10', name: 'Aluguel', amountCents: 150050, recurring: true, dueDay: 5 }) }); ok(r.status === 201, 'criar despesa (R$ 1.500,50)');
  r = await fetch(A + '/reports/summary?ym=2026-10', { headers: H }); const sum = (await j(r)).data;
  ok(sum.incomeCents === 500000 && sum.expensesCents === 150050 && sum.balanceCents === 349950 && sum.committedPercent === 30, `resumo correto: sobra ${sum.balanceCents} centavos, ${sum.committedPercent}% comprometido`);

  r = await fetch(W + '/api/auth/refresh', { method: 'POST', headers: { origin: ORIGIN, cookie: cookie1 } });
  const ref = await j(r); const cookie2 = (r.headers.get('set-cookie') || '').split(';')[0];
  ok(r.status === 200 && ref.data.accessToken && cookie2 && cookie2 !== cookie1, 'refresh pelo site ROTACIONA o cookie');
  r = await fetch(W + '/api/auth/refresh', { method: 'POST', headers: { origin: ORIGIN, cookie: cookie1 } });
  ok(r.status === 401 && /Max-Age=0/.test(r.headers.get('set-cookie') || ''), 'reutilizar o cookie antigo => 401 e cookie apagado (detecção de roubo)');
  r = await fetch(W + '/api/auth/refresh', { method: 'POST', headers: { origin: ORIGIN, cookie: cookie2 } });
  ok(r.status === 401, 'e a sessão inteira foi derrubada por precaução');

  // trocar senha passando pelo servidor do site (precisa trocar o cookie junto)
  r = await fetch(W + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify({ email, password }) });
  const l2 = await j(r); const ck = (r.headers.get('set-cookie') || '').split(';')[0];
  r = await fetch(W + '/api/auth/change-password', { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, authorization: 'Bearer ' + l2.data.accessToken }, body: JSON.stringify({ currentPassword: password, newPassword: 'Outra-Senha-789' }) });
  const ckNew = (r.headers.get('set-cookie') || '').split(';')[0];
  ok(r.status === 200 && ckNew && ckNew !== ck, 'trocar senha pelo site entrega um cookie NOVO');
  r = await fetch(W + '/api/auth/refresh', { method: 'POST', headers: { origin: ORIGIN, cookie: ck } }); ok(r.status === 401, 'cookie antigo (pré-troca de senha) deixa de valer');
  r = await fetch(W + '/api/auth/refresh', { method: 'POST', headers: { origin: ORIGIN, cookie: ckNew } }); ok(r.status === 200, 'cookie novo renova normalmente');
  r = await fetch(W + '/api/auth/logout', { method: 'POST', headers: { origin: ORIGIN } }); ok(r.status === 204, 'logout sem cookie não quebra');
  console.log(`\n${n} verificações`);
})().catch((e) => { console.error('FALHA NO SCRIPT', e); process.exit(2); });
