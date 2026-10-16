// Cria o usuário e o banco de DESENVOLVIMENTO no seu PostgreSQL local.  Uso:  node scripts/create-local-db.js SENHA_DO_POSTGRES
const { Client } = require('../node_modules/pg');
const senha = process.argv[2];
if (!senha) { console.error('Informe a senha que você definiu ao instalar o PostgreSQL:\n  node scripts/create-local-db.js SUA_SENHA'); process.exit(1); }
(async () => {
  const c = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: senha, database: 'postgres' });
  try { await c.connect(); } catch (e) { console.error('Não consegui conectar ao PostgreSQL:', e.message, '\nConfira se ele está instalado/ligado e se a senha está certa.'); process.exit(1); }
  const hasRole = (await c.query("SELECT 1 FROM pg_roles WHERE rolname='fin'")).rowCount;
  if (!hasRole) await c.query("CREATE ROLE fin LOGIN PASSWORD 'fin_dev_pw'"); else await c.query("ALTER ROLE fin LOGIN PASSWORD 'fin_dev_pw'");
  const hasDb = (await c.query("SELECT 1 FROM pg_database WHERE datname='fin_dev'")).rowCount;
  if (!hasDb) await c.query('CREATE DATABASE fin_dev OWNER fin');
  console.log(`OK: usuário "fin" ${hasRole ? 'já existia (senha redefinida)' : 'criado'} e banco "fin_dev" ${hasDb ? 'já existia' : 'criado'}.`);
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
