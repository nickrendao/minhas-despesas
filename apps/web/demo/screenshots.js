// Fotografa a prévia em vários tamanhos e MEDE overflow horizontal. Requer (fora do projeto):  npm i puppeteer-core @sparticuz/chromium
// Uso: node demo/screenshots.js [arquivo.html] [pasta-saida] [rotas,separadas,por,vírgula]
const path = require('path'); const fs = require('fs');
const base = process.env.SHOT_MODULES || '/tmp/shot/node_modules';
const chromium = require(path.join(base, '@sparticuz/chromium')); const puppeteer = require(path.join(base, 'puppeteer-core'));
const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist-demo', 'minhas-despesas-previa.html'));
const out = process.argv[3] || '/tmp/shot/out'; fs.mkdirSync(out, { recursive: true });
const routes = (process.argv[4] || 'mensal,cartao,anual,agenda,investir,cripto,config,apoie,login').split(',');
const sizes = [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile', 390, 844]]; const themes = (process.env.THEMES || 'light,dark').split(',');
(async () => {
  const browser = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox', '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: 'shell' });
  let problems = 0;
  for (const [sname, w, h] of sizes) for (const theme of themes) for (const r of routes) {
    const page = await browser.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(e.message.slice(0, 120))); page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|status of 403/.test(m.text())) errs.push('console: ' + m.text().slice(0, 120)); });
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: sname === 'mobile', hasTouch: sname === 'mobile' });
    await page.goto('file://' + file + '#/' + r + (r.includes('?') ? '' : '?notutorial'), { waitUntil: 'load' }); await new Promise((x) => setTimeout(x, 1200));
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme); await new Promise((x) => setTimeout(x, 250));
    const rep = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth; const bad = [];
      const scrollable = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return p !== document.body && p !== document.documentElement; } return false; };
      for (const el of document.querySelectorAll('body *')) { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.position === 'fixed') continue; const r = el.getBoundingClientRect(); if (r.width && r.right > vw + 1 && !scrollable(el)) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)} → ${Math.round(r.right)}px "${(el.textContent || '').trim().slice(0, 24)}"`); }
      const small = [...document.querySelectorAll('button,a[href],input,select,[role=button],[role=tab],[role=switch]')].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width && cs.display !== 'none' && cs.visibility !== 'hidden' && (r.height < 40 || r.width < 40) && cs.position !== 'static' || (r.width && cs.display !== 'none' && r.height < 32); }).slice(0, 4).map((e) => `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 18)}" ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
      return { vw, docW: document.documentElement.scrollWidth, bad: bad.slice(0, 5), small };
    });
    const fn = `${out}/${r}-${sname}-${theme}.png`; await page.screenshot({ path: fn, fullPage: true });
    const flag = rep.docW > rep.vw + 1 || rep.bad.length || errs.length; if (flag) problems++;
    console.log(`${flag ? '⚠️ ' : '✅'} ${r.padEnd(8)} ${sname.padEnd(7)} ${theme.padEnd(5)} doc=${rep.docW}/${rep.vw}${rep.bad.length ? ' OVERFLOW: ' + rep.bad.join(' | ') : ''}${errs.length ? ' ERROS: ' + errs.join(' | ') : ''}`);
    await page.close();
  }
  await browser.close(); console.log(`\n${problems} combinação(ões) com problema`); process.exit(problems ? 1 : 0);
})().catch((e) => { console.error('FALHA', e.message); process.exit(2); });
