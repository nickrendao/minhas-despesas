import { Injectable } from '@nestjs/common';
import { DEFAULT_TIMEZONE, todayIn } from '@fin/shared';
import { PrismaService } from '../prisma/prisma.service';
import { computeDues, monthSummary, yearlyStats } from '../domain/finance';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async tz(userId: string) {
    const s = await this.prisma.userSettings.findUnique({ where: { userId } });
    return { timezone: s?.timezone ?? DEFAULT_TIMEZONE, goalCents: s?.monthlyGoalCents ?? 0 };
  }

  async summary(userId: string, ym: string, reserveMonths: number) {
    const [{ goalCents }, incomes, expenses] = await Promise.all([
      this.tz(userId),
      this.prisma.income.findMany({ where: { userId, ym } }),
      this.prisma.expense.findMany({ where: { userId, ym }, orderBy: { createdAt: 'asc' } }),
    ]);
    return { ym, ...monthSummary({
      incomeCents: incomes.map((i) => i.amountCents), goalCents, reserveMonths,
      expenses: expenses.map((e) => ({ id: e.id, name: e.name, color: e.color, amountCents: e.amountCents, recurring: e.recurring })),
    }) };
  }

  /** Só soma meses que têm dados gravados (igual ao site atual: não "abre" meses nem copia recorrência). */
  async yearly(userId: string, year: number) {
    const prefix = `${year}-`;
    const [exp, inc] = await Promise.all([
      this.prisma.expense.groupBy({ by: ['ym'], where: { userId, ym: { startsWith: prefix } }, _sum: { amountCents: true } }),
      this.prisma.income.groupBy({ by: ['ym'], where: { userId, ym: { startsWith: prefix } }, _sum: { amountCents: true } }),
    ]);
    const e = new Map(exp.map((r) => [r.ym, r._sum.amountCents ?? 0]));
    const i = new Map(inc.map((r) => [r.ym, r._sum.amountCents ?? 0]));
    const months = Array.from({ length: 12 }, (_, k) => {
      const ym = `${year}-${String(k + 1).padStart(2, '0')}`;
      return { ym, expensesCents: e.get(ym) ?? 0, incomeCents: i.get(ym) ?? 0 };
    });
    return { year, months, ...yearlyStats(months) };
  }

  async dues(userId: string, ym: string, limit: number | null = 3) {
    const { timezone } = await this.tz(userId);
    const rows = await this.prisma.expense.findMany({ where: { userId, ym, dueDay: { not: null } } });
    return computeDues(rows.map((r) => ({ id: r.id, name: r.name, amountCents: r.amountCents, dueDay: r.dueDay!, createdAt: r.createdAt })), ym, todayIn(timezone), limit);
  }

  /** Agenda: vencimentos dos próximos N meses (a partir do mês atual no fuso do usuário). */
  async agenda(userId: string, months: number) {
    const { timezone } = await this.tz(userId);
    const today = todayIn(timezone);
    const [y, m] = today.ym.split('-').map(Number);
    const out: { ym: string; dueDay: number; expenseId: string; name: string; amountCents: number }[] = [];
    for (let k = 0; k < months; k++) {
      const d = new Date(Date.UTC(y, m - 1 + k, 1));
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const rows = await this.prisma.expense.findMany({ where: { userId, ym, dueDay: { not: null } }, orderBy: [{ dueDay: 'asc' }, { createdAt: 'asc' }] });
      rows.forEach((r) => out.push({ ym, dueDay: r.dueDay!, expenseId: r.id, name: r.name, amountCents: r.amountCents }));
    }
    return out;
  }
}
