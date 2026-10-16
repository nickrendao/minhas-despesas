// Verifica o contraste (WCAG) das combinações de texto/fundo do site, lendo os tokens do globals.css. Falha (exit 1) se alguma ficar ilegível.
// Uso: node scripts/check-contrast.js
const fs = require('fs'), path = require('path');
const css = fs.readFileSync(path.join(__dirname, '../apps/web/src/app/globals.css'), 'utf8');
const block = (re) => { const m = css.match(re); const t = {}; if (m) for (const [, k, v] of m[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) t[k] = v; return t; };
const light = block(/:root\{([^}]*)\}/); const dark = { ...light, ...block(/html\[data-theme="dark"\]\{([^}]*)\}/) };
const lin = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
const lum = (c) => { const [r, g, b] = lin(c); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs = [ // [texto, fundo, mínimo, descrição]
  ['ink', 'paper', 7, 'texto principal'], ['ink', 'card', 7, 'texto no cartão'], ['ink-soft', 'card', 4.5, 'texto secundário'], ['ink-soft', 'paper', 4.5, 'texto secundário no fundo'],
  ['ink-faint', 'card', 4.5, 'texto discreto'], ['ink-faint', 'paper', 4.5, 'texto discreto no fundo'],
  ['emerald-dark', 'paper', 4.5, 'links/destaques'], ['emerald-dark', 'card', 4.5, 'links no cartão'], ['emerald-dark', 'emerald-pale', 4.5, 'selo verde'],
  ['cta-text', 'cta-bg', 4.5, 'texto dos botões'],
  ['hero-ink', 'hero-bg', 4.5, 'números do destaque'], ['hero-soft', 'hero-bg', 4.5, 'rótulos do destaque'], ['hero-soft', 'hero-tile', 4.5, 'rótulos nos quadros'], ['hero-ink', 'hero-tile', 4.5, 'números nos quadros'],
  ['hero-pos', 'hero-tile', 4.5, 'ganho (cripto)'], ['hero-neg', 'hero-tile', 4.5, 'perda (cripto)'], ['hero-neg', 'hero-bg', 4.5, 'saldo negativo'],
  ['hero-accent', 'hero-track', 3, 'barra de progresso (gráfico)'], ['hero-accent', 'hero-bg', 3, 'elementos do destaque'],
  ['input-border', 'card', 3, 'borda de campo (não-texto)'], ['input-border', 'paper', 3, 'borda de campo no fundo'], ['input-border', 'input-bg', 3, 'borda x fundo do campo'],
  ['info', 'info-pale', 4.5, 'selo de informação'], ['warn', 'warn-pale', 4.5, 'selo de alerta'], ['on-rust', 'rust', 4.5, 'texto do botão de exclusão'],
  ['hero-num', 'hero-bg', 3, 'valor grande do destaque (texto grande)'], ['bnav-ink', 'bnav-bg', 4.5, 'menu inferior'], ['green-on-dark', 'bnav-bg', 4.5, 'item ativo do menu inferior'],
  ['fab-ink', 'fab-bg', 3, 'ícone do botão +'],
  ['rust', 'rust-pale', 4.5, 'mensagens de erro'], ['rust', 'paper', 4.5, 'erro no fundo'], ['rust', 'card', 4.5, 'erro no cartão'],
];
let fail = 0;
for (const [name, t] of [['TEMA CLARO', light], ['TEMA ESCURO', dark]]) {
  console.log(`\n${name}`);
  for (const [f, b, min, d] of pairs) {
    if (!t[f] || !t[b]) { console.log(`  ⚠ token ausente: ${f} ou ${b}`); fail++; continue; }
    const r = ratio(t[f], t[b]); const ok = r >= min; if (!ok) fail++;
    console.log(`  ${ok ? '✅' : '❌'} ${r.toFixed(2).padStart(5)} (mín ${min})  ${d}: ${f} ${t[f]} / ${b} ${t[b]}`);
  }
}
console.log(fail ? `\n${fail} combinação(ões) com contraste insuficiente.` : '\nTodas as combinações passam.'); process.exit(fail ? 1 : 0);
