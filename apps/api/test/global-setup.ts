import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

/**
 * Recria o schema do zero, simula os papéis do Supabase (anon/authenticated) e aplica
 * TODAS as migrations reais, em ordem — exatamente o que vai para produção.
 * Requer um usuário de banco com permissão de criar papéis (o docker-compose já fornece).
 */
export default async function () {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://fin:fin_dev_pw@localhost:5432/fin_test';
  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  END $$;`);
  await c.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT USAGE ON SCHEMA public TO anon, authenticated;');
  // como no Supabase: papéis anon/authenticated recebem privilégios padrão em tabelas novas do schema public
  await c.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;');
  const dir = join(__dirname, '../prisma/migrations');
  for (const name of readdirSync(dir).filter((n) => /^\d+_/.test(n)).sort()) {
    await c.query(readFileSync(join(dir, name, 'migration.sql'), 'utf8'));
  }
  await c.end();
}
