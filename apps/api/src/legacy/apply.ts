import { PrismaClient } from '../generated/prisma/client';
import { PasswordService } from '../auth/password.service';
import { MigrationPlan } from './transform';

export interface UserReport {
  userId: string; email: string | null;
  status: 'migrated' | 'skipped_exists' | 'skipped_no_auth' | 'failed' | 'dry_run';
  warnings: string[]; error?: string;
  check?: { ok: boolean; problems: string[]; counts: Record<string, number>; expensesCents: number; incomesCents: number; purchasesCents: number };
}

/** Grava o plano de UM usuário em UMA transação (tudo ou nada). Conferência automática ao final. */
export async function applyPlan(prisma: PrismaClient, plan: MigrationPlan, opts: { refresh: boolean }): Promise<UserReport> {
  const base = { userId: plan.userId, email: plan.user?.email ?? null, warnings: plan.warnings };
  if (!plan.user) return { ...base, status: 'skipped_no_auth' };

  const exists = await prisma.user.findUnique({ where: { id: plan.userId } });
  if (exists && !opts.refresh) return { ...base, status: 'skipped_exists' };

  const pinHash = plan.settings.pinPlain ? await new PasswordService().hash(plan.settings.pinPlain) : null;
  try {
    const check = await prisma.$transaction(async (tx) => {
      const uid = plan.userId;
      if (exists) {
        // --refresh: substitui SÓ os dados de negócio; conta e senha (que podem ter sido alteradas) permanecem
        await tx.income.deleteMany({ where: { userId: uid } }); await tx.expense.deleteMany({ where: { userId: uid } });
        await tx.monthLedger.deleteMany({ where: { userId: uid } }); await tx.creditCard.deleteMany({ where: { userId: uid } });
        await tx.investmentPlan.deleteMany({ where: { userId: uid } }); await tx.cryptoHolding.deleteMany({ where: { userId: uid } });
      } else {
        await tx.user.create({ data: { id: uid, email: plan.user!.email, passwordHash: plan.user!.passwordHash, passwordAlgo: plan.user!.passwordAlgo, emailVerifiedAt: plan.user!.emailVerifiedAt } });
      }
      const s = plan.settings;
      const sData = { displayName: s.displayName, locale: s.locale, theme: s.theme, monthlyGoalCents: s.monthlyGoalCents, privacyMode: s.privacyMode, privacyPinHash: pinHash, onboarded: s.onboarded, nameAsked: s.nameAsked };
      await tx.userSettings.upsert({ where: { userId: uid }, create: { userId: uid, ...sData }, update: sData });

      for (const m of plan.months) {
        await tx.monthLedger.create({ data: { userId: uid, ym: m.ym } }); // mês já existia => recorrência não recopia
        if (m.incomes.length) await tx.income.createMany({ data: m.incomes.map((i, idx) => ({ userId: uid, ym: m.ym, ...i, isPrimary: idx === 0 })) });   // a primeira renda de cada mês vira a principal
        if (m.expenses.length) await tx.expense.createMany({ data: m.expenses.map((e) => ({ userId: uid, ym: m.ym, ...e })) });
      }
      for (const c of plan.cards) {
        const card = await tx.creditCard.create({ data: { userId: uid, name: c.name, color: c.color, limitCents: c.limitCents } });
        if (c.purchases.length) await tx.cardPurchase.createMany({ data: c.purchases.map((p) => ({ userId: uid, cardId: card.id, ...p })) });
      }
      if (plan.investments.length) await tx.investmentPlan.createMany({ data: plan.investments.map((i) => ({ userId: uid, ...i })) });
      if (plan.crypto.length) await tx.cryptoHolding.createMany({ data: plan.crypto.map((h) => ({ userId: uid, ...h })) });

      // ----- conferência dentro da própria transação: se algo não bater, TUDO é desfeito -----
      const [months, incomes, expenses, cards, purchases, investments, crypto, ex, inc, pur] = await Promise.all([
        tx.monthLedger.count({ where: { userId: uid } }), tx.income.count({ where: { userId: uid } }), tx.expense.count({ where: { userId: uid } }),
        tx.creditCard.count({ where: { userId: uid } }), tx.cardPurchase.count({ where: { userId: uid } }), tx.investmentPlan.count({ where: { userId: uid } }),
        tx.cryptoHolding.count({ where: { userId: uid } }),
        tx.expense.aggregate({ where: { userId: uid }, _sum: { amountCents: true } }), tx.income.aggregate({ where: { userId: uid }, _sum: { amountCents: true } }),
        tx.cardPurchase.aggregate({ where: { userId: uid }, _sum: { amountCents: true } }),
      ]);
      const got = { months, incomes, expenses, cards, purchases, investments, crypto };
      const problems: string[] = [];
      for (const k of Object.keys(got) as (keyof typeof got)[]) {
        if (got[k] !== plan.legacyTotals.counts[k]) problems.push(`Quantidade de ${k}: esperado ${plan.legacyTotals.counts[k]}, gravado ${got[k]}`);
      }
      const eC = ex._sum.amountCents ?? 0, iC = inc._sum.amountCents ?? 0, pC = pur._sum.amountCents ?? 0;
      // tolerância = meio centavo por item (diferença possível só do arredondamento float -> centavos)
      const tol = (n: number) => 0.005 * Math.max(n, 1) + 1e-6;
      if (Math.abs(eC / 100 - plan.legacyTotals.expensesReais) > tol(expenses)) problems.push(`Soma das despesas: legado R$ ${plan.legacyTotals.expensesReais.toFixed(2)} x novo R$ ${(eC / 100).toFixed(2)}`);
      if (Math.abs(iC / 100 - plan.legacyTotals.incomesReais) > tol(incomes)) problems.push(`Soma das rendas: legado R$ ${plan.legacyTotals.incomesReais.toFixed(2)} x novo R$ ${(iC / 100).toFixed(2)}`);
      if (Math.abs(pC / 100 - plan.legacyTotals.cardPurchasesReais) > tol(purchases)) problems.push(`Soma das compras de cartão: legado R$ ${plan.legacyTotals.cardPurchasesReais.toFixed(2)} x novo R$ ${(pC / 100).toFixed(2)}`);
      if (problems.length) throw new Error('CONFERÊNCIA FALHOU: ' + problems.join(' | '));
      return { ok: true, problems, counts: got, expensesCents: eC, incomesCents: iC, purchasesCents: pC };
    }, { timeout: 60_000 });
    return { ...base, status: 'migrated', check };
  } catch (e) {
    return { ...base, status: 'failed', error: (e as Error).message };
  }
}
