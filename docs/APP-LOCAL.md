# App local (Android): sem servidor, dados no próprio celular

O APK `local` é o **mesmo app do site**, mas em vez de falar com a API na internet ele fala com um "servidor dentro do aparelho" (`apps/web/local/local-api.ts`, classe `LocalBackend`). Começa **100% vazio** (nada de dados de exemplo) e funciona offline.

## Como não divergir do servidor
- Reaproveita as **validações** (`@fin/shared`: os mesmos esquemas Zod) e os **cálculos** (`apps/api/src/domain/finance.ts`: resumo, parcelas, cartão, cripto, vencimentos).
- Reimplementa as regras que o servidor aplica no banco: renda principal (exatamente uma por mês), recorrência (copia uma vez ao abrir o mês), copiar mês, limites (3 rendas/mês, 5 cartões). Cobertas por 39 testes (`apps/web/test/local-api.spec.ts`) e 11 de interface (`local-mode.spec.tsx`).
- Toda alteração é "tudo ou nada": se não conseguir gravar (aparelho sem espaço), o estado volta ao que era e a tela mostra um erro claro.

## Onde os dados ficam (e por quê em dois lugares)
1. `localStorage` do WebView;
2. **SharedPreferences do Android** (ponte `AndroidApp.saveData`, gravação síncrona).
Ao abrir, vale a cópia **mais nova** (`savedAt`); se uma estiver corrompida ou faltando, usa a outra. Assim, se o WebView perder o armazenamento próprio, o app recupera pelo Android (testado). Com o **backup automático do Android** ligado nesta versão (`allowBackup=true`), o Google pode devolver os dados ao reinstalar/trocar de celular. Para desligar, mude `android:allowBackup` em `apps/android/app/src/main/AndroidManifest.xml` (as regras ficam em `res/xml/backup_rules.xml`).

## Backup manual (recomendado)
Configurações → *Baixar backup completo*: arquivo `.json` (`app: minhas-despesas-local`, `version: 1`) com tudo, **sem o PIN e sem as cotações**. *Restaurar backup* aceita o arquivo ou o texto colado e **substitui** os dados atuais; arquivo inválido é recusado sem alterar nada (valores, meses, cores, limites e versões são verificados). *Apagar todos os dados* zera os dois armazenamentos.

## Diferenças para o site hospedado
- Não há conta, login, senha, "sair" nem sincronização entre aparelhos: cada instalação é independente.
- O PIN é só uma trava de tela (guardado com sal + SHA-256, nunca em texto puro); não substitui o bloqueio do celular.
- Fuso horário = o do aparelho.
- A **única** coisa que usa a internet é a cotação de criptomoedas (CoinGecko, `GET .../simple/price`), com cache de 30 s; sem internet, mostra o último preço conhecido com o horário dele.
- Migrar do app local para uma conta no site hospedado **não está implementado** (os formatos de backup são diferentes).

## Limites conhecidos
Não foi executado num Android real por quem montou o projeto (ver `apps/android/README.md`). Os dados dependem do aparelho: desinstalar o app ou "limpar dados" apaga tudo, a menos que haja backup.
