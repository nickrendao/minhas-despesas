# Guia: do seu computador ao GitHub e à Play Store

Feito para Windows (PowerShell). Se algo falhar, **copie a mensagem de erro** e me envie.

## 1. Preparar
- Instale o **Git**: https://git-scm.com/download/win
- Tenha uma conta no **GitHub**.
- Para a chave de assinatura (passo 6) você precisa do **keytool**, que vem com o **JDK 17** ou com o **Android Studio**.

## 2. Esconder o seu e-mail pessoal nos commits (recomendado)
No GitHub: *Settings → Emails* → marque **Keep my email addresses private** e copie o e-mail `…@users.noreply.github.com`. Depois, no PowerShell:
```powershell
git config --global user.name "Seu Nome"
git config --global user.email "ID+seu-usuario@users.noreply.github.com"
```

## 3. Criar o repositório
GitHub → **New repository** → nome `minhas-despesas` → **Public** → **não** marque README, .gitignore nem license (o projeto já tem).

## 4. Enviar o código
Descompacte o `fin-platform.zip`, abra o PowerShell dentro da pasta e rode:
```powershell
git init -b main
git add .
git status
```
**Confira a lista do `git status`:** não pode aparecer `.env`, `.jks`, `keystore`, `node_modules` nem arquivos de senha. (O `.gitignore` já evita isso.) Se estiver tudo certo:
```powershell
git commit -m "Primeira versão: app local (Android/PWA), API e site"
git remote add origin https://github.com/SEU-USUARIO/minhas-despesas.git
git push -u origin main
```

## 5. Publicar a política de privacidade (GitHub Pages)
No repositório: *Settings → Pages* → **Source: Deploy from a branch** → Branch `main`, pasta `/docs` → Save.
Em 1–2 minutos a página fica em:
`https://SEU-USUARIO.github.io/minhas-despesas/privacidade/` (é esse o endereço que vai na Play Console).

> Antes de publicar, **leia a política** (`docs/privacidade/index.html`) e confirme o seu nome e e-mail de contato.

## 6. Variáveis e chave de assinatura
**Variáveis** (Settings → Secrets and variables → Actions → aba **Variables**):
| Nome | Valor |
|---|---|
| `FEEDBACK_EMAIL` | seu e-mail de contato público |
| `PRIVACY_URL` | o endereço da política (passo 5) |
| `SOURCE_URL` | `https://github.com/SEU-USUARIO/minhas-despesas` |

**Chave de upload** (crie uma nova; **não** reaproveite a do APK de teste):
```powershell
keytool -genkeypair -v -keystore upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```
Ele pede senhas e dados. **Guarde o arquivo e as senhas em lugar seguro (cópia fora do computador).** Se perder, só dá para trocar a chave pedindo ao suporte da Google.

Converta para texto e copie para a área de transferência:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload-keystore.jks")) | Set-Clipboard
```
Cadastre em *Settings → Secrets and variables → Actions → aba **Secrets***:
| Nome | Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | o texto copiado acima |
| `ANDROID_KEYSTORE_PASSWORD` | a senha do arquivo |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | a senha da chave |

## 7. Gerar o app
GitHub → aba **Actions** → **Android (AAB…)** → **Run workflow** → informe a versão (ex.: `1.0.2`) e o código (`3`; **sobe a cada envio à Play**).
Ao terminar (alguns minutos), baixe em *Artifacts*:
- `minhas-despesas-apk-debug`: instala direto no celular para testar.
- `minhas-despesas-aab`: o arquivo que vai para a Play.

> **Importante:** este fluxo **ainda não foi executado**. O código Java compila contra a API 36 e o manifesto foi validado, mas o Gradle e o Android Gradle Plugin só rodam no GitHub. Se falhar, abra o passo vermelho, copie o log e me mande.

## 8. Testar no celular
Instale o APK de debug (pelo cabo com `adb install` ou enviando o arquivo ao celular). Teste principalmente num **Android 15 ou mais novo**: lá o app desenha sob as barras do sistema e o tratamento de margens é código novo.

## 9. Play Console
Siga o `docs/play-store/CHECKLIST.md`. Textos, respostas dos formulários e imagens estão em `docs/play-store/`.
- Contas **pessoais novas** precisam de um **teste fechado com 12 testadores por 14 dias** antes da produção (confirme a regra atual no painel).
- No primeiro envio, aceite o **Play App Signing**.
- O nome do pacote `br.com.minhasdespesas.app` é **definitivo**.

## 10. Para o portfólio
- Descrição curta no repositório (⚙ ao lado de *About*) e *topics*: `typescript`, `nestjs`, `nextjs`, `postgresql`, `android`, `pwa`, `local-first`.
- Fixe (*pin*) o repositório no seu perfil.
- Mantenha o README honesto (a seção *Limites conhecidos*) e atualize quando algo for verificado.
