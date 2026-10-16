import { Injectable } from '@nestjs/common';
import { prevYm } from '@fin/shared';
import { PrismaService } from '../prisma/prisma.service';
import { advisoryLock } from '../common/db';
import { AppError } from '../common/app-error';
import { expenseDto, incomeDto, INCOME_ORDER } from '../common/mappers';
import { ensurePrimary } from '../incomes/incomes.service';

@Injectable()
export class MonthsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * "Abrir" um mês. Na 1ª abertura, copia do mês anterior apenas o que está marcado como recorrente
   * (rendas e despesas, de forma independente). Idempotente: abrir de novo não copia nada.
   * MUDANÇA INTENCIONAL vs. site atual: lá, apagar tudo e recarregar fazia as recorrentes "ressuscitarem".
   */
  async open(userId: string, ym: string) {
    await this.prisma.$transaction(async (tx) => {
      await advisoryLock(tx, `month:${userId}:${ym}`);
      await advisoryLock(tx, `incomes:${userId}:${ym}`);   // mesma trava das rendas (ordem fixa: mês -> rendas)
      const ledger = await tx.monthLedger.findUnique({ where: { userId_ym: { userId, ym } } });
      if (ledger) return;
      await tx.monthLedger.create({ data: { userId, ym } });
      const prev = prevYm(ym);
      const [hasIncomes, hasExpenses] = await Promise.all([tx.income.count({ where: { userId, ym } }), tx.expense.count({ where: { userId, ym } })]);
      if (!hasIncomes) {
        const rec = await tx.income.findMany({ where: { userId, ym: prev, recurring: true }, orderBy: INCOME_ORDER });
        if (rec.length) {
          await tx.income.createMany({ data: rec.map((i) => ({ userId, ym, name: i.name, amountCents: i.amountCents, recurring: true, isPrimary: i.isPrimary })) });
          await ensurePrimary(tx, userId, ym);   // se a principal NÃO era recorrente, a mais antiga das copiadas assume
        }
      }
      if (!hasExpenses) {
        const rec = await tx.expense.findMany({ where: { userId, ym: prev, recurring: true }, orderBy: { createdAt: 'asc' } });
        if (rec.length) {
          await tx.expense.createMany({
            data: rec.map((e) => ({
              userId, ym, name: e.name, icon: e.icon, color: e.color, amountCents: e.amountCents, recurring: true,
              dueDay: e.dueDay, installmentCurrent: e.installmentCurrent, installmentTotal: e.installmentTotal,
            })),
          });
        }
      }
    });
    return this.snapshot(userId, ym);
  }

  async snapshot(userId: string, ym: string) {
    const [incomes, expenses] = await Promise.all([
      this.prisma.income.findMany({ where: { userId, ym }, orderBy: INCOME_ORDER }),
      this.prisma.expense.findMany({ where: { userId, ym }, orderBy: { createdAt: 'asc' } }),
    ]);
    return { ym, incomes: incomes.map(incomeDto), expenses: expenses.map(expenseDto) };
  }

  /** Copia TUDO (não só recorrentes) de um mês para outro — igual ao "copiar despesas" do site atual. */
  async copy(userId: string, from: string, target: string, overwrite: boolean) {
    if (from === target) throw new AppError(400, 'SAME_MONTH', 'O mês de destino deve ser diferente do de origem');
    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(tx, `month:${userId}:${target}`);
      await advisoryLock(tx, `incomes:${userId}:${target}`);
      const [incomes, expenses, tIncomes, tExpenses] = await Promise.all([
        tx.income.findMany({ where: { userId, ym: from }, orderBy: INCOME_ORDER }),
        tx.expense.findMany({ where: { userId, ym: from }, orderBy: { createdAt: 'asc' } }),
        tx.income.count({ where: { userId, ym: target } }),
        tx.expense.count({ where: { userId, ym: target } }),
      ]);
      if ((tIncomes > 0 || tExpenses > 0) && !overwrite) {
        throw new AppError(409, 'MONTH_NOT_EMPTY', 'O mês de destino já tem dados. Confirme para substituir.');
      }
      await tx.income.deleteMany({ where: { userId, ym: target } });
      await tx.expense.deleteMany({ where: { userId, ym: target } });
      if (incomes.length) await tx.income.createMany({ data: incomes.map((i) => ({ userId, ym: target, name: i.name, amountCents: i.amountCents, recurring: i.recurring, isPrimary: i.isPrimary })) });
      await ensurePrimary(tx, userId, target);
      if (expenses.length) {
        await tx.expense.createMany({
          data: expenses.map((e) => ({
            userId, ym: target, name: e.name, icon: e.icon, color: e.color, amountCents: e.amountCents, recurring: e.recurring,
            dueDay: e.dueDay, installmentCurrent: e.installmentCurrent, installmentTotal: e.installmentTotal,
          })),
        });
      }
      await tx.monthLedger.upsert({ where: { userId_ym: { userId, ym: target } }, create: { userId, ym: target }, update: {} });
      return { copiedIncomes: incomes.length, copiedExpenses: expenses.length };
    });
  }
}
