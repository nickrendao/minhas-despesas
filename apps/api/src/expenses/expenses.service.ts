import { Injectable } from '@nestjs/common';
import { PALETTE } from '@fin/shared';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppError, notFound } from '../common/app-error';
import { expenseDto } from '../common/mappers';
import { Paginated } from '../common/response.interceptor';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sem `ym` = busca em todos os meses (a "lupa" do site atual). */
  async list(userId: string, q: { ym?: string; type?: 'fixed' | 'variable'; q?: string; page: number; limit: number }) {
    const where: Prisma.ExpenseWhereInput = {
      userId,
      ...(q.ym ? { ym: q.ym } : {}),
      ...(q.type ? { recurring: q.type === 'fixed' } : {}),
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({ where, orderBy: [{ ym: 'desc' }, { createdAt: 'asc' }], skip: (q.page - 1) * q.limit, take: q.limit }),
    ]);
    return new Paginated(rows.map(expenseDto), { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) });
  }

  async create(userId: string, b: any) {
    const color: string = b.color ?? PALETTE[(await this.prisma.expense.count({ where: { userId, ym: b.ym } })) % PALETTE.length];
    return expenseDto(await this.prisma.expense.create({
      data: { userId, ym: b.ym, name: b.name, icon: b.icon, color, amountCents: b.amountCents, recurring: b.recurring,
        dueDay: b.dueDay ?? null, installmentCurrent: b.installmentCurrent ?? null, installmentTotal: b.installmentTotal ?? null },
    }));
  }

  async update(userId: string, id: string, data: Record<string, unknown>) {
    const found = await this.prisma.expense.findFirst({ where: { id, userId } });
    if (!found) throw notFound('Despesa');
    // Valida a combinação final (campo novo + o que já estava salvo): parcela atual <= total.
    const cur = 'installmentCurrent' in data ? (data.installmentCurrent as number | null) : found.installmentCurrent;
    const tot = 'installmentTotal' in data ? (data.installmentTotal as number | null) : found.installmentTotal;
    if (cur != null && tot != null && cur > tot) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos', [{ path: 'installmentCurrent', message: 'A parcela atual não pode ser maior que o total' }]);
    }
    return expenseDto(await this.prisma.expense.update({ where: { id }, data }));
  }

  async remove(userId: string, id: string) {
    const r = await this.prisma.expense.deleteMany({ where: { id, userId } });
    if (r.count === 0) throw notFound('Despesa');
  }
}
