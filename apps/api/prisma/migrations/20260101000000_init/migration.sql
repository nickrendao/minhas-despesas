-- Migration inicial: modelo normalizado do Minhas Despesas.
-- Dinheiro = INTEGER em centavos. Mês = CHAR(7) 'AAAA-MM' (sem fuso horário).
-- Os CHECKs garantem a integridade no banco, mesmo que um bug passe pela API.

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "password_algo" TEXT NOT NULL DEFAULT 'scrypt',
    "email_verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_email_lower_chk" CHECK ("email" = lower("email")),
    CONSTRAINT "users_password_algo_chk" CHECK ("password_algo" IN ('scrypt','bcrypt'))
);

CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_tokens_type_chk" CHECK ("type" IN ('EMAIL_VERIFY','PASSWORD_RESET'))
);

CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_id" UUID,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_settings" (
    "user_id" UUID NOT NULL,
    "display_name" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'pt',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "monthly_goal_cents" INTEGER NOT NULL DEFAULT 0,
    "privacy_mode" BOOLEAN NOT NULL DEFAULT false,
    "privacy_pin_hash" TEXT,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "name_asked" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "user_settings_locale_chk" CHECK ("locale" IN ('pt','en','es','fr')),
    CONSTRAINT "user_settings_theme_chk" CHECK ("theme" IN ('light','dark')),
    CONSTRAINT "user_settings_goal_chk" CHECK ("monthly_goal_cents" BETWEEN 0 AND 2000000000)
);

CREATE TABLE "month_ledger" (
    "user_id" UUID NOT NULL,
    "ym" CHAR(7) NOT NULL,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "month_ledger_pkey" PRIMARY KEY ("user_id","ym"),
    CONSTRAINT "month_ledger_ym_chk" CHECK ("ym" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

CREATE TABLE "incomes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "ym" CHAR(7) NOT NULL,
    "name" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL DEFAULT 0,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incomes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "incomes_ym_chk" CHECK ("ym" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT "incomes_amount_chk" CHECK ("amount_cents" BETWEEN 0 AND 2000000000),
    CONSTRAINT "incomes_name_chk" CHECK (char_length("name") BETWEEN 1 AND 24)
);

CREATE TABLE "expenses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "ym" CHAR(7) NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🧾',
    "color" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL DEFAULT 0,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "due_day" SMALLINT,
    "installment_current" SMALLINT,
    "installment_total" SMALLINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "expenses_ym_chk" CHECK ("ym" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT "expenses_amount_chk" CHECK ("amount_cents" BETWEEN 0 AND 2000000000),
    CONSTRAINT "expenses_color_chk" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT "expenses_due_day_chk" CHECK ("due_day" IS NULL OR "due_day" BETWEEN 1 AND 31),
    CONSTRAINT "expenses_installments_chk" CHECK (
      ("installment_current" IS NULL OR "installment_current" BETWEEN 1 AND 99) AND
      ("installment_total" IS NULL OR "installment_total" BETWEEN 1 AND 99) AND
      ("installment_current" IS NULL OR "installment_total" IS NULL OR "installment_current" <= "installment_total")
    )
);

CREATE TABLE "credit_cards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "limit_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_cards_color_chk" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT "credit_cards_limit_chk" CHECK ("limit_cents" BETWEEN 0 AND 2000000000)
);

CREATE TABLE "card_purchases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "card_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "installment_current" SMALLINT,
    "installment_total" SMALLINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "card_purchases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "card_purchases_amount_chk" CHECK ("amount_cents" BETWEEN 0 AND 2000000000),
    CONSTRAINT "card_purchases_installments_chk" CHECK (
      ("installment_current" IS NULL OR "installment_current" BETWEEN 1 AND 99) AND
      ("installment_total" IS NULL OR "installment_total" BETWEEN 1 AND 99) AND
      ("installment_current" IS NULL OR "installment_total" IS NULL OR "installment_current" <= "installment_total")
    )
);

CREATE TABLE "investment_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "target_limit_cents" INTEGER NOT NULL DEFAULT 0,
    "monthly_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "investment_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "investment_plans_type_chk" CHECK ("type" IN ('tesouro_selic','cdb','fundos_di','poupanca','acoes','fiis','cripto','outro')),
    CONSTRAINT "investment_plans_target_chk" CHECK ("target_limit_cents" BETWEEN 0 AND 2000000000),
    CONSTRAINT "investment_plans_monthly_chk" CHECK ("monthly_amount_cents" BETWEEN 0 AND 2000000000)
);

CREATE TABLE "crypto_holdings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "coin_id" TEXT,
    "quantity" DECIMAL(30,12) NOT NULL DEFAULT 0,
    "buy_price_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crypto_holdings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crypto_holdings_quantity_chk" CHECK ("quantity" >= 0),
    CONSTRAINT "crypto_holdings_price_chk" CHECK ("buy_price_cents" BETWEEN 0 AND 2000000000)
);

-- Índices
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");
CREATE INDEX "auth_tokens_user_id_type_idx" ON "auth_tokens"("user_id", "type");
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");
CREATE INDEX "incomes_user_id_ym_idx" ON "incomes"("user_id", "ym");
CREATE INDEX "expenses_user_id_ym_idx" ON "expenses"("user_id", "ym");
CREATE INDEX "credit_cards_user_id_idx" ON "credit_cards"("user_id");
CREATE INDEX "card_purchases_card_id_idx" ON "card_purchases"("card_id");
CREATE INDEX "card_purchases_user_id_idx" ON "card_purchases"("user_id");
CREATE INDEX "investment_plans_user_id_idx" ON "investment_plans"("user_id");
CREATE INDEX "crypto_holdings_user_id_idx" ON "crypto_holdings"("user_id");

-- Chaves estrangeiras (apagar o usuário apaga TODOS os dados dele: direito ao esquecimento / LGPD)
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "month_ledger" ADD CONSTRAINT "month_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_purchases" ADD CONSTRAINT "card_purchases_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_purchases" ADD CONSTRAINT "card_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investment_plans" ADD CONSTRAINT "investment_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crypto_holdings" ADD CONSTRAINT "crypto_holdings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
