import { Injectable } from '@nestjs/common';
import { MAX_INCOMES_PER_MONTH } from '@fin/shared';
import { PrismaService } from '../prisma/prisma.service';
import { advisoryLock } from '../common/db';
import { AppError, notFound } from '../common/app-error';
import { incomeDto, INCOME_ORDER } from '../common/mappers';

/**
 * REGRA DA RENDA PRINCIPAL: se o mês tem rendas, EXATAMENTE UMA é a principal.
 *  - a primeira renda do mês vira principal sozinha;
 *  - marcar outra como principal troca (a anterior deixa de ser) — tudo na mesma transação, sob trava do mês;
 *  - não dá para "desmarcar" a principal: é preciso escolher outra (evita mês sem principal);
 *  - apagar a principal promove a renda mais antiga que restar.
 * Além disto, um índice único parcial no banco impede duas principais no mesmo mês.
 */
@Injectable()
export class IncomesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, ym: string) {
    return (await this.prisma.income.findMany({ where: { userId, ym }, orderBy: INCOME_ORDER })).map(incomeDto);
  }

  async create(userId: string, b: { ym: string; name: string; amountCents: number; recurring: boolean; isPrimary?: boolean }) {
    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(tx, `incomes:${userId}:${b.ym}`);
      if ((await tx.income.count({ where: { userId, ym: b.ym } })) >= MAX_INCOMES_PER_MONTH) {
        throw new AppError(409, 'LIMIT_REACHED', `Você pode ter no máximo ${MAX_INCOMES_PER_MONTH} rendas por mês`);
      }
      const hasPrimary = (await tx.income.count({ where: { userId, ym: b.ym, isPrimary: true } })) > 0;
      const makePrimary = b.isPrimary === true || !hasPrimary;
      if (makePrimary && hasPrimary) await tx.income.updateMany({ where: { userId, ym: b.ym, isPrimary: true }, data: { isPrimary: false } });
      return incomeDto(await tx.income.create({ data: { userId, ym: b.ym, name: b.name, amountCents: b.amountCents, recurring: b.recurring, isPrimary: makePrimary } }));
    });
  }

  async update(userId: string, id: string, data: { name?: string; amountCents?: number; recurring?: boolean; isPrimary?: boolean }) {
    return this.prisma.$transaction(async (tx) => {
      const pre = await tx.income.findFirst({ where: { id, userId }, select: { ym: true } });
      if (!pre) throw notFound('Renda');
      await advisoryLock(tx, `incomes:${userId}:${pre.ym}`);
      // RELER depois da trava: enquanto esperava, outro pedido pode ter trocado a principal (ou apagado esta renda)
      const found = await tx.income.findFirst({ where: { id, userId } });
      if (!found) throw notFound('Renda');
      const { isPrimary, ...rest } = data;
      if (isPrimary === false && found.isPrimary) throw new AppError(409, 'PRIMARY_REQUIRED', 'Para trocar a renda principal, marque outra renda como principal.');
      if (isPrimary === true && !found.isPrimary) await tx.income.updateMany({ where: { userId, ym: found.ym, isPrimary: true }, data: { isPrimary: false } });
      return incomeDto(await tx.income.update({ where: { id }, data: { ...rest, ...(isPrimary === true ? { isPrimary: true } : {}) } }));
    });
  }

  async remove(userId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const pre = await tx.income.findFirst({ where: { id, userId }, select: { ym: true } });
      if (!pre) throw notFound('Renda');
      await advisoryLock(tx, `incomes:${userId}:${pre.ym}`);
      const found = await tx.income.findFirst({ where: { id, userId } });   // relê sob a trava
      if (!found) throw notFound('Renda');
      await tx.income.delete({ where: { id } });
      if (found.isPrimary) await ensurePrimary(tx, userId, found.ym);   // promove a mais antiga que restar
    });
  }
}

/** Garante a regra "exatamente uma principal" no mês (promove a renda mais antiga se não houver). Chamar dentro de transação. */
export async function ensurePrimary(tx: any, userId: string, ym: string) {
  const [total, primaries] = await Promise.all([tx.income.count({ where: { userId, ym } }), tx.income.count({ where: { userId, ym, isPrimary: true } })]);
  if (total > 0 && primaries === 0) {
    const first = await tx.income.findFirst({ where: { userId, ym }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    if (first) await tx.income.update({ where: { id: first.id }, data: { isPrimary: true } });
  }
}
