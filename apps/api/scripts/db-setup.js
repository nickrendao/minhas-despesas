// Aplica as migrations SQL (para DESENVOLVIMENTO LOCAL). Seguro rodar várias vezes: registra o que já foi aplicado.
// Em produção use `npm run db:migrate` (Prisma) num banco novo — não misture os dois no mesmo banco.
require('dotenv/config');
const fs = require('fs'), path = require('path'), { Client } = require('pg');
(async () => {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL não definida. Rode antes: node scripts/init-env.js'); process.exit(1); }
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  try { await c.connect(); } catch (e) { console.error('Não consegui conectar ao banco:', e.message, '\nRodou "node scripts/create-local-db.js SENHA"?'); process.exit(1); }
  await c.query('CREATE TABLE IF NOT EXISTS _dev_migrations(name text primary key, applied_at timestamptz not null default now())');
  const dir = path.join(__dirname, '../prisma/migrations');
  for (const name of fs.readdirSync(dir).filter((n) => /^\d+_/.test(n)).sort()) {
    if ((await c.query('SELECT 1 FROM _dev_migrations WHERE name=$1', [name])).rowCount) { console.log('já aplicada:', name); continue; }
    await c.query('BEGIN'); try { await c.query(fs.readFileSync(path.join(dir, name, 'migration.sql'), 'utf8')); await c.query('INSERT INTO _dev_migrations(name) VALUES ($1)', [name]); await c.query('COMMIT'); console.log('aplicada:', name); }
    catch (e) { await c.query('ROLLBACK'); console.error('FALHOU em', name, '->', e.message); process.exit(1); }
  }
  await c.end(); console.log('Banco pronto.');
})();
