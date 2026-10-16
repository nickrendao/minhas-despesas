/**
 * Migra os dados do site atual (tabela `app_data` do Supabase) para o modelo normalizado.
 *
 *   DRY-RUN (padrão, não grava nada):   npm run migrate:legacy
 *   Gravar de verdade:                  npm run migrate:legacy -- --apply
 *   Reaplicar (substitui dados de negócio de quem já foi migrado, p/ capturar últimas alterações antes da virada):
 *                                       npm run migrate:legacy -- --apply --refresh
 *   Só um usuário:                      npm run migrate:legacy -- --user <uuid>
 *
 * Variáveis: DATABASE_URL (destino)  e opcionalmente LEGACY_DATABASE_URL (origem; padrão = mesmo banco).
 * Segurança: antes de gravar, salva um BACKUP COMPLETO do app_data em ./backups (guarde em local privado!).
 */
import 'dotenv/config';
import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { transformLegacyUser } from '../src/legacy/transform';
import { applyPlan, UserReport } from '../src/legacy/apply';

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply'), refresh = args.includes('--refresh');
  const only = args.includes('--user') ? args[args.indexOf('--user') + 1] : null;
  const target = process.env.DATABASE_URL; if (!target) throw new Error('Defina DATABASE_URL');
  const legacyUrl = process.env.LEGACY_DATABASE_URL ?? target;

  const legacy = new Client({ connectionString: legacyUrl }); await legacy.connect();
  const rows = (await legacy.query<{ user_id: string; data: Record<string, unknown> }>('SELECT user_id, data FROM public.app_data' + (only ? ' WHERE user_id = $1' : ''), only ? [only] : [])).rows;
  const ids = rows.map((r) => r.user_id);
  let auth: Record<string, any> = {};
  try {
    const a = await legacy.query('SELECT id, email, encrypted_password, email_confirmed_at FROM auth.users WHERE id = ANY($1::uuid[])', [ids]);
    auth = Object.fromEntries(a.rows.map((r) => [r.id, { id: r.id, email: r.email, encryptedPassword: r.encrypted_password, emailConfirmedAt: r.email_confirmed_at }]));
  } catch (e) { console.error('⚠️  Não consegui ler auth.users (use a conexão DIRETA do Supabase com o usuário postgres):', (e as Error).message); }
  await legacy.end();

  console.log(`\n${apply ? '🚀 APLICANDO' : '🔎 DRY-RUN (nada será gravado)'} — ${rows.length} usuário(s) encontrados em app_data\n`);

  if (apply) {
    mkdirSync('backups', { recursive: true });
    const file = join('backups', `app_data-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    writeFileSync(file, JSON.stringify(rows, null, 2), { mode: 0o600 });
    console.log(`💾 Backup completo salvo em ${file} (contém dados pessoais: NÃO envie para o Git)\n`);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: target }) });
  const reports: UserReport[] = [];
  for (const r of rows) {
    const plan = transformLegacyUser(r.user_id, r.data ?? {}, auth[r.user_id] ?? null);
    const rep: UserReport = apply ? await applyPlan(prisma, plan, { refresh }) : { userId: plan.userId, email: plan.user?.email ?? null, status: plan.user ? 'dry_run' : 'skipped_no_auth', warnings: plan.warnings };
    reports.push(rep);
    const icon = { migrated: '✅', dry_run: '🔎', skipped_exists: '⏭️ ', skipped_no_auth: '⚠️ ', failed: '❌' }[rep.status];
    console.log(`${icon} ${rep.email ?? rep.userId}  [${rep.status}]  meses=${plan.months.length} despesas=${plan.legacyTotals.counts.expenses} cartões=${plan.cards.length}`);
    rep.warnings.forEach((w) => console.log(`     ⚠ ${w}`));
    if (rep.error) console.log(`     ✖ ${rep.error}`);
  }
  await prisma.$disconnect();
  const failed = reports.filter((r) => r.status === 'failed').length;
  console.log(`\nResumo: ${reports.filter((r) => r.status === 'migrated').length} migrados, ${reports.filter((r) => r.status === 'skipped_exists').length} já existiam, ${reports.filter((r) => r.status === 'skipped_no_auth').length} sem conta de login, ${failed} com falha.`);
  if (!apply) console.log('Para gravar de verdade: npm run migrate:legacy -- --apply');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
