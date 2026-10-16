# Casca Android (Gradle, alvo API 36)

Um `WebView` em tela cheia com o app local (`apps/web/local`) embutido em `assets/app.html`. O HTML **não fica no Git**: o fluxo [`android.yml`](../../.github/workflows/android.yml) o gera e copia antes de compilar.

```
apps/android/
├─ app/src/main/java/.../MainActivity.java   Activity, ponte JavaScript, margens do sistema, voltar, seletor de arquivos
├─ app/src/main/assets/bridge.js             ponte página→Android (downloads, cópia dos dados, cor das barras)
├─ app/src/main/res/                         ícones (adaptável e monocromático), temas, regras de backup
└─ gradle/ + gradlew                         Gradle 8.14.3 (wrapper oficial)
```

## Gerar localmente (Android Studio)
1. `node apps/web/local/build-local.js` e copie `apps/web/dist-local/minhas-despesas-local.html` para `apps/android/app/src/main/assets/app.html`.
2. Abra a pasta `apps/android` no Android Studio e rode. Ou: `./gradlew :app:bundleRelease` (AAB) / `:app:assembleDebug` (APK de teste).
Variáveis de ambiente: `VERSION_NAME`, `VERSION_CODE`, e (para assinar) `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Sem chave, a variante release sai **sem assinar**.

## Decisões
- **Só a permissão `INTERNET`** (cotação de cripto). Sem anúncios, sem SDKs.
- **Backup automático do Android**, limitado às preferências `minhas_despesas.xml` (`res/xml/backup_rules.xml` e `data_extraction_rules.xml`), que guardam uma cópia dos dados.
- **Android 15+ (alvo 35/36):** o app é desenhado sob as barras do sistema; `installInsetsHandling()` aplica as margens (barras, recorte da tela, teclado) e a cor do app aparece atrás delas. Os ícones das barras mudam conforme o tema.
- **Botão voltar moderno** (Android 13+) com `OnBackInvokedCallback`; `onBackPressed` nas versões antigas.
- Se o processo do WebView morrer, a tela é recriada em vez de fechar o app.

## O que está e o que não está verificado
| Verificado | Não verificado |
|---|---|
| `MainActivity.java` **compila** contra o `android.jar` da API 36 | O build **Gradle/AGP** (roda no GitHub Actions; plugins vêm do repositório do Google) |
| Manifesto e recursos **ligam** no `aapt2` (API 34): atributos de backup, voltar e `exported` reconhecidos; só `INTERNET` | O app **na tela de um Android 15+** (margens, teclado, ícones das barras) |
| Limpeza de nomes de arquivo (JVM) | Aparelhos e versões variados; relatório pré-lançamento da Play |
| Ponte e app embutido no Chrome com um "Android" simulado (`apps/web/local/e2e-local.js`) | |

## Endurecimento futuro (opcional)
Servir o app por `WebViewAssetLoader` (https://appassets.androidplatform.net) em vez de `file://`, para poder desligar `setAllowFileAccess`. Exige a dependência `androidx.webkit` e muda a origem do `localStorage` (a cópia nas preferências do Android cobre a migração).
