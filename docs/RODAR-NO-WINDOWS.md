# Rodar o site novo no seu computador (Windows)

Tudo roda **só no seu PC**, com um banco de teste separado. **Não toca no seu site atual nem nos seus dados reais.**
Use dados fictícios.

## Instalar (uma vez)
1. **Node.js** (versão LTS, 22 ou mais nova): https://nodejs.org → botão "LTS" → instale deixando tudo no padrão.
2. **PostgreSQL 16**: https://www.postgresql.org/download/windows/ → "Download the installer".
   - Quando pedir a **senha do superusuário (postgres)**, use algo simples **só com letras e números** e **anote**.
   - Porta: deixe `5432`. No final, desmarque o "Stack Builder".
3. **Extraia o zip** em `C:\` (botão direito → "Extrair tudo…" → destino `C:\`). Deve ficar a pasta `C:\fin-platform`.
   Evite pastas como Downloads ou OneDrive (caminhos longos dão problema no Windows).

## Preparar (uma vez)
Abra a pasta `C:\fin-platform` no Explorador, clique na barra de endereço, digite `cmd` e Enter.
(Use o **Prompt de Comando**, não o PowerShell — o PowerShell costuma bloquear o `npm`.)
```
npm install
node scripts/create-local-db.js SUA_SENHA_DO_POSTGRES
node scripts/init-env.js
npm run setup
```
O último comando demora alguns minutos (monta a API e o site).

## Usar (toda vez)
Abra **duas** janelas do Prompt de Comando na pasta `C:\fin-platform`:
- Janela 1: `npm run local:api`   (deixe aberta)
- Janela 2: `npm run local:web`   (deixe aberta)

Abra no navegador **http://localhost:3000** (exatamente `localhost`, não `127.0.0.1`).
Clique em "Criar conta" → crie uma conta de teste → entre. (Localmente não pede confirmação de e-mail.)
Para parar: `Ctrl + C` em cada janela.

## Se der erro
| Mensagem | O que fazer |
|---|---|
| `password authentication failed for user "postgres"` | Senha do PostgreSQL errada no passo `create-local-db`. |
| `ECONNREFUSED ... 5432` | PostgreSQL não está ligado (Serviços do Windows → "postgresql-x64-16" → Iniciar). |
| `EADDRINUSE ... 3000` ou `3333` | Já há algo rodando nessa porta; feche a outra janela. |
| Login dá "Origem não permitida" | Você abriu por `127.0.0.1`; use `localhost`. |
| O Windows pede permissão de firewall | Pode permitir (é só a sua máquina). |
Em qualquer outro erro, tire um print da janela e me mande.

> Testado por mim em Linux (pasta limpa, PostgreSQL 16, Node 22). **No Windows eu não consegui testar** — se algo falhar aí, me avise.
