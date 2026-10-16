// Teste de interação num Chrome de verdade, em desktop e celular. Requer: npm i puppeteer-core @sparticuz/chromium (fora do projeto; SHOT_MODULES aponta o node_modules)
const path = require('path'); const base = process.env.SHOT_MODULES || '/tmp/shot/node_modules';
const chromium = require(path.join(base, '@sparticuz/chromium')); const puppeteer = require(path.join(base, 'puppeteer-core'));
const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist-demo', 'minhas-despesas-previa.html'));
let n = 0, bad = 0; const ok = (c, m) => { n++; if (!c) bad++; console.log((c ? '✅ ' : '❌ ') + m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox', '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: 'shell' });
  async function open(w, h, mobile, hash = 'mensal') { const p = await browser.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); await p.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile }); await p.goto('file://' + file + '#/' + hash + (hash.includes('?') ? '' : '?notutorial')); await p.waitForSelector('[data-testid="balance"], h1', { timeout: 8000 }); await sleep(500); p.errs = errs; return p; }
  const vis = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }, sel);
  const clickLabel = (p, label) => p.evaluate((l) => { const e = [...document.querySelectorAll('button,a')].find((x) => (x.getAttribute('aria-label') || x.textContent || '').trim() === l && getComputedStyle(x).display !== 'none' && x.getBoundingClientRect().width > 0); if (!e) return false; e.click(); return true; }, label);
  const typeIn = async (p, label, text) => { const h = await p.evaluateHandle((l) => [...document.querySelectorAll('[role=dialog] input')].find((i) => (document.querySelector(`label[for="${i.id}"]`)?.textContent || i.getAttribute('aria-label')) === l), label); await h.asElement().click({ clickCount: 3 }); await h.asElement().type(text); };
  const dialogOpen = (p) => p.evaluate(() => !!document.querySelector('[role=dialog]'));

  console.log('\n=== DESKTOP 1440×900 ===');
  let p = await open(1440, 900, false);
  ok(await vis(p, '.sidebar') && !(await vis(p, '.bnav')), 'desktop: barra lateral visível e menu inferior oculto');
  ok((await p.evaluate(() => document.querySelector('.side-link[aria-current=page]')?.textContent)) === 'Mensal', 'desktop: item "Mensal" marcado como página atual');
  ok(await clickLabel(p, 'Nova despesa') && (await p.waitForSelector('[role=dialog]', { timeout: 3000 }).then(() => true).catch(() => false)), 'desktop: "Nova despesa" abre a janela');
  ok(await p.evaluate(() => { const r = document.querySelector('.sheet').getBoundingClientRect(); return r.top > 30 && r.bottom < innerHeight - 30; }), 'desktop: janela fica centralizada (não encosta nas bordas)');
  ok(await p.evaluate(() => document.activeElement?.closest('[role=dialog]') !== null), 'a11y: foco entra na janela ao abrir');
  for (let i = 0; i < 14; i++) await p.keyboard.press('Tab'); ok(await p.evaluate(() => document.activeElement?.closest('[role=dialog]') !== null), 'a11y: Tab não escapa da janela (foco preso)');
  await p.keyboard.press('Escape'); await sleep(200); ok(!(await dialogOpen(p)), 'a11y: Esc fecha a janela');
  ok(await p.evaluate(() => document.activeElement?.textContent?.includes('Nova despesa')), 'a11y: foco volta ao botão que abriu a janela');
  await clickLabel(p, 'Nova despesa'); await p.waitForSelector('[role=dialog]'); await p.click('[role=dialog] button.btn[type=submit], [role=dialog] .form-actions .btn:last-child'); await sleep(300);
  ok(await p.evaluate(() => !!document.querySelector('[role=dialog] .field-error')), 'form: enviar vazio mostra erro de campo (não envia)');
  await typeIn(p, 'Nome', 'Padaria teste'); await typeIn(p, 'Valor (R$)', '1.234,56'); await p.click('[role=dialog] .form-actions .btn:last-child'); await sleep(500);
  ok(!(await dialogOpen(p)), 'form: salvar fecha a janela');
  ok(await p.evaluate(() => !!document.querySelector('[aria-label="Editar despesa Padaria teste"]')), 'lista: nova despesa aparece na hora');
  ok(await p.evaluate(() => /R\$\s?1\.234,56/.test(document.querySelector('[aria-label="Editar despesa Padaria teste"]').textContent)), 'lista: valor formatado em R$ 1.234,56');
  ok(await p.evaluate(() => !!document.querySelector('.toast')), 'aviso de sucesso (toast) aparece');
  await clickLabel(p, 'Editar despesa Padaria teste'); await p.waitForSelector('[role=dialog]'); await typeIn(p, 'Valor (R$)', '99,90'); await p.click('[role=dialog] .form-actions .btn:last-child'); await sleep(500);
  ok(await p.evaluate(() => /R\$\s?99,90/.test(document.querySelector('[aria-label="Editar despesa Padaria teste"]').textContent)), 'editar: novo valor aparece na lista');
  await clickLabel(p, 'Editar despesa Padaria teste'); await p.waitForSelector('[role=dialog]'); await p.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.includes('Excluir')).click()); await sleep(150);
  await p.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.includes('Confirmar exclusão')).click()); await sleep(500);
  ok(await p.evaluate(() => !document.querySelector('[aria-label="Editar despesa Padaria teste"]')), 'excluir (2 passos): despesa some da lista');
  await p.keyboard.press('/'); await p.waitForSelector('[role=dialog] input'); await p.keyboard.type('alug'); await sleep(700);
  ok(await p.evaluate(() => [...document.querySelectorAll('.search-results .item')].length > 0), 'busca: atalho "/" abre e encontra resultados');
  await p.keyboard.press('Escape'); await sleep(150);
  ok(await clickLabel(p, 'Mudar para o tema escuro') && (await sleep(500), await p.evaluate(() => document.documentElement.dataset.theme === 'dark')), 'tema: alternar para escuro aplica data-theme=dark');
  ok(await p.evaluate(() => getComputedStyle(document.body).backgroundColor === 'rgb(12, 13, 9)'), 'tema escuro: fundo muda para #0C0D09');
  ok(await clickLabel(p, 'Ocultar valores') && (await sleep(300), await p.evaluate(() => /••••••/.test(document.querySelector('[data-testid=balance]').textContent))), 'privacidade: "Ocultar valores" mascara o saldo');
  for (const [label, h1] of [['Cartões', 'Cartões'], ['Visão anual', 'Visão anual'], ['Agenda', 'Agenda'], ['Investimentos', 'Investimentos'], ['Cripto', 'Cripto'], ['Configurações', 'Configurações'], ['Apoie o projeto', 'Apoie o projeto']]) {
    await p.evaluate((l) => [...document.querySelectorAll('.sidebar a')].find((a) => a.textContent.trim() === l).click(), label); await sleep(450);
    ok(await p.evaluate((t) => document.querySelector('h1')?.textContent === t && document.querySelector('.side-link[aria-current=page]')?.textContent.trim() === t, h1), `navegação lateral → ${label}`);
  }
  ok(p.errs.length === 0, 'sem erros de JavaScript no desktop' + (p.errs.length ? ': ' + p.errs[0] : '')); await p.close();

  console.log('\n=== CELULAR 390×844 ===');
  p = await open(390, 844, true);
  ok(!(await vis(p, '.sidebar')) && (await vis(p, '.bnav')), 'celular: menu inferior visível e barra lateral oculta');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'celular: sem rolagem horizontal');
  ok(await p.evaluate(() => { const r = document.querySelector('.bnav').getBoundingClientRect(); return r.bottom <= innerHeight && r.top > innerHeight - 100; }), 'celular: menu inferior ancorado na base');
  ok(await p.evaluate(() => [...document.querySelectorAll('.bnav .b-item,.bnav .fab')].every((e) => e.getBoundingClientRect().height >= 44)), 'toque: itens do menu inferior com 44px ou mais');
  ok(await p.evaluate(() => [...document.querySelectorAll('.mensal-head .icon-btn,.mensal-head .m-arrow,.m-chip')].every((e) => e.getBoundingClientRect().width >= 40 && e.getBoundingClientRect().height >= 40)), 'toque: botões do topo e meses com 40px ou mais');
  ok(await clickLabel(p, 'Nova despesa') && (await p.waitForSelector('.sheet', { timeout: 3000 }).then(() => true).catch(() => false)), 'celular: botão "+" abre a folha de nova despesa');
  await sleep(450);
  ok(await p.evaluate(() => { const r = document.querySelector('.sheet').getBoundingClientRect(); return Math.abs(r.bottom - innerHeight) < 2 && Math.abs(r.width - innerWidth) < 2; }), 'celular: formulário vira folha colada na base, largura total');
  ok(await p.evaluate(() => [...document.querySelectorAll('.sheet input')].every((i) => parseFloat(getComputedStyle(i).fontSize) >= 16 && i.getBoundingClientRect().height >= 44)), 'celular: campos com fonte ≥16px (sem zoom no iOS) e altura ≥44px');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'celular: folha aberta sem overflow horizontal');
  await p.keyboard.press('Escape'); await sleep(150);
  ok(await clickLabel(p, 'Mais opções') && (await p.waitForSelector('.sheet .more-list', { timeout: 3000 }).then(() => true).catch(() => false)), 'celular: "Mais" abre a lista de áreas e ações rápidas');
  await p.evaluate(() => [...document.querySelectorAll('.sheet a')].find((a) => a.textContent.includes('Agenda')).click()); await sleep(600);
  ok(await p.evaluate(() => document.querySelector('h1')?.textContent === 'Agenda' && !document.querySelector('[role=dialog]')), 'celular: escolher "Agenda" navega e fecha a folha');
  ok(p.errs.length === 0, 'sem erros de JavaScript no celular' + (p.errs.length ? ': ' + p.errs[0] : '')); await p.close();
  await browser.close(); console.log(`\n${n} verificações, ${bad} falha(s)`); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('FALHA', e.message); process.exit(2); });
