-- SEGURANÇA (crítico em hospedagem Supabase):
-- O Supabase publica automaticamente, via API REST (PostgREST), as tabelas do schema "public"
-- para os papéis "anon" e "authenticated". A chave "anon" é PÚBLICA (fica no HTML do site).
-- Sem esta migration, qualquer pessoa na internet poderia ler/alterar as tabelas abaixo
-- (inclusive hashes de senha). A API NestJS conecta com o papel dono das tabelas, que não é afetado.

ALTER TABLE "users"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_tokens"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_settings"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "month_ledger"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incomes"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expenses"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_cards"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "card_purchases"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "investment_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crypto_holdings"  ENABLE ROW LEVEL SECURITY;

-- Defesa em profundidade: além do RLS (sem nenhuma policy = nega tudo), remove os privilégios.
-- Só toca nas tabelas NOVAS: a tabela legada "app_data" segue funcionando para o site atual até a virada.
DO $$
DECLARE r text; t text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      FOREACH t IN ARRAY ARRAY['users','auth_tokens','refresh_tokens','user_settings','month_ledger','incomes','expenses','credit_cards','card_purchases','investment_plans','crypto_holdings'] LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', t, r);
      END LOOP;
    END IF;
  END LOOP;
END $$;
