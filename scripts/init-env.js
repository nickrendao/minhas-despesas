// Cria os arquivos de configuração LOCAIS (com um segredo aleatório novo). Não sobrescreve arquivos que já existem.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const write = (p, c) => { if (fs.existsSync(p)) return console.log('já existe (mantido):', path.relative(process.cwd(), p)); fs.writeFileSync(p, c); console.log('criado:', path.relative(process.cwd(), p)); };
const root = path.join(__dirname, '..');
write(path.join(root, 'apps/api/.env'), [
  'NODE_ENV=development', 'PORT=3333',
  'DATABASE_URL=postgresql://fin:fin_dev_pw@localhost:5432/fin_dev',
  `JWT_ACCESS_SECRET=${crypto.randomBytes(48).toString('base64url')}`,
  'CORS_ORIGINS=http://localhost:3000', 'WEB_URL=http://localhost:3000',
  '# Local: sem e-mail real, então não exige confirmar o e-mail. EM PRODUÇÃO use true.', 'REQUIRE_EMAIL_VERIFICATION=false', 'MAIL_MODE=console', 'TRUST_PROXY=0', ''].join('\n'));
write(path.join(root, 'apps/web/.env.local'), ['NEXT_PUBLIC_API_URL=http://localhost:3333/api/v1', 'API_URL=http://localhost:3333/api/v1', ''].join('\n'));
