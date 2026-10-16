import Decimal from 'decimal.js';
import { CARD_WARN_RATIO, RESERVE_FALLBACK_RATIO, percentRounded, sumCents } from '@fin/shared';

/**
 * Regras financeiras PURAS (sem banco/HTTP). Portadas fielmente do site atual (ver docs/regras-de-negocio.md).
 * Tudo em centavos inteiros; arredondamento sempre "meio para cima" (ROUND_HALF_UP).
 */

const roundHalfUp = (d: Decimal) => d.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();

// ---------- Cartão de crédito ----------
export function cardUsage(limitCents: number, purchaseCents: number[]) {
  const usedCents = sumCents(purchaseCents);
  const availableCents = limitCents - usedCents; // pode ficar negativo (acima do limite), como no site atual
  const usagePercent = limitCents > 0 ? Math.min(100, Math.round((usedCents * 10000) / limitCents) / 100) : 0;
  // alerta a partir de 80% do limite — comparação em inteiros, sem erro de float
  const warn = limitCents > 0 && usedCents * 100 >= limitCents * Math.round(CARD_WARN_RATIO * 100);
  return { usedCents, availableCents, usagePercent, warn };
}

// ---------- Investimento (plano) ----------
export function monthsToTarget(targetCents: number, monthlyCents: number): number {
  return monthlyCents > 0 ? Math.ceil(targetCents / monthlyCents) : 0;
}

// ---------- Cripto ----------
export interface CryptoPosition {
  investedCents: number;
  currentValueCents: number | null;
  gainCents: number | null;
  gainPercent: number | null;
}
export function cryptoPosition(quantity: Decimal.Value, buyPriceCents: number, currentPriceBrl: number | null): CryptoPosition {
  const qty = new Decimal(quantity);
  const investedCents = roundHalfUp(qty.mul(buyPriceCents));
  if (currentPriceBrl == null) return { investedCents, currentValueCents: null, gainCents: null, gainPercent: null };
  const currentValueCents = roundHalfUp(qty.mul(new Decimal(currentPriceBrl).mul(100)));
  const gainCents = currentValueCents - investedCents;
  // % só existe se houve investimento (evita divisão por zero — bug real encontrado no site atual)
  const gainPercent = investedCents > 0 ? new Decimal(gainCents).div(investedCents).mul(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() : null;
  return { investedCents, currentValueCents, gainCents, gainPercent };
}

export function cryptoTotals(positions: CryptoPosition[]) {
  // Igual ao site atual: o total só considera posições que têm cotação.
  const priced = positions.filter((p) => p.currentValueCents != null);
  const investedCents = sumCents(priced.map((p) => p.investedCents));
  const currentValueCents = sumCents(priced.map((p) => p.currentValueCents!));
  const gainCents = currentValueCents - investedCents;
  const gainPercent = investedCents > 0 ? new Decimal(gainCents).div(investedCents).mul(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() : null;
  return { pricedCount: priced.length, investedCents, currentValueCents, gainCents, gainPercent };
}

// ---------- Resumo mensal ----------
export interface SummaryExpense { id: string; name: string; color: string; amountCents: number; recurring: boolean }

export function monthSummary(input: { incomeCents: number[]; expenses: SummaryExpense[]; goalCents: number; reserveMonths: number }) {
  const incomeCents = sumCents(input.incomeCents);
  const expensesCents = sumCents(input.expenses.map((e) => e.amountCents));
  const balanceCents = incomeCents - expensesCents;
  const fixedCents = sumCents(input.expenses.filter((e) => e.recurring).map((e) => e.amountCents));
  const variableCents = expensesCents - fixedCents;

  const goal = input.goalCents > 0
    ? {
        goalCents: input.goalCents,
        usedPercent: Math.min(100, Math.round((expensesCents * 10000) / input.goalCents) / 100),
        exceeded: expensesCents > input.goalCents,
        differenceCents: Math.abs(input.goalCents - expensesCents), // "ultrapassada em" ou "faltam"
      }
    : null;

  const baseFromExpenses = expensesCents > 0;
  const reserveBaseCents = baseFromExpenses ? expensesCents : roundHalfUp(new Decimal(incomeCents).mul(RESERVE_FALLBACK_RATIO));
  const reserve = {
    months: input.reserveMonths,
    baseCents: reserveBaseCents,
    baseSource: baseFromExpenses ? ('expenses' as const) : ('income_fallback' as const),
    targetCents: reserveBaseCents * input.reserveMonths,
  };

  const distribution = [...input.expenses]
    .filter((e) => e.amountCents > 0)
    .sort((a, b) => b.amountCents - a.amountCents)
    .map((e) => ({ expenseId: e.id, name: e.name, color: e.color, amountCents: e.amountCents, percentOfTotal: percentRounded(e.amountCents, expensesCents) }));

  return {
    incomeCents, expensesCents, balanceCents,
    committedPercent: percentRounded(expensesCents, incomeCents),
    fixedCents, variableCents, goal, reserve, distribution,
  };
}

// ---------- Anual ----------
export function yearlyStats(months: { ym: string; expensesCents: number; incomeCents: number }[]) {
  const totalYearCents = sumCents(months.map((m) => m.expensesCents));
  // empate -> primeiro mês (igual ao reduce do site atual)
  const biggest = months.reduce((a, b) => (b.expensesCents > a.expensesCents ? b : a), months[0]);
  return { totalYearCents, averageMonthlyCents: roundHalfUp(new Decimal(totalYearCents).div(12)), biggestMonth: { ym: biggest.ym, expensesCents: biggest.expensesCents } };
}

// ---------- Vencimentos ----------
export interface DueInput { id: string; name: string; amountCents: number; dueDay: number; createdAt: Date }
export function computeDues(expenses: DueInput[], ym: string, today: { ym: string; day: number }, limit: number | null) {
  const isCurrent = ym === today.ym;
  let list = expenses.filter((e) => e.dueDay > 0);
  if (isCurrent) list = list.filter((e) => e.dueDay >= today.day); // contas já vencidas saem da lista
  list.sort((a, b) => a.dueDay - b.dueDay || a.createdAt.getTime() - b.createdAt.getTime());
  if (limit != null) list = list.slice(0, limit);
  return list.map((e) => {
    const daysUntil = isCurrent ? e.dueDay - today.day : null;
    return {
      expenseId: e.id, name: e.name, amountCents: e.amountCents, dueDay: e.dueDay,
      daysUntil, // 0 = hoje, 1 = amanhã (o app traduz o texto conforme o idioma)
      urgent: daysUntil !== null && daysUntil <= 1,
    };
  });
}
