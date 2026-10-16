// Chrome real: tutorial de primeiro acesso, seletor de ícone/cor e renda principal (desktop e celular). Requer puppeteer-core + @sparticuz/chromium (SHOT_MODULES).
const path = require('path'); const base = process.env.SHOT_MODULES || '/tmp/shot/node_modules';
const chromium = require(path.join(base, '@sparticuz/chromium')); const puppeteer = require(path.join(base, 'puppeteer-core'));
const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist-demo', 'minhas-despesas-previa.html')); const shots = process.env.SHOTS || '/tmp/shot/out';
let n = 0, bad = 0; const ok = (c, m) => { n++; if (!c) bad++; console.log((c ? '✅ ' : '❌ ') + m); }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox', '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: 'shell' });
  async function open(w, h, mobile, hash) { const p = await b.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); await p.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile }); await p.goto('file://' + file + '#/' + hash); await p.waitForSelector('[data-testid="balance"], [role=dialog]', { timeout: 8000 }); await sleep(700); return p; }
  const clickIn = (p, scope, text) => p.evaluate((s, t) => { const e = [...document.querySelectorAll(s + ' button')].find((x) => (x.getAttribute('aria-label') || x.textContent).trim().startsWith(t)); if (!e) return false; e.click(); return true; }, scope, text);
  const title = (p) => p.evaluate(() => document.querySelector('[role=dialog] h2')?.textContent);
  for (const [label, w, h, mobile] of [['DESKTOP 1440×900', 1440, 900, false], ['CELULAR 390×844', 390, 844, true]]) {
    console.log(`\n=== TUTORIAL · ${label} ===`); const tag = mobile ? 'mobile' : 'desktop';
    let p = await open(w, h, mobile, 'mensal?tutorial');
    ok(await p.evaluate(() => !!document.querySelector('[role=dialog]')), 'abre sozinho para quem é novo');
    const titles = []; for (let k = 0; k < 6; k++) { titles.push(await title(p)); if (k === 0 || k === 1 || k === 2 || k === 5) { await sleep(450); await p.screenshot({ path: `${shots}/tutorial-${tag}-${k + 1}.png` }); } if (k < 5) { await clickIn(p, '[role=dialog]', 'Próximo'); await sleep(200); } }
    ok(new Set(titles).size === 6, '6 passos, cada um com título próprio');
    const g = await p.evaluate(() => { const s = document.querySelector('.sheet').getBoundingClientRect(); const btns = [...document.querySelectorAll('.tut-actions button')].map((x) => x.getBoundingClientRect()); return { inside: s.left >= 0 && s.right <= innerWidth + 0.5 && s.top >= 0, bottom: Math.round(innerHeight - s.bottom), ovf: document.documentElement.scrollWidth > innerWidth, minH: Math.min(...btns.map((x) => x.height)), art: document.querySelector('.tut-art').scrollWidth <= document.querySelector('.tut-art').clientWidth + 1 }; });
    ok(g.inside && !g.ovf && g.art, 'cabe na tela, sem rolagem horizontal e sem figura estourando');
    ok(g.minH >= 40, `botões do tutorial com altura ≥40px (${Math.round(g.minH)}px)`);
    if (mobile) ok(g.bottom < 2, 'celular: o tutorial é uma folha colada na base'); else ok(g.bottom > 20, 'desktop: o tutorial é uma janela centralizada');
    await clickIn(p, '[role=dialog]', 'Começar a usar'); await sleep(400); ok(await p.evaluate(() => !document.querySelector('[role=dialog]') && !!document.querySelector('[data-testid=balance]')), 'concluir fecha o tutorial e deixa o painel utilizável');
    ok(p.errs.length === 0, 'sem erros de JavaScript' + (p.errs[0] ? ': ' + p.errs[0] : '')); await p.close();
    p = await open(w, h, mobile, 'mensal?tutorial'); await clickIn(p, '[role=dialog]', 'Pular tutorial'); await sleep(300); ok(await p.evaluate(() => !document.querySelector('[role=dialog]')), '"Pular tutorial" fecha na hora'); await p.close();
    p = await open(w, h, mobile, 'mensal?tutorial'); await p.keyboard.press('ArrowRight'); await sleep(200); const t2 = await title(p); await p.keyboard.press('Escape'); await sleep(300);
    ok(t2 === 'Comece pelas suas rendas' && !(await p.evaluate(() => !!document.querySelector('[role=dialog]'))), 'seta → avança e Esc fecha'); await p.close();

    console.log(`\n=== ÍCONE E COR · ${label} ===`);
    p = await open(w, h, mobile, 'mensal?notutorial'); const tileBefore = await p.evaluate(() => document.querySelector('[aria-label="Editar despesa Mercado"] .tile-ico').innerHTML);
    await p.evaluate(() => document.querySelector('[aria-label="Editar despesa Mercado"]').click()); await p.waitForSelector('[role=dialog]'); await sleep(450);
    await p.evaluate(() => document.querySelector('.icon-pick').click()); await sleep(200); await p.evaluate(() => document.querySelector('#icon-panel').scrollIntoView({ block: 'nearest' })); await sleep(250);
    const grid = await p.evaluate(() => { const gs = [...document.querySelectorAll('#icon-panel .ig')]; const panel = document.querySelector('#icon-panel').getBoundingClientRect(); return { count: gs.length, minSize: Math.min(...gs.map((x) => Math.min(x.getBoundingClientRect().width, x.getBoundingClientRect().height))), svgs: gs.every((x) => x.querySelector('svg')), emoji: gs.some((x) => /[\u{1F300}-\u{1FAFF}]/u.test(x.textContent)), inside: panel.right <= innerWidth + 0.5 && panel.left >= 0, ovf: document.documentElement.scrollWidth > innerWidth, sw: [...document.querySelectorAll('#icon-panel .sw')].every((x) => x.getBoundingClientRect().width >= 36) }; });
    ok(grid.count === 34 && grid.svgs && !grid.emoji, `seletor com 34 ícones de linha (SVG), nenhum emoji`);
    ok(grid.minSize >= 40, `ícones tocáveis (menor lado ${Math.round(grid.minSize)}px) e cores ≥36px`); ok(grid.inside && !grid.ovf && grid.sw, 'painel cabe na largura da tela, sem overflow');
    await p.screenshot({ path: `${shots}/icones-${tag}.png` });
    await clickIn(p, '#icon-panel', 'Moradia'); await clickIn(p, '#icon-panel', 'Cor #B85C38'); await sleep(150);
    ok(await p.evaluate(() => document.querySelector('.icon-pick').textContent.includes('Moradia') && document.querySelector('.icon-pick .tile-ico').style.getPropertyValue('--c') === '#B85C38'), 'a pré-visualização muda para o ícone e a cor escolhidos');
    await clickIn(p, '[role=dialog]', 'Salvar'); await sleep(700);
    const after = await p.evaluate(() => ({ html: document.querySelector('[aria-label="Editar despesa Mercado"] .tile-ico').innerHTML, c: document.querySelector('[aria-label="Editar despesa Mercado"] .tile-ico').style.getPropertyValue('--c') }));
    ok(after.html !== tileBefore && after.c === '#B85C38', 'a lista passa a mostrar o novo ícone e a nova cor'); ok(p.errs.length === 0, 'sem erros de JavaScript'); await p.close();

    console.log(`\n=== RENDA PRINCIPAL · ${label} ===`);
    p = await open(w, h, mobile, 'mensal?notutorial'); const first = () => p.evaluate(() => document.querySelector('section[aria-label=Rendas] li')?.textContent);
    ok(/Principal/.test((await first()) || '') && /Salário/.test((await first()) || ''), 'a principal (Salário) aparece primeiro com o selo "Principal"');
    ok(await p.evaluate(() => /Salário/.test(document.querySelector('[data-testid=principal-pill]')?.textContent || '')), 'o resumo mostra a renda principal');
    await p.evaluate(() => document.querySelector('section[aria-label=Rendas]').scrollIntoView({ block: 'center' })); await sleep(250); await p.screenshot({ path: `${shots}/rendas-${tag}.png` });
    const clicked = await p.evaluate(() => { const bt = [...document.querySelectorAll('section[aria-label=Rendas] button.star')][0]; if (!bt) return null; const r = bt.getBoundingClientRect(); const label = bt.getAttribute('aria-label'); bt.click(); return { label, w: r.width, h: r.height }; });
    await sleep(700); ok(clicked && clicked.w >= 40 && clicked.h >= 40, clicked ? `estrela com área de toque de ${Math.round(clicked.w)}×${Math.round(clicked.h)}px` : 'não achei outra renda para tornar principal (a prévia tem Freela só em alguns meses)');
    if (clicked) { const f = (await first()) || ''; ok(!/Salário/.test(f) && /Principal/.test(f), 'depois da estrela, a outra renda vira a principal e sobe para o topo'); ok(await p.evaluate(() => !/Salário/.test(document.querySelector('[data-testid=principal-pill]').textContent)), 'o selo do resumo acompanha a troca'); ok(await p.evaluate(() => document.querySelectorAll('section[aria-label=Rendas] .star.on').length === 1), 'continua existindo exatamente UMA principal'); }
    await p.evaluate(() => [...document.querySelectorAll('section[aria-label=Rendas] button.item')][0].click()); await p.waitForSelector('[role=dialog]'); await sleep(400);
    ok(await p.evaluate(() => { const sw = document.querySelector('[role=dialog] [role=switch][aria-label="Renda principal"]'); return sw && sw.disabled && sw.getAttribute('aria-checked') === 'true'; }), 'no formulário da principal, a chave fica marcada e travada'); ok(p.errs.length === 0, 'sem erros de JavaScript'); await p.close();
  }
  await b.close(); console.log(`\n${n} verificações, ${bad} falha(s)`); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('FALHA', e.message); process.exit(2); });
