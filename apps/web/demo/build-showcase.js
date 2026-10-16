// Gera UM HTML "mostruário": no computador mostra o app numa janela de PC e num celular lado a lado; no smartphone abre o app direto em tela cheia.
// Pré-requisito: node demo/build-demo.js  (gera dist-demo/minhas-despesas-previa.html). Uso: node demo/build-showcase.js
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', 'dist-demo', 'minhas-despesas-previa.html'); const out = process.argv[2] || path.join(__dirname, '..', 'dist-demo', 'minhas-despesas-dashboard.html');
const app = fs.readFileSync(src, 'utf8'); const appJson = JSON.stringify(app).replace(/<\//g, '<\\/');     // "</script" dentro do texto não pode fechar a tag
const fonts = fs.readFileSync(path.join(__dirname, 'fonts.css'), 'utf8');
const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Minhas Despesas — painel no computador e no celular</title><meta name="theme-color" content="#14150D">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23009929'/%3E%3Crect x='11' y='36' width='11' height='16' rx='5.5' fill='%2314150D'/%3E%3Crect x='26.5' y='26' width='11' height='26' rx='5.5' fill='%2314150D'/%3E%3Crect x='42' y='34' width='11' height='18' rx='5.5' fill='%2314150D'/%3E%3Ccircle cx='47.5' cy='19' r='6.5' fill='%2314150D'/%3E%3C/svg%3E">
<script>
/* Smartphone/tablet = aparelho de toque com tela pequena (pelo tamanho FÍSICO da tela: a largura da janela engana quando a página é larga e o navegador a encolhe). */
function isPhone() { var m = Math.min(screen.width, screen.height); var touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window; return (touch && m < 1000) || innerWidth < 640; }
if (isPhone()) document.documentElement.className = 'is-phone';
</script>
<style>${fonts}
*{box-sizing:border-box}html,body{margin:0;height:100%}body{background:#E4E3D9;font-family:'Geist',system-ui,sans-serif;color:#14150D}
.bar{position:sticky;top:0;z-index:5;background:#14150D;color:#F3F3EA;display:flex;align-items:center;gap:18px;padding:10px 22px;flex-wrap:wrap}
.bar b{font-family:'Bricolage Grotesque',sans-serif;font-size:17px;letter-spacing:-.02em;margin-right:6px}.bar small{color:#A7AA95}
.grp{display:flex;gap:4px;background:#1E2016;border-radius:999px;padding:4px}.grp button{border:0;background:none;color:#B5B6A5;font:600 13px 'Geist',sans-serif;padding:7px 13px;border-radius:999px;cursor:pointer}
.grp button[aria-pressed=true]{background:#009929;color:#14150D}.grp button:focus-visible{outline:2px solid #2FBF4F;outline-offset:2px}
.stage{display:flex;gap:44px;justify-content:center;align-items:flex-start;padding:26px 22px 40px}
.item{display:flex;flex-direction:column;align-items:center;gap:12px}.item figcaption{font-size:13px;color:#5A5B50;font-weight:600}.item[hidden]{display:none}
.scaler{position:relative}.scaler>div{position:absolute;left:0;top:0;transform-origin:0 0}
.win{width:1440px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 30px 70px -25px rgba(20,21,13,.55),0 0 0 1px rgba(20,21,13,.12)}
.win .tb{height:38px;background:#F2F1EA;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid #DAD9CC}.win .tb i{width:11px;height:11px;border-radius:50%;background:#C9C8BA}
.win .tb span{margin-left:14px;flex:0 1 420px;background:#fff;border-radius:999px;font-size:12px;color:#6E6F63;padding:5px 14px}
.win iframe{display:block;width:1440px;height:900px;border:0;background:#F2F1EA}
.phone{width:418px;padding:14px;background:#14150D;border-radius:56px;box-shadow:0 30px 70px -25px rgba(20,21,13,.6),inset 0 0 0 2px #2A2C20;position:relative}
.phone::before{content:"";position:absolute;top:24px;left:50%;transform:translateX(-50%);width:104px;height:28px;background:#14150D;border-radius:20px;z-index:2}
.phone iframe{display:block;width:390px;height:844px;border:0;border-radius:42px;background:#F2F1EA}
.is-phone .bar,.is-phone .stage,.is-phone .hint{display:none}
.direct{position:fixed;inset:0;border:0;width:100%;height:100%;background:#F2F1EA}
.hint{max-width:640px;margin:0 auto;padding:0 22px 30px;text-align:center;font-size:13px;color:#5A5B50}
</style></head><body>
<header class="bar" id="bar"><b>Minhas Despesas</b><small>dados fictícios · nada é salvo</small>
  <div class="grp" role="group" aria-label="Tela" id="routes"></div>
  <div class="grp" role="group" aria-label="Tema" id="themes"></div>
  <div class="grp" role="group" aria-label="Visualização" id="modes"></div>
  <div class="grp"><button type="button" id="tutBtn">Ver tutorial de 1º acesso</button></div></header>
<main class="stage" id="stage">
  <figure class="item" id="pcItem" style="margin:0"><div class="scaler" id="pcScaler"><div id="pcInner"><div class="win"><div class="tb"><i></i><i></i><i></i><span>minhasdespesas021.com.br</span></div><iframe id="pc" title="Painel no computador" allow=""></iframe></div></div></div><figcaption>Computador · 1440 × 900</figcaption></figure>
  <figure class="item" id="phItem" style="margin:0"><div class="scaler" id="phScaler"><div id="phInner"><div class="phone"><iframe id="ph" title="Painel no celular"></iframe></div></div></div><figcaption>Celular · 390 × 844</figcaption></figure>
</main>
<p class="hint" id="hint">Clique e use as telas de verdade dentro de cada moldura. Os botões acima trocam a tela e o tema nas duas ao mesmo tempo. Abra este mesmo arquivo no celular para vê-lo em tela cheia.</p>
<script>
const APP = ${appJson};
const ROUTES = [['mensal','Mensal'],['cartao','Cartões'],['anual','Anual'],['agenda','Agenda'],['investir','Investir'],['cripto','Cripto'],['config','Config'],['login','Entrar']];
const state = { route: 'mensal', theme: 'light', mode: 'both' };
let appUrl; try { appUrl = URL.createObjectURL(new Blob([APP], { type: 'text/html' })); } catch (e) { appUrl = null; }
const $ = (id) => document.getElementById(id);
function load(frame) {                                   // blob: preferido; srcdoc: alternativa para navegadores que bloqueiem blob em arquivo local
  if (appUrl) frame.src = appUrl + '#/' + state.route + '?notutorial';
  else frame.srcdoc = APP.replace('<head>', '<head><script>location.hash="#/' + state.route + '?notutorial"<\\/script>');
}
function group(id, items, key) {
  const g = $(id); g.innerHTML = '';
  for (const [v, label] of items) { const b = document.createElement('button'); b.textContent = label; b.type = 'button'; b.setAttribute('aria-pressed', String(state[key] === v)); b.onclick = () => { state[key] = v; refresh(); if (key === 'route') ['pc','ph'].forEach((i) => load($(i))); if (key === 'theme') postTheme(); }; g.appendChild(b); }
}
$('tutBtn').onclick = () => { for (const i of ['pc','ph']) { const w = $(i).contentWindow; if (w) w.postMessage({ fin: 'tutorial' }, '*'); } };
function postTheme() { for (const i of ['pc','ph']) { const w = $(i).contentWindow; if (w) w.postMessage({ fin: 'theme', value: state.theme }, '*'); } }
window.addEventListener('message', (e) => { if (e.data && e.data.fin === 'ready' && state.theme !== 'light') postTheme(); });
function fit() {
  const phone = $('ph'), pc = $('pc'), both = state.mode === 'both';
  $('pcItem').hidden = state.mode === 'phone'; $('phItem').hidden = state.mode === 'pc';
  const barH = $('bar').offsetHeight, availH = innerHeight - barH - 110, ps = Math.min(1, availH / 872);
  const phW = 418 * ps, gap = 44, availW = innerWidth - 44 - (both ? phW + gap : 0), cs = Math.min(1, availW / 1440);
  const set = (scalerId, innerId, w, h, s) => { $(scalerId).style.width = w * s + 'px'; $(scalerId).style.height = h * s + 'px'; $(innerId).style.transform = 'scale(' + s + ')'; };
  set('pcScaler', 'pcInner', 1440, 938, Math.max(0.3, cs)); set('phScaler', 'phInner', 418, 872, Math.max(0.4, ps));
}
function refresh() { group('routes', ROUTES, 'route'); group('themes', [['light','Claro'],['dark','Escuro']], 'theme'); group('modes', [['both','PC + celular'],['pc','Só PC'],['phone','Só celular']], 'mode'); fit(); }
let direct = null;
function layout() {
  if (isPhone()) {                                       // no smartphone: o app em tela cheia, sem molduras
    if (!direct) { document.body.innerHTML = ''; direct = document.createElement('iframe'); direct.className = 'direct'; direct.title = 'Minhas Despesas'; document.body.appendChild(direct); load(direct); }
    return;
  }
  if (direct) { location.reload(); return; }
  fit();
}
if (isPhone()) { layout(); } else { refresh(); ['pc','ph'].forEach((i) => load($(i))); addEventListener('resize', layout); }
addEventListener('orientationchange', () => setTimeout(() => location.reload(), 300));
</script></body></html>`;
fs.writeFileSync(out, html); console.log('gerado:', out, Math.round(html.length / 1024) + ' KB');
