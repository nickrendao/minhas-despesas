// Gera UM ÚNICO arquivo HTML com as telas reais do site novo + API de demonstração. Uso: node demo/build-demo.js
const esbuild = require('esbuild'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..', '..'), web = path.join(__dirname, '..'), src = path.join(web, 'src');
const out = process.argv[2] || path.join(web, 'dist-local', 'minhas-despesas-local.html');
const withExt = (p) => ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map((e) => p + e).find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
const plugin = {
  name: 'demo-resolve',
  setup(b) {
    b.onResolve({ filter: /^@\// }, (a) => ({ path: withExt(path.join(src, a.path.slice(2))) }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: path.join(web, 'demo/shims/router.tsx') }));
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: path.join(web, 'demo/shims/link.tsx') }));
  },
};
(async () => {
  const r = await esbuild.build({
    entryPoints: [path.join(web, 'local/entry.tsx')], bundle: true, write: false, minify: true, format: 'iife', target: 'es2020', platform: 'browser',
    jsx: 'automatic', plugins: [plugin], logLevel: 'error',
    alias: { '@fin/shared': path.join(root, 'packages/shared/src/index.ts'), '@fin/api-client': path.join(root, 'packages/api-client/src/index.ts') },
    define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_API_URL': '"demo://sem-servidor"', 'process.env.API_URL': '"demo://sem-servidor"', 'process.env.NEXT_PUBLIC_APP_MODE': '"local"',
      // contato público do app (opcionais; vazio = não aparece). O app local NUNCA tem Pix.
      'process.env.NEXT_PUBLIC_PIX_KEY': '""', 'process.env.NEXT_PUBLIC_PIX_KEY_DISPLAY': '""',
      'process.env.NEXT_PUBLIC_FEEDBACK_EMAIL': JSON.stringify(process.env.FEEDBACK_EMAIL || ''), 'process.env.NEXT_PUBLIC_PRIVACY_URL': JSON.stringify(process.env.PRIVACY_URL || ''),
      'process.env.NEXT_PUBLIC_SOURCE_URL': JSON.stringify(process.env.SOURCE_URL || ''), 'process.env.NEXT_PUBLIC_APP_VERSION': JSON.stringify(process.env.APP_VERSION || '1.0.2') },
  });
  const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const fonts = fs.readFileSync(path.join(web, 'demo/fonts.css'), 'utf8'); // Bricolage Grotesque, Geist e Geist Mono (SIL OFL) embutidas: a prévia funciona offline
  const css = fonts + fs.readFileSync(path.join(src, 'app/globals.css'), 'utf8') + `
.demo-banner{position:static;z-index:60;background:#14150D;color:#2FBF4F;font-size:12px;padding:8px 14px;display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap}
.demo-banner a{color:#2FBF4F;text-decoration:underline}.demo-banner button{background:none;border:0;color:#2FBF4F;cursor:pointer;font-size:14px;margin-left:6px}`;
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Minhas Despesas</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23009929'/%3E%3Crect x='11' y='36' width='11' height='16' rx='5.5' fill='%2314150D'/%3E%3Crect x='26.5' y='26' width='11' height='26' rx='5.5' fill='%2314150D'/%3E%3Crect x='42' y='34' width='11' height='18' rx='5.5' fill='%2314150D'/%3E%3Ccircle cx='47.5' cy='19' r='6.5' fill='%2314150D'/%3E%3C/svg%3E"><meta name="theme-color" content="#14150D">
<style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html);
  console.log('gerado:', out, Math.round(html.length / 1024) + ' KB');
})().catch((e) => { console.error(e.message); process.exit(1); });
