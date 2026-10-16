// Gera os ativos de marca (logo B "A sobra") a partir do desenho vetorial aprovado: favicon, ícones do app (any + maskable), ícone do iPhone e imagem de compartilhamento.
// Requer (fora do projeto): npm i puppeteer-core @sparticuz/chromium   (SHOT_MODULES aponta o node_modules).   Uso: node scripts/make-brand-assets.js <pasta-de-saida>
const fs = require('fs'), path = require('path'); const base = process.env.SHOT_MODULES || '/tmp/shot/node_modules';
const chromium = require(path.join(base, '@sparticuz/chromium')); const puppeteer = require(path.join(base, 'puppeteer-core'));
const out = path.resolve(process.argv[2] || 'brand-out'); fs.mkdirSync(out, { recursive: true });
const GREEN = '#009929', INK = '#14150D';
const MARK = `<rect x="11" y="36" width="11" height="16" rx="5.5" fill="${INK}"/><rect x="26.5" y="26" width="11" height="26" rx="5.5" fill="${INK}"/><rect x="42" y="34" width="11" height="18" rx="5.5" fill="${INK}"/><circle cx="47.5" cy="19" r="6.5" fill="${INK}"/>`;
const tile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${GREEN}"/>${MARK}</svg>`;
const bleed = (s) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${GREEN}"/><g transform="translate(32 32) scale(${s}) translate(-32 -32)">${MARK}</g></svg>`;
const fonts = fs.readFileSync(path.join(__dirname, '../apps/web/demo/fonts.css'), 'utf8');
const og = `<!doctype html><meta charset="utf-8"><style>${fonts}*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;background:${INK};color:#F3F3EA;font-family:'Geist',sans-serif;position:relative;overflow:hidden}
.ring{position:absolute;right:-170px;bottom:-190px;width:620px;height:620px;border-radius:50%;border:80px solid #1E2016}.ring2{position:absolute;right:120px;top:90px;width:150px;height:150px;border-radius:50%;background:#1E2016}
.brand{position:absolute;left:84px;top:70px;display:flex;align-items:center;gap:22px;font:800 40px 'Bricolage Grotesque';letter-spacing:-.02em}.brand svg{width:84px;height:84px}
h1{position:absolute;left:84px;top:238px;font:800 100px/1.02 'Bricolage Grotesque';letter-spacing:-.045em}h1 em{font-style:normal;color:#2FBF4F}
p{position:absolute;left:84px;bottom:70px;font-size:30px;color:#B5B6A5}</style>
<div class="ring"></div><div class="ring2"></div><div class="brand">${tile}Minhas Despesas</div><h1>Seu dinheiro,<br><em>sem complicação.</em></h1><p>Despesas, cartões e metas num só lugar. Simples, rápido e grátis.</p>`;
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox'], executablePath: await chromium.executablePath(), headless: 'shell' });
  const png = async (name, svg, size, transparent) => { const p = await b.newPage(); await p.setViewport({ width: size, height: size }); await p.setContent(`<body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div></body>`); await p.screenshot({ path: path.join(out, name), omitBackground: transparent }); await p.close(); };
  fs.writeFileSync(path.join(out, 'icon.svg'), tile);
  for (const [n, s] of [['favicon-16.png', 16], ['favicon-32.png', 32], ['icon-192.png', 192], ['icon-512.png', 512]]) await png(n, tile, s, true);       // ícone "any": tile com cantos arredondados, fundo transparente
  await png('icon-maskable-512.png', bleed(0.62), 512, false);                                                                                      // Android recorta em círculo/squircle: conteúdo na zona segura (62%)
  await png('apple-touch-icon.png', bleed(0.8), 180, false);                                                                                        // iOS aplica o próprio arredondamento: sem transparência
  const p = await b.newPage(); await p.setViewport({ width: 1200, height: 630 }); await p.setContent(og); await new Promise((r) => setTimeout(r, 600)); await p.screenshot({ path: path.join(out, 'og-image.png') });
  await b.close(); console.log('gerado em', out, fs.readdirSync(out).join(', '));
})().catch((e) => { console.error('FALHA', e.message); process.exit(1); });
