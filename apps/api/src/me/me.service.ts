import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';
import { expenseDto, incomeDto, investmentDto } from '../common/mappers';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService, private readonly passwords: PasswordService) {}

  private settingsDto(s: any) {
    return {
      displayName: s.displayName, locale: s.locale, theme: s.theme, timezone: s.timezone, monthlyGoalCents: s.monthlyGoalCents,
      privacyMode: s.privacyMode, hasPin: !!s.privacyPinHash, onboarded: s.onboarded, nameAsked: s.nameAsked, tutorialVersion: s.tutorialVersion,
    };
  }
  private getSettings(userId: string) {
    return this.prisma.userSettings.upsert({ where: { userId }, create: { userId }, update: {} });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { id: user.id, email: user.email, emailVerified: !!user.emailVerifiedAt, createdAt: user.createdAt, settings: this.settingsDto(await this.getSettings(userId)) };
  }

  async updateSettings(userId: string, data: Record<string, unknown>) {
    await this.getSettings(userId);
    return this.settingsDto(await this.prisma.userSettings.update({ where: { userId }, data }));
  }

  /** O PIN é só uma trava de privacidade de tela (não é segurança forte) — mas nunca é guardado em texto puro. */
  async setPin(userId: string, pin: string | null) {
    await this.getSettings(userId);
    const privacyPinHash = pin ? await this.passwords.hash(pin) : null;
    await this.prisma.userSettings.update({ where: { userId }, data: { privacyPinHash } });
    return { hasPin: !!privacyPinHash };
  }

  async verifyPin(userId: string, pin: string) {
    const s = await this.getSettings(userId);
    if (!s.privacyPinHash) return { valid: true };
    return { valid: await this.passwords.verify(pin, s.privacyPinHash, 'scrypt') };
  }

  /** Portabilidade de dados (LGPD): tudo que o usuário tem, num JSON. */
  async exportAll(userId: string) {
    const [me, incomes, expenses, cards, investments, crypto] = await Promise.all([
      this.me(userId),
      this.prisma.income.findMany({ where: { userId }, orderBy: [{ ym: 'asc' }, { isPrimary: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }] }),
      this.prisma.expense.findMany({ where: { userId }, orderBy: [{ ym: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.creditCard.findMany({ where: { userId }, include: { purchases: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.investmentPlan.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.cryptoHolding.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    ]);
    return {
      exportedAt: new Date().toISOString(), profile: me,
      incomes: incomes.map(incomeDto), expenses: expenses.map(expenseDto),
      creditCards: cards.map((c) => ({ id: c.id, name: c.name, color: c.color, limitCents: c.limitCents, purchases: c.purchases.map((p) => ({ id: p.id, name: p.name, amountCents: p.amountCents, installmentCurrent: p.installmentCurrent, installmentTotal: p.installmentTotal })) })),
      investments: investments.map(investmentDto),
      cryptoHoldings: crypto.map((h) => ({ id: h.id, coinId: h.coinId, quantity: h.quantity.toFixed(), buyPriceCents: h.buyPriceCents })),
    };
  }
}
