import { Injectable } from '@nestjs/common';
import { MAX_CREDIT_CARDS } from '@fin/shared';
import { PrismaService } from '../prisma/prisma.service';
import { advisoryLock } from '../common/db';
import { AppError, notFound } from '../common/app-error';
import { purchaseDto } from '../common/mappers';
import { cardUsage } from '../domain/finance';

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  private view(card: any) {
    const purchases = (card.purchases ?? []).map(purchaseDto);
    return {
      id: card.id, name: card.name, color: card.color, limitCents: card.limitCents, createdAt: card.createdAt,
      ...cardUsage(card.limitCents, purchases.map((p: any) => p.amountCents)),
      purchases,
    };
  }

  async list(userId: string) {
    const cards = await this.prisma.creditCard.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, include: { purchases: { orderBy: { createdAt: 'asc' } } } });
    return cards.map((c) => this.view(c));
  }

  async get(userId: string, id: string) {
    const c = await this.prisma.creditCard.findFirst({ where: { id, userId }, include: { purchases: { orderBy: { createdAt: 'asc' } } } });
    if (!c) throw notFound('Cartão');
    return this.view(c);
  }

  async create(userId: string, b: { name: string; color: string; limitCents: number }) {
    const card = await this.prisma.$transaction(async (tx) => {
      await advisoryLock(tx, `cards:${userId}`);
      if ((await tx.creditCard.count({ where: { userId } })) >= MAX_CREDIT_CARDS) {
        throw new AppError(409, 'LIMIT_REACHED', `Você pode ter no máximo ${MAX_CREDIT_CARDS} cartões`);
      }
      return tx.creditCard.create({ data: { userId, ...b }, include: { purchases: true } });
    });
    return this.view(card);
  }

  async update(userId: string, id: string, data: Record<string, unknown>) {
    if (!(await this.prisma.creditCard.findFirst({ where: { id, userId } }))) throw notFound('Cartão');
    await this.prisma.creditCard.update({ where: { id }, data });
    return this.get(userId, id);
  }

  async remove(userId: string, id: string) {
    const r = await this.prisma.creditCard.deleteMany({ where: { id, userId } }); // purchases: ON DELETE CASCADE
    if (r.count === 0) throw notFound('Cartão');
  }

  async addPurchase(userId: string, cardId: string, b: any) {
    if (!(await this.prisma.creditCard.findFirst({ where: { id: cardId, userId } }))) throw notFound('Cartão');
    return purchaseDto(await this.prisma.cardPurchase.create({
      data: { userId, cardId, name: b.name, amountCents: b.amountCents, installmentCurrent: b.installmentCurrent ?? null, installmentTotal: b.installmentTotal ?? null },
    }));
  }

  async removePurchase(userId: string, cardId: string, id: string) {
    const r = await this.prisma.cardPurchase.deleteMany({ where: { id, cardId, userId } });
    if (r.count === 0) throw notFound('Gasto');
  }
}
