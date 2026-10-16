import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { notFound } from '../common/app-error';
import { cryptoPosition, cryptoTotals } from '../domain/finance';
import { PriceProvider } from './price.provider';

@Injectable()
export class CryptoService {
  constructor(private readonly prisma: PrismaService, private readonly prices: PriceProvider) {}

  private dto(h: any) { return { id: h.id, coinId: h.coinId, quantity: h.quantity.toFixed(), buyPriceCents: h.buyPriceCents, createdAt: h.createdAt }; }

  async list(userId: string) { return (await this.prisma.cryptoHolding.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })).map((h) => this.dto(h)); }
  async create(userId: string, b: any) { return this.dto(await this.prisma.cryptoHolding.create({ data: { userId, ...b } })); }
  async update(userId: string, id: string, data: Record<string, unknown>) {
    if (!(await this.prisma.cryptoHolding.findFirst({ where: { id, userId } }))) throw notFound('Criptomoeda');
    return this.dto(await this.prisma.cryptoHolding.update({ where: { id }, data }));
  }
  async remove(userId: string, id: string) {
    const r = await this.prisma.cryptoHolding.deleteMany({ where: { id, userId } });
    if (r.count === 0) throw notFound('Criptomoeda');
  }

  async valuation(userId: string) {
    const holdings = await this.prisma.cryptoHolding.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    const ids = holdings.map((h) => h.coinId).filter((x): x is string => !!x);
    const prices = ids.length ? await this.prices.getBrlPrices(ids) : {};
    const items = holdings.map((h) => {
      const p = h.coinId ? prices[h.coinId] : undefined;
      return {
        ...this.dto(h),
        priceAvailable: !!p,
        currentPriceCents: p ? Math.round(p.brl * 100) : null,
        change24hPercent: p?.change24h ?? null,
        ...cryptoPosition(h.quantity, h.buyPriceCents, p ? p.brl : null),
      };
    });
    return { items, totals: cryptoTotals(items), asOf: new Date().toISOString() };
  }
}
