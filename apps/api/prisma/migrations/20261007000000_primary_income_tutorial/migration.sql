-- Renda principal + versão do tutorial.
-- REGRA: se um mês tem rendas, EXATAMENTE UMA é a principal.

ALTER TABLE "incomes" ADD COLUMN "is_primary" BOOLEAN NOT NULL DEFAULT false;

-- Contas existentes: a renda mais antiga de cada mês passa a ser a principal (BACKFILL).
UPDATE "incomes" i SET "is_primary" = true
FROM (SELECT DISTINCT ON ("user_id", "ym") "id" FROM "incomes" ORDER BY "user_id", "ym", "created_at" ASC, "id" ASC) f
WHERE i."id" = f."id";

-- Garantia no BANCO (além da lógica do serviço): nunca duas principais no mesmo mês da mesma pessoa.
CREATE UNIQUE INDEX "incomes_one_primary_per_month" ON "incomes" ("user_id", "ym") WHERE "is_primary";

-- Ícone padrão da despesa: chave de ícone de linha (as despesas antigas, com emoji, continuam como estão e são exibidas com o ícone equivalente).
ALTER TABLE "expenses" ALTER COLUMN "icon" SET DEFAULT 'receipt';

-- Versão do tutorial já visto. 0 = nunca viu. Quem tem versão menor que a atual do app vê o tutorial uma vez
-- (inclusive contas migradas do site antigo: o campo "onboarded" do tutorial ANTIGO não vale para este).
ALTER TABLE "user_settings" ADD COLUMN "tutorial_version" INTEGER NOT NULL DEFAULT 0;
