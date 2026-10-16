# iPhone / iPad

## Por que não existe um `.ipa` pronto
Um `.ipa` é um programa **compilado para iOS** e **assinado pela Apple**. Isso exige o Xcode (só roda em Mac) e um certificado/perfil da sua conta Apple. Sem os dois, o iPhone se recusa a instalar. Ambiente de desenvolvimento em Linux/Windows **não consegue** produzir um `.ipa` válido, nem "de brincadeira". Por isso o caminho que entregamos para iPhone é o **PWA**.

## Caminho 1 (pronto): PWA, instalado pelo Safari
É o mesmo app local, como arquivos estáticos (`apps/web/local/build-pwa.js` → `dist-pwa/`):
- ícone na tela inicial, abre em tela cheia e **funciona offline** (service worker);
- sem conta Apple, sem loja, sem servidor nem banco; só precisa de **hospedagem estática em https**;
- os dados ficam **no aparelho** (`localStorage`), como no app Android. Backup/restauração iguais.

**Publicar:** suba o conteúdo de `dist-pwa/` (Netlify, Cloudflare Pages, GitHub Pages…). Use um endereço separado do site antigo (ex.: `app.seudominio.com.br`). O arquivo `_headers` aplica a política de segurança (CSP estrita, sem `unsafe-eval`) em hospedagens que o leem (Netlify, Cloudflare Pages).
**Instalar no iPhone:** abrir o endereço no **Safari** → Compartilhar → *Adicionar à Tela de Início*. O app mostra essa dica sozinho no Safari.

### Particularidades do iOS (tratadas, mas com limites)
- **Backup:** o Safari não "baixa" arquivos como o Android; o app abre a **folha de compartilhar** (*Salvar em Arquivos*). Se o aparelho não suportar, cai no download comum.
- **Armazenamento:** o app pede ao Safari para proteger os dados (`navigator.storage.persist()`). O iOS apaga dados de **sites** que ficam ~7 dias sem uso no navegador; apps **instalados na tela inicial** têm armazenamento próprio e não sofrem essa regra, mas o iOS ainda pode limpar tudo em situações extremas (pouco espaço). **O backup continua sendo a proteção real.**
- **Barra de status:** o iOS só oferece 3 estilos fixos (não acompanha o tema do app como no Android). Usamos o claro (`default`); no tema escuro a barra de cima fica clara.
- **Sem cópia nativa:** diferente do Android, não há uma segunda cópia dos dados fora do navegador.
- Sem notificações, sem Pix por app, etc. (não fazem parte do app local).

## Caminho 2 (precisa de Mac): app nativo (`.ipa`)
Seria uma casca `WKWebView` com o mesmo HTML, como o APK. Requisitos e custos (confira os valores atuais no site da Apple):
- Mac com **Xcode** + um **Apple ID**. Conta gratuita: instala no *seu* iPhone, mas o app **expira em 7 dias** e precisa ser reinstalado.
- **Apple Developer Program** (pago, anual): TestFlight, instalação por tempo longo e App Store (com revisão da Apple).
- AltStore/Sideloadly etc. também precisam de um `.ipa` que alguém compilou no Xcode.
Não incluímos esse projeto porque **não há como compilar nem testar Swift/iOS neste ambiente**; entregar código nativo sem poder verificá-lo seria arriscado. Se você tiver um Mac, dá para preparar o kit (e testar na sua máquina).

## O que foi verificado (em Chrome, não em iPhone)
Manifesto e ícones; instalabilidade (o Chrome não aponta nenhum erro); service worker e uso **offline**; política de segurança sem violações e bloqueando outros domínios; download do backup; dica de instalação (aparece só no Safari do iPhone, some ao dispensar, não aparece no app instalado); folha de compartilhar com o arquivo certo (UTF-8 com BOM preservado) e os caminhos de erro. **Não foi testado em iPhone/Safari reais.**
