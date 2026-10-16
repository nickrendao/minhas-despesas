# Do GitHub à Play Store: passo a passo

Legenda: 🤖 o fluxo do GitHub faz · 🧑 você faz

## A. Preparar o repositório (uma vez)
1. 🧑 Criar o repositório no GitHub e enviar o código (veja `docs/GUIA-GITHUB-E-PLAY.md`).
2. 🧑 Ligar o **GitHub Pages** (Settings → Pages → Branch `main`, pasta `/docs`) para publicar a política de privacidade.
3. 🧑 Em Settings → Secrets and variables → Actions → **Variables**: `FEEDBACK_EMAIL`, `PRIVACY_URL`, `SOURCE_URL`.

## B. Chave de assinatura (uma vez)
4. 🧑 Criar a **chave de upload** (comando no guia), guardar uma cópia segura e cadastrar os 4 segredos: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

## C. Conta de desenvolvedor Google Play (comece cedo: tem verificação e prazo)
5. 🧑 Criar a conta **pessoal** (taxa única; verificação de identidade). Se ela for nova, você precisará de um **teste fechado com 12 testadores por 14 dias** antes da produção (regra que eu conheço; confirme no painel).

## D. Gerar o app
6. 🧑 GitHub → Actions → **Android** → *Run workflow* (informe nome e código da versão).
7. 🤖 Compila e publica os artefatos: `minhas-despesas-aab` (para a Play) e `minhas-despesas-apk-debug` (instala direto para testar).
8. 🧑 Instalar o APK de teste em **vários celulares** e testar (principalmente Android 15 ou mais novo, onde o app desenha sob as barras do sistema).

## E. Publicar na Play Console
9. 🧑 Criar o app (nome, idioma pt-BR, app gratuito, declarações).
10. 🧑 Preencher: política de privacidade, acesso ao app, anúncios, classificação, público-alvo, segurança dos dados, recursos financeiros (`DATA-SAFETY.md`).
11. 🧑 Página da loja: textos (`LISTAGEM.md`) e imagens (`assets/`).
12. 🧑 Testes → **Teste interno** (rápido, até 100 pessoas) com o AAB para conferir que instala pela loja.
13. 🧑 Testes → **Teste fechado**: reunir 12+ testadores (e-mails de contas Google), 14 dias seguidos.
14. 🧑 Depois do prazo, solicitar **acesso à produção**, enviar a versão e aguardar a revisão do Google.

## F. A cada atualização
15. 🧑 Subir o `version_code` (sempre maior que o anterior), rodar o fluxo, enviar o novo AAB.

## Cuidados
- **Nunca** coloque a chave (`.jks`) nem senhas no repositório.
- O nome do pacote `br.com.minhasdespesas.app` é **definitivo** depois de publicado.
- Ao enviar o primeiro AAB, aceite o **Play App Signing** (o Google guarda a chave final; a sua é só a "chave de upload").
