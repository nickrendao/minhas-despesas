# O que falta: backend e Play Store (atualizado em 09/10/2026)

> Fotografia honesta do projeto. Regras e preços de lojas e hospedagens mudam: **confira cada item de política na própria Play Console**, pois meu conhecimento pode estar defasado.

## 0. Os três produtos hoje
| Produto | Estado |
|---|---|
| **Site antigo** (HTML + Supabase) | No ar. A versão 3.4.0 (logo e verde novos, correção das rendas) **ainda precisa ser publicada** (só o `index.html`). |
| **App local** (APK/PWA, dados no celular) | Pronto e testado em Chrome e com Android simulado. **Funcionou num Android real** (print do usuário). Não testado em iPhone. **Não precisa de backend.** |
| **Plataforma nova** (API NestJS + PostgreSQL + site Next.js) | Código pronto e testado, mas **nunca publicada** e nunca rodou com dados reais. |

**Ponto-chave:** lançar na Play Store o **app local** não depende de nada do backend. O backend só é necessário se o app tiver contas e sincronização entre aparelhos.

---
## 1. Backend (plataforma nova)

### ✅ Pronto
- API NestJS 11 + Prisma 7 + PostgreSQL 16: autenticação (cadastro, login, renovação de sessão, confirmação de e-mail, recuperação de senha), perfil e PIN, meses e recorrência, rendas (com renda principal), despesas (ícone e cor), cartões e parcelas, investimentos, cripto, relatórios, exportação e exclusão de conta (LGPD), migração dos dados do site antigo (login com a senha antiga).
- **144 testes da API** (PostgreSQL real) e **166 do site**; 29 verificações de produção; 20 em Chrome real contra API + banco reais.
- Proteções: `helmet`, CORS restrito, rate limit, validação de entrada, proteção contra CSRF no site (BFF com cookies), Swagger desligado em produção, `GET /health`.

### 🔴 Bloqueia a publicação
| # | Item | Situação |
|---|---|---|
| 1 | **Escolher a hospedagem** (API, banco, site, e-mail) | Decisão pendente desde o início. Roteiro em `DEPLOY-GRATUITO.md` (preços e limites **não verificados**). |
| 2 | **Banco de produção + migrations** (3) | Nunca rodadas em produção. A sincronia `schema.prisma` ↔ migrations é mantida à mão; rode o `prisma migrate diff` do CI na sua máquina. O índice único parcial da renda principal não é representável no Prisma: não aceite removê-lo. |
| 3 | **Migração dos dados do Supabase** | O *dry-run* **nunca rodou com dados reais**. Precisa de ensaio, janela de virada e plano de volta. |
| 4 | **E-mail real** (SMTP) | Testado só contra SMTP local simulado. Falta provedor real, domínio com SPF/DKIM/DMARC, e testar confirmação e recuperação. |
| 5 | **Segredos, domínios e HTTPS** | Definir variáveis de produção (`.env.example`), `CORS_ORIGINS`, `WEB_URL`, `TRUST_PROXY`, domínios `api.` e `app.`. |
| 6 | **Docker e CI nunca executados** | `Dockerfile` da API escrito e não testado; o CI nunca rodou (o passo `migrate diff` pode precisar de ajuste). O site Next.js não tem Dockerfile: precisa de hospedagem com Node (ou um adaptador, não testado). |
| 7 | **Dependências com avisos** | `npm audit`: **8 avisos (5 altos, 3 moderados)** em Prisma CLI, PostCSS/Next, js-yaml/Swagger; há correção disponível. Atualizar e rodar os testes de novo. |

### 🟠 Antes de ter usuários de verdade
- Rate limit está **em memória**: com mais de uma instância precisa de Redis.
- **Backups do banco**, monitoramento e alertas, logs estruturados.
- Testar **CoinGecko real** (hoje só simulado).
- Testar em **Safari, Firefox e aparelhos reais** (só Chromium foi testado; cookies/CSRF variam por navegador).
- **Revisão de segurança independente** (nunca feita). O PIN é só trava de tela.
- **LGPD**: há exportação e exclusão de conta, mas faltam política de privacidade, termos e canal do titular.

### 🟡 Paridade com o site antigo (ainda falta no site novo)
Tradução EN/ES/FR (a preferência é salva, mas as telas só existem em português), PWA/offline, QR do Pix, desfazer exclusão, CSP no site, exportações CSV/OFX feitas no navegador.

### Fora do plano atual
App React Native: foi substituído pelo APK/PWA local.

---
## 2. Play Store (Rota A: app local) — atualizado em 16/10/2026
**Decisões tomadas:** seguir com o app local; conta de desenvolvedor **pessoal**; **Pix removido** do app local; build e portfólio pelo **GitHub**.

### ✅ Feito
- **Pix e doações removidos** do app local (0 menções no código final) e da tela de apoio da plataforma por padrão; a chave Pix e o e-mail agora só existem por variável de ambiente (nada pessoal no código).
- Tela **"Sobre e ajuda"** no app local: versão, tutorial, feedback, política de privacidade, código-fonte.
- **Projeto Gradle** (alvo **API 36**), manifesto, regras de backup, ícones, tratamento de margens/voltar/teclado do Android 15+ e **fluxo `android.yml`** que gera AAB e APK.
- **Política de privacidade** (HTML para o GitHub Pages), textos da loja, respostas sugeridas dos formulários e **imagens** (ícone 512, destaque 1024×500, 5 capturas).
- Correção de layout do cartão principal em telas de ~360 px (achada ao gerar as capturas).
- README de portfólio, `.gitignore`, licença MIT e guia passo a passo (`GUIA-GITHUB-E-PLAY.md`).

### 🔴 Falta (só você consegue, ou só dá para verificar com aparelho/GitHub)
| Item | Observação |
|---|---|
| **Enviar o código ao GitHub** e ligar o Pages | Passos 2 a 5 do guia. |
| **Rodar o `android.yml` pela primeira vez** | Nunca foi executado: o Gradle/AGP só roda no GitHub. Se falhar, mande o log. |
| **Criar a chave de upload** e os segredos | Passo 6 do guia. |
| **Conta de desenvolvedor Google Play (pessoal)** | Taxa única e verificação de identidade. **Teste fechado com 12 testadores por 14 dias** (confirme a regra no painel). |
| **Testar em Android real, principalmente 15+** | Margens, teclado e ícones das barras são código novo; só 1 aparelho confirmou o app até hoje. |
| **Formulários e página da loja** | Respostas em `docs/play-store/DATA-SAFETY.md`; leia as perguntas atuais e responda com a verdade. |
| **Confirmar o `targetSdk` exigido hoje** | O projeto usa 36; confira o número na Play Console. |

### ⚠️ Riscos que continuam
1. **App "casca" de WebView:** a Play recusa sites embrulhados; o nosso embute a interface e funciona offline com dados locais, mas quem decide é a revisão.
2. **Sem sincronização:** perda de dados se desinstalar sem backup (a descrição da loja já avisa).
3. **Formulário "Segurança dos dados":** a consulta à CoinGecko (IP e ids de moedas) precisa ser declarada com cuidado.

### Ordem sugerida
GitHub e Pages → chave e segredos → rodar o fluxo → testar o APK em 2+ celulares → conta Play (começa o relógio) → teste interno → teste fechado (14 dias) → produção.

---
## 3. Decisões que dependem de você
1. Quando for ao backend: **onde hospedar** API, banco, e-mail e site?
2. Revisar a **política de privacidade** (nome e e-mail de contato) antes de publicá-la.
3. Licença: o repositório usa **MIT**; troque se preferir outra.
