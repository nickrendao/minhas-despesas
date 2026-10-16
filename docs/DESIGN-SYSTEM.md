# Design System — Minhas Despesas

Fonte da verdade: `apps/web/src/app/globals.css` (tokens) + `apps/web/src/components/` (componentes).
Referência visual: o quadro "Minhas Despesas — Redesign" (painel desktop + telas de celular). Aplicamos os **princípios**, não uma cópia.

## Princípios
1. **Números sempre em fonte monoespaçada** (Geist Mono) e com peso: o valor é o herói da tela.
2. **Verde da marca (`#009929`) só como destaque**: botão principal, item ativo, cartão de resumo (no tema escuro). Texto verde sobre fundo claro usa `#007A24` (contraste).
3. **Raios grandes** (28 cartões · 24 · 18 tiles · 14 campos · pílula) e **bordas finas**; sombras só onde há elevação (janelas, menu inferior).
4. **Uma só família de ícones** (linha, 24px, traço 1.9): `components/Icon.tsx`. Os emojis legados das despesas viram ícones de linha (`lib/expense-icon.ts`).
5. **Desktop e celular são composições diferentes** (não é "encolher"): barra lateral + painel em grade vs. menu inferior com botão "+" central e folhas.

## Marca
Logo oficial: **B — "A sobra"** (três barras de despesa e a bolinha que sobra), tile verde `#009929` com formas em `#14150D`. Único logo do produto (`components/BrandMark.tsx`). Ativos gerados por `scripts/make-brand-assets.js` a partir do vetor aprovado: `icon.svg` e favicons, `icon-192/512.png` (any), `icon-maskable-512.png` (conteúdo na zona segura de 62%, cabe no recorte circular do Android), `apple-touch-icon.png` (180px, sem transparência), `og-image.png` (1200×630). Manifesto do app: `src/app/manifest.ts`.

## Tokens (tema claro / escuro)
| Grupo | Tokens |
|---|---|
| Superfícies | `--paper` (fundo) · `--card` · `--card-soft` · `--side-bg` · `--border` · `--hair` |
| Texto | `--ink` · `--ink-soft` · `--ink-faint` |
| Marca | `--emerald` `#009929` · `--emerald-dark` (texto/links) · `--emerald-pale` · `--green-on-dark` |
| Semânticas | sucesso = verde · alerta `--warn`/`--warn-pale` · erro `--rust`/`--rust-pale`/`--on-rust` · informação `--info`/`--info-pale` |
| Ação | `--cta-bg`/`--cta-text` (claro: preto com texto verde · escuro: verde com texto preto) · `--fab-*` |
| Destaque (hero) | `--hero-bg` `--hero-ink` `--hero-num` `--hero-soft` `--hero-tile` `--hero-track` `--hero-pos` `--hero-neg` |
| Campos | `--input-border` (≥3:1, WCAG 1.4.11) · `--input-bg` |
| Escalas | espaço `--s-1…8` (4–32px) · raios `--r-sm…xl` · sombras `--shadow` `--shadow-lg` |

Tipografia: **Bricolage Grotesque** (títulos, 20–34px, peso 700–800, tracking −.02 a −.04em) · **Geist** (texto 13–16px) · **Geist Mono** (valores; hero `clamp(40px,5.4vw,54px)`; centavos em 56% do tamanho).

## Componentes
`Dialog` (modal no desktop, folha na base no celular; Esc, foco preso, foco devolvido) · `Field` (rótulo `for`/`id`, ajuda e erro por `aria-describedby`) · `Segmented` · `Switch` · `BigMoney` · `SegBar` · `InstallmentDots` · `EmptyState` · `ErrorState` · `Skeleton` · `PageHead` · `Tools` · `AppShell` (sidebar, menu inferior, busca, "Mais", avisos) · `ExpenseDialog`/`IncomeDialog`/`GoalDialog`/`CardDialog`/`PurchaseDialog`/`PlanDialog`/`ConfirmDialog`.

Estados cobertos em todos: carregando (skeleton) · vazio (com ação) · erro (com "Tentar novamente") · sucesso (aviso) · hover · foco visível · ativo · desabilitado · confirmação em 2 passos para exclusões · formulário inválido (mensagem por campo).

## Ícones das despesas, renda principal e tutorial
- **Seletor de ícone e cor** (`ExpenseDialog`): 34 ícones de linha da própria família do site + as 20 cores da paleta, com pré-visualização. Nunca emoji. Ícone e cor só são enviados se a pessoa os trocou.
- **Renda principal**: selo "Principal" + estrela (cheia = principal; vazia = botão "Tornar principal", 40×40px) + selo no cartão de resumo.
- **Tutorial** (`Tutorial.tsx`): 6 passos em janela (desktop) / folha (celular), figuras montadas com os componentes do app e **sem valores em reais**; setas ← → e Esc; pular, voltar e concluir.

## Responsividade
- **≥1024px**: barra lateral fixa (248px) + conteúdo até 1320px; cabeçalho com mês, busca (`/`), olho, tema e "Nova despesa".
- **<1024px** (tablet e celular): menu inferior (Mês · Cartões · **+** · Ano · Mais); ferramentas no topo da tela Mensal e em "Mais".
- Grades por **container queries** (`.dash`, `.card`, `.hero2`): o painel decide pela largura *disponível*, não pela da janela. Vencimentos viram cartões roláveis no celular e lista com data em quadrado no desktop.
- Formulários: folha de largura total no celular, campos ≥44px de altura e fonte ≥16px (evita zoom no iOS).

## Acessibilidade
Contraste verificado automaticamente (`node scripts/check-contrast.js`, 40+ pares nos dois temas) · foco visível · navegação por teclado · `aria-current`, `aria-pressed`, `role=switch/progressbar/dialog` · alvos de toque ≥40–44px · informação nunca só por cor (sinal, texto e ícones acompanham) · `prefers-reduced-motion` respeitado.

## Como verificar
```
node scripts/check-contrast.js                       # contraste dos tokens
npm test                                             # API + site (unitários e de componentes)
npm run demo -w @fin/web                             # gera a prévia HTML e testa em Chrome real (desktop + celular)
node apps/web/demo/screenshots.js                    # 9 telas × 3 tamanhos × 2 temas, medindo overflow
node scripts/e2e-smoke.js                            # API + site de produção (sem navegador)
node scripts/e2e-real-browser.js                     # site REAL num Chrome: conta, login, despesa, recarregar, sair
```
(Os dois últimos de navegador exigem `npm i puppeteer-core @sparticuz/chromium` fora do projeto.)
