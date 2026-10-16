import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { notFound } from '../common/app-error';
import { investmentDto } from '../common/mappers';
import { monthsToTarget } from '../domain/finance';

@Injectable()
export class InvestmentsService {
  constructor(private readonly prisma: PrismaService) {}
  private view(i: any) { return { ...investmentDto(i), monthsToTarget: monthsToTarget(i.targetLimitCents, i.monthlyAmountCents) }; }

  async list(userId: string) { return (await this.prisma.investmentPlan.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })).map((i) => this.view(i)); }
  async create(userId: string, b: any) { return this.view(await this.prisma.investmentPlan.create({ data: { userId, ...b } })); }
  async update(userId: string, id: string, data: Record<string, unknown>) {
    if (!(await this.prisma.investmentPlan.findFirst({ where: { id, userId } }))) throw notFound('Investimento');
    return this.view(await this.prisma.investmentPlan.update({ where: { id }, data }));
  }
  async remove(userId: string, id: string) {
    const r = await this.prisma.investmentPlan.deleteMany({ where: { id, userId } });
    if (r.count === 0) throw notFound('Investimento');
  }
}
