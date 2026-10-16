# Migração dos dados e virada (cutover)

Princípio: **nada do site antigo é apagado ou alterado.** A migração só **lê** `app_data` e **escreve** nas tabelas novas.
O site antigo segue no ar até você decidir a virada; dá para migrar e conferir quantas vezes quiser antes.

## Passo a passo
1. **Crie um backup manual** no Supabase (Database > Backups) — além do backup automático que o script faz.
2. Aplique as migrations nas tabelas novas: `npm run db:migrate -w @fin/api`
   (use a conexão **direta** ou *Session pooler*, porta 5432). Isso cria as 11 tabelas **e fecha o acesso público** (veja `SEGURANCA.md`).
3. **Dry-run** (não grava nada; mostra o que seria feito e todos os avisos):
   ```bash
   DATABASE_URL="<conexão direta do Supabase como usuário postgres>" npm run migrate:legacy -w @fin/api
   ```
   Leia os avisos (valores negativos ajustados, nomes cortados, usuários sem conta de login…).
4. **Gravar:** `npm run migrate:legacy -w @fin/api -- --apply`
   - Salva antes um backup completo em `apps/api/backups/` (dados pessoais — **não envie ao Git**).
   - Cada usuário é gravado em **uma transação** com **conferência automática** (quantidades e somas em R$). Se algo não bater, aquele usuário é revertido por inteiro.
   - Usuários já migrados são pulados (seguro rodar de novo).
5. Teste com sua própria conta: faça login na API nova **com a senha antiga** e compare os totais com o site antigo.
6. **Virada:** pouco antes de ligar o site novo, rode `-- --apply --refresh` para capturar as últimas alterações feitas no site antigo
   (substitui apenas os *dados de negócio* de quem já foi migrado; contas/senhas ficam).
7. Após a virada, **não rode mais `--refresh`** (sobrescreveria o que foi lançado no site novo).

## O que é convertido
| Antigo (`app_data`, JSON em texto) | Novo |
|---|---|
| `month:AAAA-MM` → `{salary, incomes[], expenses[]}` | `incomes`, `expenses`, `month_ledger` |
| `salary` solto (sem `incomes`) | 1 renda "Renda" (mesma regra do site antigo); `salaryRecurring`+`salaryBase` preservados |
| `cards` (+ formato antigo com `used`) | `credit_cards`, `card_purchases` ("Gastos anteriores") |
| `investments` (tipos em português) | `investment_plans` (tipos padronizados) |
| `cryptoHoldings` | `crypto_holdings` (quantidade decimal exata) |
| `theme, lang, monthlyGoal, displayName, privacyMode, onboarded…` | `user_settings` |
| `privacyPin` (**texto puro**) | `privacy_pin_hash` (hash scrypt) |
| `auth.users` (e-mail, hash bcrypt, confirmação) | `users` (mesmo UUID; **mesma senha continua valendo**) |

## Rollback
O site antigo e `app_data` continuam intactos: para voltar atrás basta apontar o domínio de volta ao site antigo.
Para descartar a migração: `DELETE FROM users;` (cascata apaga todos os dados novos) e rode de novo.

## ⚠️ Limites do que consegui verificar
- Testado com dados no **formato real** que o código do site gera (inclusive dados sujos), contra PostgreSQL 16 real, mas **não** contra o seu banco de produção — não tenho acesso a ele.
- O acesso a `auth.users` exige conexão com o usuário `postgres` do Supabase. Se o script avisar que não conseguiu ler, nada é migrado para esses usuários (eles aparecem como "sem conta de login").
- Hashes de senha do Supabase são bcrypt (`$2a$`). Testei com bcrypt gerado localmente, **não** com um hash real do Supabase — por isso o passo 5 (login com a senha antiga) é obrigatório antes da virada.


## Migration `20261007000000_primary_income_tutorial` (renda principal + versão do tutorial)
Aplica, nesta ordem: coluna `incomes.is_primary`; **backfill** (a renda mais antiga de cada mês passa a ser a principal); índice único parcial `incomes_one_primary_per_month`; coluna `user_settings.tutorial_version` (padrão 0).
- Rode **antes** de publicar o site/API novos (o código novo lê as duas colunas). O site antigo não usa estas colunas e não é afetado.
- É aditiva: não apaga nem altera dados existentes além do backfill.
- Testada em banco novo e na lógica do backfill (`apps/api/test/primary-income-tutorial.spec.ts`). **Não testada contra o seu banco real.**
- Aviso: o Prisma não representa índices únicos *parciais*. Se você rodar `prisma migrate diff`/`migrate dev` e ele sugerir remover esse índice, **não aceite**: ele é a garantia final da regra "uma principal por mês". (Não consegui verificar esse comportamento do Prisma neste ambiente.)
- Cliente do Prisma: depois de mudar o `schema.prisma`, rode `npx prisma generate` (o zip já inclui o cliente gerado).
