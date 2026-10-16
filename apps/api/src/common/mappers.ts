export const incomeDto = (i: any) => ({ id: i.id, ym: i.ym, name: i.name, amountCents: i.amountCents, recurring: i.recurring, isPrimary: i.isPrimary, createdAt: i.createdAt });
/** Principal primeiro; depois a mais antiga (id desempata, para a ordem ser sempre a mesma). */
export const INCOME_ORDER = [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }, { id: 'asc' as const }];
export const expenseDto = (e: any) => ({
  id: e.id, ym: e.ym, name: e.name, icon: e.icon, color: e.color, amountCents: e.amountCents, recurring: e.recurring,
  dueDay: e.dueDay, installmentCurrent: e.installmentCurrent, installmentTotal: e.installmentTotal, createdAt: e.createdAt,
});
export const purchaseDto = (p: any) => ({
  id: p.id, cardId: p.cardId, name: p.name, amountCents: p.amountCents,
  installmentCurrent: p.installmentCurrent, installmentTotal: p.installmentTotal, createdAt: p.createdAt,
});
export const investmentDto = (i: any) => ({
  id: i.id, name: i.name, type: i.type, targetLimitCents: i.targetLimitCents, monthlyAmountCents: i.monthlyAmountCents, createdAt: i.createdAt,
});
