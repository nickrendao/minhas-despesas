// Gera o pacote PWA (arquivos estáticos) do app local: sobe em qualquer hospedagem https (Netlify, Cloudflare Pages, GitHub Pages…). Sem servidor, sem banco.
// Pré-requisito: node local/build-local.js.  Uso: node local/build-pwa.js [pasta-de-saida]
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const web = path.join(__dirname, '..'); const src = process.env.PWA_SRC || path.join(web, 'dist-local', 'minhas-despesas-local.html'); const out = path.resolve(process.argv[2] || path.join(web, 'dist-pwa'));
if (!fs.existsSync(src)) { console.error('Falta ' + src + ' — rode antes: node local/build-local.js'); process.exit(1); }
let html = fs.readFileSync(src, 'utf8'); const version = crypto.createHash('sha256').update(html).digest('hex').slice(0, 12);   // muda quando o app muda -> o service worker se atualiza
const INK = '#14150D', PAPER = '#F2F1EA';
const headTags = `<meta name="theme-color" content="${PAPER}"><link rel="manifest" href="manifest.webmanifest"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Despesas"><meta name="apple-mobile-web-app-status-bar-style" content="default"><link rel="apple-touch-icon" href="apple-touch-icon.png"><link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">`;
const before = html; html = html.replace(`<meta name="theme-color" content="${INK}">`, headTags); if (html === before) { console.error('Não achei o theme-color para trocar: o modelo do HTML mudou.'); process.exit(1); }
const reg = `<script>if('serviceWorker' in navigator){addEventListener('load',function(){navigator.serviceWorker.register('./sw.js').catch(function(){})})}</script>`;
if (!html.includes('</body>')) { console.error('HTML sem </body>'); process.exit(1); } html = html.replace('</body>', reg + '</body>');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
const icons = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon-32.png']; for (const f of icons) fs.copyFileSync(path.join(web, 'public', f), path.join(out, f));
fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  id: './', name: 'Minhas Despesas', short_name: 'Despesas', description: 'Controle suas finanças mensais, cartões e investimentos. Seus dados ficam só neste aparelho.', lang: 'pt-BR',
  start_url: './', scope: './', display: 'standalone', orientation: 'portrait', background_color: PAPER, theme_color: PAPER, categories: ['finance', 'productivity'],
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
}, null, 2));
// service worker: o app funciona offline; cada versão nova tem seu próprio cache e apaga os antigos. Cotações (outro domínio) vão direto à rede.
fs.writeFileSync(path.join(out, 'sw.js'), `/* Minhas Despesas — service worker (versão ${version}) */
const CACHE = 'md-${version}';
const SHELL = ['./', './index.html', './manifest.webmanifest', ${icons.map((f) => `'./${f}'`).join(', ')}];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('md-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return; const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') { e.respondWith(caches.match('./index.html').then((hit) => hit || fetch(req))); return; }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })));
});
`);
fs.writeFileSync(path.join(out, '_headers'), `# Cabeçalhos de segurança (Netlify e Cloudflare Pages leem este arquivo). O app é um único HTML com script e estilo embutidos.
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src data:; img-src 'self' data: blob:; connect-src 'self' blob: https://api.coingecko.com; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
/index.html
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/manifest.webmanifest
  Cache-Control: no-cache
`);
fs.writeFileSync(path.join(out, 'LEIA-ME.txt'), `MINHAS DESPESAS — PACOTE PWA (app instalável, sem servidor)

COMO PUBLICAR (hospedagem estática, https):
  1. Suba o CONTEÚDO desta pasta (index.html, sw.js, manifest.webmanifest, ícones e _headers) para Netlify, Cloudflare Pages, GitHub Pages ou similar.
     No Netlify: arraste a pasta em "Deploy manually". Use um endereço próprio para o app (ex.: app.seudominio.com.br) para não misturar com o site antigo.
  2. O endereço PRECISA ser https. Abra-o uma vez com internet.
  Observação: o arquivo _headers (segurança) só vale em hospedagens que o leem (Netlify, Cloudflare Pages). Em outras, configure os mesmos cabeçalhos.

COMO INSTALAR:
  iPhone/iPad: abra o endereço no SAFARI (não no Chrome) > botão Compartilhar > "Adicionar à Tela de Início". O app mostra essa dica sozinho.
  Android (Chrome): menu ⋮ > "Instalar app" (ou o aviso que o Chrome mostra).
  Computador (Chrome/Edge): ícone de instalar na barra de endereço.

DADOS: ficam SÓ no aparelho/navegador. Faça backup em Configurações. No iPhone, o backup abre a folha de compartilhar: escolha "Salvar em Arquivos".
Versão do pacote: ${version}
`);
console.log('PWA gerado em ' + out + ' (versão ' + version + '): ' + fs.readdirSync(out).join(', '));
