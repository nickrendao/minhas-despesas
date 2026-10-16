// Chrome real contra o pacote PWA servido por HTTP com os cabeçalhos do arquivo _headers. Requer puppeteer-core + @sparticuz/chromium (SHOT_MODULES).
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os'); const base = process.env.SHOT_MODULES || '/tmp/shot/node_modules';
const chromium = require(path.join(base, '@sparticuz/chromium')); const puppeteer = require(path.join(base, 'puppeteer-core'));
const DIR = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist-pwa')); const PORT = 4173; const shots = process.env.SHOTS || '/tmp/shot/out';
let n = 0, bad = 0; const ok = (c, m) => { n++; if (!c) bad++; console.log((c ? '✅ ' : '❌ ') + m); }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
// servidor estático que aplica o _headers (formato Netlify/Cloudflare)
const rules = []; { let cur = null; for (const line of fs.readFileSync(path.join(DIR, '_headers'), 'utf8').split('\n')) { if (!line.trim() || line.startsWith('#')) continue; if (!/^\s/.test(line)) { cur = { path: line.trim(), h: {} }; rules.push(cur); } else { const i = line.indexOf(':'); cur.h[line.slice(0, i).trim()] = line.slice(i + 1).trim(); } } }
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(DIR, p); if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  const h = { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }; for (const r of rules) if (r.path === '/*' || r.path === p) Object.assign(h, r.h); res.writeHead(200, h); fs.createReadStream(f).pipe(res); });
const png = (f) => { const b = fs.readFileSync(path.join(DIR, f)); return b.slice(1, 4).toString() === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
(async () => {
  await new Promise((r) => server.listen(PORT, r)); const URL0 = `http://localhost:${PORT}/`;
  const b = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox'], executablePath: await chromium.executablePath(), headless: 'shell' });
  const open = async (o = {}) => { const p = await (o.ctx || b).newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text().slice(0, 140)); });
    await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); if (o.ua) await p.setUserAgent(o.ua); if (o.pre) await p.evaluateOnNewDocument(o.pre);
    await p.evaluateOnNewDocument(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
    await p.setRequestInterception(true); p.on('request', (r) => { const u = r.url(); if (/api\.coingecko\.com/.test(u)) return r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"bitcoin":{"brl":300000,"brl_24h_change":1.2}}' }); if (/^https?:\/\/(?!localhost)/.test(u)) return r.abort(); r.continue(); });
    await p.goto(URL0 + (o.hash || ''), { waitUntil: 'load' }); await p.waitForSelector('#root *'); await sleep(900); return p; };
  const click = (p, l, s = 'button,a') => p.evaluate((l, s) => { const e = [...document.querySelectorAll(s)].find((x) => ((x.getAttribute('aria-label') || x.textContent) || '').trim().startsWith(l) && x.getBoundingClientRect().width > 0); if (!e) return false; e.click(); return true; }, l, s);
  const fill = async (p, label, v) => { const h = await p.evaluateHandle((l) => [...document.querySelectorAll('[role=dialog] input')].find((i) => (document.querySelector(`label[for="${i.id}"]`)?.textContent || i.getAttribute('aria-label')) === l), label); await h.asElement().click({ clickCount: 3 }); await h.asElement().type(v); };

  console.log('=== 1) Pacote e cabeçalhos ===');
  const man = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.webmanifest'), 'utf8'));
  ok(man.display === 'standalone' && man.start_url === './' && man.scope === './' && man.name && man.short_name, 'manifesto: nome, tela cheia, início e escopo');
  ok(JSON.stringify(png('icon-192.png')) === '[192,192]' && JSON.stringify(png('icon-512.png')) === '[512,512]' && JSON.stringify(png('icon-maskable-512.png')) === '[512,512]' && JSON.stringify(png('apple-touch-icon.png')) === '[180,180]', 'ícones reais com os tamanhos certos (192, 512, 512 maskable e 180 do iPhone)');
  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8'); ok(/rel="manifest"/.test(html) && /apple-mobile-web-app-capable/.test(html) && /rel="apple-touch-icon"/.test(html) && /status-bar-style/.test(html), 'página com manifesto e marcações do iPhone');
  const r0 = await new Promise((res) => http.get(URL0, res)); ok(/default-src 'none'/.test(r0.headers['content-security-policy']) && r0.headers['x-content-type-options'] === 'nosniff' && r0.headers['referrer-policy'] === 'no-referrer', 'cabeçalhos de segurança aplicados (política de conteúdo, nosniff, sem referrer)');
  const rsw = await new Promise((res) => http.get(URL0 + 'sw.js', res)); ok(/no-cache/.test(rsw.headers['cache-control']), 'sw.js nunca fica em cache (atualizações chegam)');

  console.log('\n=== 2) Primeiro uso no navegador ===');
  let p = await open(); ok(await p.evaluate(() => /Bem-vindo/.test(document.querySelector('[role=dialog] h2')?.textContent || '')), 'abre no tutorial, do zero');
  ok((await p.evaluate(() => window.__csp)).length === 0 && p.errs.length === 0, `nenhuma violação da política de segurança nem erro de console${p.errs[0] ? ' — ' + p.errs[0] : ''}`);
  const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return { state: r.active && r.active.state, scope: r.scope }; }); ok(sw.state === 'activated' && sw.scope === URL0, `service worker ativo (escopo ${sw.scope})`);
  await p.reload({ waitUntil: 'load' }); await sleep(800); ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'e passa a controlar a página'); const cached = await p.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks[0]); return { ks, n: (await c.keys()).length }; });
  ok(cached.ks.length === 1 && /^md-[0-9a-f]{12}$/.test(cached.ks[0]) && cached.n >= 8, `cache da versão ${cached.ks[0]} com ${cached.n} arquivos`);
  const cdp = await p.target().createCDPSession(); const inst = await cdp.send('Page.getInstallabilityErrors'); ok(inst.installabilityErrors.length === 0, 'o Chrome considera o app INSTALÁVEL (sem nenhum erro de instalação)' + (inst.installabilityErrors[0] ? ': ' + JSON.stringify(inst.installabilityErrors[0]) : ''));
  console.log('\n=== 3) Usar, e usar SEM INTERNET ===');
  await click(p, 'Pular tutorial'); await sleep(400); await click(p, 'Nova renda'); await p.waitForSelector('[role=dialog]'); await fill(p, 'Nome', 'Salário'); await fill(p, 'Valor (R$)', '5000'); await click(p, 'Adicionar', '[role=dialog] button'); await sleep(500);
  ok(/5\.000,00/.test(await p.evaluate(() => document.querySelector('[data-testid=income]')?.textContent || '')), 'registrou uma renda');
  await p.setOfflineMode(true); await p.reload({ waitUntil: 'load' }); await p.waitForSelector('#root *', { timeout: 8000 }); await sleep(900);
  ok(/5\.000,00/.test(await p.evaluate(() => document.querySelector('[data-testid=income]')?.textContent || '')), 'SEM INTERNET: o app abre do cache e os dados continuam lá'); await p.setOfflineMode(false);
  await p.evaluate(() => { location.hash = '#/cripto'; }); await sleep(800); ok(!(await p.evaluate(() => document.body.innerText)).includes('Bem-vindo'), 'navegação normal depois do cache');
  const viol = await p.evaluate(async () => { try { await fetch('https://exemplo-malicioso.com/x'); return false; } catch { return true; } }); await sleep(200); ok(viol && (await p.evaluate(() => window.__csp)).some((x) => /connect-src/.test(x)), 'a política de segurança BLOQUEIA conexões a outros domínios (só a CoinGecko é permitida)');
  console.log('\n=== 4) Backup no navegador (download comum) ===');
  const dl = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-')); const cdp2 = await p.target().createCDPSession(); await cdp2.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
  await p.evaluate(() => { location.hash = '#/config'; }); await sleep(800); await click(p, 'Baixar backup completo'); for (let i = 0; i < 20 && !fs.readdirSync(dl).some((f) => f.endsWith('.json')); i++) await sleep(250);
  const f = fs.readdirSync(dl).find((x) => x.endsWith('.json')); const bj = f ? JSON.parse(fs.readFileSync(path.join(dl, f), 'utf8')) : null; ok(!!bj && bj.app === 'minhas-despesas-local' && /Salário/.test(JSON.stringify(bj)), `arquivo baixado sob a política de segurança: ${f || '(nenhum)'}`);
  { const v = (await p.evaluate(() => window.__csp)).filter((x) => !/exemplo-malicioso/.test(x)); const er = p.errs.filter((x) => !/exemplo-malicioso/.test(x)) /* só ignora o domínio que o PRÓPRIO teste tenta de propósito */; ok(v.length === 0 && er.length === 0, 'sem violações inesperadas durante o uso' + (v.length || er.length ? ' — violações: ' + JSON.stringify(v) + ' | erros: ' + JSON.stringify(p.errs) : '')); } await p.close();

  console.log('\n=== 5) iPhone (Safari simulado) ===');
  p = await open({ ua: IPHONE }); ok(await p.evaluate(() => !!document.querySelector('.install-hint')) && /Adicionar à Tela de Início/.test(await p.evaluate(() => document.querySelector('.install-hint').textContent)), 'no Safari do iPhone aparece a dica "Adicionar à Tela de Início"'); await p.screenshot({ path: `${shots}/pwa-ios-hint.png` });
  await click(p, 'Entendi'); await sleep(200); ok(await p.evaluate(() => !document.querySelector('.install-hint')), '"Entendi" fecha a dica'); await p.reload({ waitUntil: 'load' }); await sleep(900); ok(await p.evaluate(() => !document.querySelector('.install-hint')), 'e ela não volta'); await p.close();
  p = await open({ ua: IPHONE, pre: () => Object.defineProperty(navigator, 'standalone', { value: true }) }); ok(await p.evaluate(() => !document.querySelector('.install-hint')), 'já instalado (tela inicial): a dica não aparece'); await p.close();
  p = await open({ ua: IPHONE, pre: () => { window.__shared = []; Object.defineProperty(navigator, 'canShare', { value: () => true }); Object.defineProperty(navigator, 'share', { value: async (d) => { window.__shared.push({ name: d.files[0].name, type: d.files[0].type, size: d.files[0].size }); } }); }, hash: '#/config?x' });
  await click(p, 'Pular tutorial'); await sleep(300); await click(p, 'Baixar backup completo'); await sleep(900); const sh = await p.evaluate(() => window.__shared);
  ok(sh.length === 1 && sh[0].name === 'minhas-despesas-backup.json' && sh[0].type === 'application/json' && sh[0].size > 100, `iPhone: o backup abre a folha de compartilhar (${sh[0] ? sh[0].name + ', ' + sh[0].size + ' bytes' : 'nada'})`); await p.close();
  console.log('\n=== 6) Atualizações ===');
  const a = fs.readFileSync(path.join(DIR, 'sw.js'), 'utf8').match(/md-([0-9a-f]{12})/)[1]; const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pwa-')); fs.writeFileSync(path.join(tmp, 'app.html'), fs.readFileSync(path.join(DIR, '..', 'dist-local', 'minhas-despesas-local.html'), 'utf8').replace('</body>', '<!--v2--></body>'));
  require('child_process').execFileSync('node', [path.join(__dirname, 'build-pwa.js'), path.join(tmp, 'out')], { env: { ...process.env, PWA_SRC: path.join(tmp, 'app.html') }, stdio: 'ignore' }); const c2 = fs.readFileSync(path.join(tmp, 'out', 'sw.js'), 'utf8').match(/md-([0-9a-f]{12})/)[1]; ok(a !== c2, `outra versão do app gera outro service worker (${a} → ${c2}), então os celulares se atualizam`);
  ok(!/sw\.js|serviceWorker/.test(fs.readFileSync(path.join(DIR, '..', 'dist-local', 'minhas-despesas-local.html'), 'utf8')), 'o app do APK (dist-local) não tem service worker: só o pacote PWA');
  await b.close(); server.close(); console.log(`\n${n} verificações, ${bad} falha(s)`); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('FALHA', e.message); server.close(); process.exit(2); });
