// Teste do SITE REAL (Next.js + API + banco) num Chrome de verdade. Requer API (3333) e site (3000) em produção, com REQUIRE_EMAIL_VERIFICATION=false,
// e: npm i puppeteer-core @sparticuz/chromium  (SHOT_MODULES aponta o node_modules).  Uso: node scripts/e2e-real-browser.js
const path = require('path'); const base = process.env.SHOT_MODULES || '/tmp/shot/node_modules'; const chromium = require(path.join(base, '@sparticuz/chromium')); const puppeteer = require(path.join(base, 'puppeteer-core'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let n = 0, bad = 0; const ok = (c, m) => { n++; if (!c) bad++; console.log((c ? '✅ ' : '❌ ') + m); };
const email = `real${Date.now()}@teste.com`, password = 'Senha-Forte-123';
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox'], executablePath: await chromium.executablePath(), headless: 'shell' });
  const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|403|ERR_/.test(m.text())) errs.push(m.text().slice(0, 140)); });
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('http://localhost:3000/login'); await p.waitForSelector('h1'); 
  // criar conta pela tela
  await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((t) => t.textContent === 'Criar conta').click()); await sleep(200);
  await p.type('input[type=email]', email); const pw = await p.$$('input[autocomplete=new-password]'); await pw[0].type(password); await pw[1].type(password);
  await p.evaluate(() => [...document.querySelectorAll('form button')].find((x) => x.textContent.includes('Criar conta')).click()); await sleep(1500);
  ok(await p.evaluate(() => /Conta criada/.test(document.body.textContent)), 'tela real: criar conta mostra a confirmação');
  const emailVal = await p.$eval('input[type=email]', (e) => e.value); console.log('   (e-mail no campo após criar conta:', emailVal === email ? 'igual ao digitado — mantido' : emailVal, ')');
  await p.type('input[autocomplete=current-password]', password);
  await p.evaluate(() => [...document.querySelectorAll('form button')].find((x) => x.textContent.includes('Entrar')).click());
  await p.waitForSelector('[data-testid=balance]', { timeout: 15000 }); ok(p.url().endsWith('/mensal'), 'entrar leva ao painel Mensal (URL /mensal)');
  const ck = (await p.cookies('http://localhost:3000/api/auth/refresh')).find((c) => c.name === 'fin_rt');   /* o cookie é restrito a /api/auth */ ok(!!ck && ck.httpOnly && ck.sameSite === 'Lax' && ck.path === '/api/auth', 'cookie de sessão: HttpOnly + SameSite=Lax + restrito a /api/auth');
  ok(await p.evaluate(() => !document.cookie.includes('fin_rt') && !JSON.stringify(localStorage).includes('token')), 'JavaScript da página NÃO enxerga o cookie de sessão nem guarda token no localStorage');
  ok(await p.waitForSelector('[role=dialog]', { timeout: 8000 }).then(() => true).catch(() => false) && /Bem-vindo/.test(await p.evaluate(() => document.querySelector('[role=dialog] h2')?.textContent || '')), 'conta nova: o TUTORIAL de primeiro acesso abre sozinho');
  await p.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === 'Pular tutorial').click()); await sleep(1200);
  await p.reload({ waitUntil: 'load' }); await p.waitForSelector('[data-testid=balance]', { timeout: 15000 }); await sleep(1500);
  ok(await p.evaluate(() => !document.querySelector('[role=dialog]')), 'depois de pular e RECARREGAR, o tutorial NÃO volta (o "visto" ficou gravado na conta, no banco)');
  ok(await p.evaluate(() => /Seus primeiros passos|Defina uma renda|Nenhuma/.test(document.body.textContent)), 'conta nova: painel mostra estados vazios (sem dados inventados)');
  
  // lançar despesa
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Nova despesa').click()); await p.waitForSelector('[role=dialog]');
  const ins = await p.$$('[role=dialog] input'); await ins[0].type('Aluguel real'); await ins[1].type('1.500,00');
  await p.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === 'Adicionar').click()); await sleep(1200);
  ok(await p.evaluate(() => !!document.querySelector('[aria-label="Editar despesa Aluguel real"]')), 'despesa criada pela tela aparece na lista (gravada na API real)');
  ok(await p.evaluate(() => /1\.500,00/.test(document.querySelector('[data-testid=expenses]').textContent)), 'resumo calculado pelo servidor: despesas = R$ 1.500,00');
  // ---- ÍCONE E COR: trocar pela tela e conferir que PERSISTE no banco ----
  await p.evaluate(() => document.querySelector('[aria-label="Editar despesa Aluguel real"]').click()); await p.waitForSelector('[role=dialog]'); await sleep(300);
  const antes = await p.evaluate(() => document.querySelector('.icon-pick .tile-ico').innerHTML);
  await p.evaluate(() => document.querySelector('.icon-pick').click()); await sleep(150);
  await p.evaluate(() => { [...document.querySelectorAll('#icon-panel .ig')].find((x) => x.getAttribute('aria-label') === 'Moradia').click(); [...document.querySelectorAll('#icon-panel .sw')].find((x) => x.getAttribute('aria-label') === 'Cor #B85C38').click(); });
  await p.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === 'Salvar').click()); await sleep(1200);
  // ---- RENDAS: a 1ª nasce principal (decidido pelo servidor); a 2ª pode ser promovida; ordem e marcação persistem ----
  const novaRenda = async (nome, valor) => { await p.evaluate(() => [...document.querySelectorAll('section[aria-label=Rendas] button')].find((x) => x.textContent.includes('Nova renda')).click()); await p.waitForSelector('[role=dialog]'); const ins = await p.$$('[role=dialog] input'); await ins[0].type(nome); await ins[1].type(valor);
    await p.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === 'Adicionar').click()); await sleep(1300); };
  await novaRenda('Salário real', '5000'); await novaRenda('Freela real', '800');
  const rendas = () => p.evaluate(() => [...document.querySelectorAll('section[aria-label=Rendas] li')].map((li) => ({ nome: li.querySelector('.nm').textContent, principal: !!li.querySelector('.star.on') })));
  let r = await rendas(); ok(r.length === 2 && r[0].nome === 'Salário real' && r[0].principal && !r[1].principal, 'rendas pela tela: a primeira nasce PRINCIPAL (regra do servidor) e fica no topo');
  ok(await p.evaluate(() => /Salário real/.test(document.querySelector('[data-testid=principal-pill]')?.textContent || '')), 'o resumo mostra a renda principal');
  await p.evaluate(() => document.querySelector('section[aria-label=Rendas] button.star').click()); await sleep(1300);
  r = await rendas(); ok(r[0].nome === 'Freela real' && r[0].principal && r.filter((x) => x.principal).length === 1, 'estrela: a outra renda vira a principal, sobe ao topo e continua UMA só principal (no banco real)');
  // ---- renomear ----
  await p.evaluate(() => document.querySelector('[aria-label="Editar renda Freela real"]').click()); await p.waitForSelector('[role=dialog]'); const nome = await p.$('[role=dialog] input'); await nome.click({ clickCount: 3 }); await nome.type('Consultoria');
  await p.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === 'Salvar').click()); await sleep(1300);
  r = await rendas(); ok(r[0].nome === 'Consultoria' && r[0].principal, 'renomear: o nome novo vale e ela continua principal');
  // recarregar: sessão volta sozinha
  await p.reload({ waitUntil: 'load' }); await p.waitForSelector('[data-testid=balance]', { timeout: 15000 });
  ok(await p.evaluate(() => !!document.querySelector('[aria-label="Editar despesa Aluguel real"]')), 'recarregar a página: continua logado e a despesa persiste');
  
  r = await rendas(); ok(r.length === 2 && r[0].nome === 'Consultoria' && r[0].principal && !r[1].principal, 'depois de recarregar: renomeação, principal e ordem continuam gravadas');
  ok(await p.evaluate((ant) => { const t = document.querySelector('[aria-label="Editar despesa Aluguel real"] .tile-ico'); return t.innerHTML !== ant && t.style.getPropertyValue('--c') === '#B85C38'; }, antes), 'depois de recarregar: o ícone e a cor escolhidos continuam gravados');
  // ---- rever o tutorial pelas Configurações ----
  await p.evaluate(() => [...document.querySelectorAll('.sidebar a')].find((a) => a.textContent.trim() === 'Configurações').click()); await sleep(900);
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Rever o tutorial')).click()); await sleep(500);
  ok(await p.evaluate(() => /Bem-vindo/.test(document.querySelector('[role=dialog] h2')?.textContent || '')), '"Rever o tutorial" em Configurações reabre o tutorial');
  await p.keyboard.press('Escape'); await sleep(600);
  // sair
  const errsAntesDeSair = errs.length;
  await p.evaluate(() => document.querySelector('.side-user button').click()); await p.waitForFunction(() => location.pathname === '/login', { timeout: 8000 }); ok(true, 'sair da conta volta para /login');
  await p.goto('http://localhost:3000/mensal'); await p.waitForFunction(() => location.pathname === '/login', { timeout: 8000 }).then(() => ok(true, 'depois de sair, abrir /mensal redireciona ao login')).catch(() => ok(false, 'depois de sair, /mensal redireciona ao login'));
  ok(errsAntesDeSair === 0, 'sem erros no console durante o uso logado (nem 401 desnecessário)' + (errsAntesDeSair ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  await b.close(); console.log(`\n${n} verificações, ${bad} falha(s)`); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('FALHA', e.message.slice(0, 300)); process.exit(2); });
