import { reaisToCents, sumCents, percentRounded, prevYm, daysInMonth, todayIn, isYm } from '@fin/shared';
import { cardUsage, computeDues, cryptoPosition, cryptoTotals, monthsToTarget, monthSummary, yearlyStats } from '../src/domain/finance';

describe('dinheiro (centavos)', () => {
  it('evita o erro clássico de ponto flutuante', () => {
    expect(0.1 + 0.2).not.toBe(0.3);                                  // prova do problema
    expect(sumCents([reaisToCents(0.1), reaisToCents(0.2)])).toBe(30); // nossa solução
  });
  it('converte reais legados (float) para centavos com arredondamento correto', () => {
    expect(reaisToCents(1.005)).toBe(101);   // 1.005*100 = 100.49999999999999 em float puro
    expect(reaisToCents('12,34')).toBe(1234);
    expect(reaisToCents(80.06)).toBe(8006);
    expect(reaisToCents(null)).toBe(0);
    expect(reaisToCents(NaN)).toBe(0);
  });
  it('percentual arredondado, 0 quando base é 0', () => {
    expect(percentRounded(50, 200)).toBe(25);
    expect(percentRounded(10, 0)).toBe(0);
  });
});

describe('meses', () => {
  it('valida AAAA-MM', () => { expect(isYm('2026-09')).toBe(true); expect(isYm('2026-13')).toBe(false); expect(isYm('26-09')).toBe(false); });
  it('mês anterior atravessa o ano', () => { expect(prevYm('2026-01')).toBe('2025-12'); expect(prevYm('2026-03')).toBe('2026-02'); });
  it('dias do mês (bissexto)', () => { expect(daysInMonth('2024-02')).toBe(29); expect(daysInMonth('2026-02')).toBe(28); });
  it('"hoje" respeita o fuso (virada de mês por UTC não vira o mês errado)', () => {
    // 01/10/2026 02:30 UTC ainda é 30/09 em São Paulo (UTC-3)
    expect(todayIn('America/Sao_Paulo', new Date('2026-10-01T02:30:00Z'))).toEqual({ ym: '2026-09', day: 30 });
    expect(todayIn('UTC', new Date('2026-10-01T02:30:00Z'))).toEqual({ ym: '2026-10', day: 1 });
  });
});

describe('cartão de crédito', () => {
  it('uso, disponível e percentual', () => {
    expect(cardUsage(100_000, [20_000, 30_000])).toEqual({ usedCents: 50_000, availableCents: 50_000, usagePercent: 50, warn: false });
  });
  it('alerta exatamente a partir de 80% (limite inclusivo)', () => {
    expect(cardUsage(100_000, [79_999]).warn).toBe(false);
    expect(cardUsage(100_000, [80_000]).warn).toBe(true);
  });
  it('acima do limite: disponível negativo, percentual travado em 100', () => {
    const r = cardUsage(100_000, [130_000]);
    expect(r.availableCents).toBe(-30_000); expect(r.usagePercent).toBe(100); expect(r.warn).toBe(true);
  });
  it('sem limite: sem alerta e sem divisão por zero', () => {
    expect(cardUsage(0, [5_000])).toMatchObject({ usagePercent: 0, warn: false });
  });
});

describe('investimento', () => {
  it('meses para atingir a meta (arredonda para cima)', () => {
    expect(monthsToTarget(100_000, 30_000)).toBe(4);
    expect(monthsToTarget(100_000, 0)).toBe(0);
  });
});

describe('cripto', () => {
  it('calcula investido, valor atual e rendimento sem float', () => {
    // 0,5 BTC comprado a R$ 200.000,00; hoje R$ 250.000,00
    const p = cryptoPosition('0.5', 20_000_000, 250_000);
    expect(p).toEqual({ investedCents: 10_000_000, currentValueCents: 12_500_000, gainCents: 2_500_000, gainPercent: 25 });
  });
  it('REGRESSÃO do bug real: posição recém-criada (quantidade e preço 0) não quebra', () => {
    const p = cryptoPosition('0', 0, 300_000);
    expect(p).toEqual({ investedCents: 0, currentValueCents: 0, gainCents: 0, gainPercent: null });
  });
  it('quantidades fracionárias pequenas mantêm precisão', () => {
    const p = cryptoPosition('0.00000123', 0, 100_000);
    expect(p.currentValueCents).toBe(12); // 0,00000123 * 100000 BRL = R$ 0,123 -> 12 centavos
  });
  it('sem cotação: valores atuais nulos', () => {
    expect(cryptoPosition('1', 100, null)).toEqual({ investedCents: 100, currentValueCents: null, gainCents: null, gainPercent: null });
  });
  it('totais só consideram posições com cotação (como no site atual)', () => {
    const t = cryptoTotals([cryptoPosition('1', 100_00, 200), cryptoPosition('1', 50_00, null)]);
    expect(t).toMatchObject({ pricedCount: 1, investedCents: 100_00, currentValueCents: 200_00, gainCents: 100_00, gainPercent: 100 });
  });
});

describe('resumo mensal', () => {
  const exp = (id: string, amountCents: number, recurring = false) => ({ id, name: id, color: '#000000', amountCents, recurring });
  it('saldo, comprometido, fixas x variáveis', () => {
    const s = monthSummary({ incomeCents: [500_000, 100_000], expenses: [exp('a', 200_000, true), exp('b', 100_000)], goalCents: 0, reserveMonths: 6 });
    expect(s).toMatchObject({ incomeCents: 600_000, expensesCents: 300_000, balanceCents: 300_000, committedPercent: 50, fixedCents: 200_000, variableCents: 100_000, goal: null });
  });
  it('saldo negativo quando gasta mais do que ganha', () => {
    expect(monthSummary({ incomeCents: [100_000], expenses: [exp('a', 150_000)], goalCents: 0, reserveMonths: 6 }).balanceCents).toBe(-50_000);
  });
  it('meta: ultrapassada x faltam', () => {
    const over = monthSummary({ incomeCents: [0], expenses: [exp('a', 120_000)], goalCents: 100_000, reserveMonths: 6 }).goal!;
    expect(over).toMatchObject({ exceeded: true, differenceCents: 20_000, usedPercent: 100 });
    const under = monthSummary({ incomeCents: [0], expenses: [exp('a', 60_000)], goalCents: 100_000, reserveMonths: 6 }).goal!;
    expect(under).toMatchObject({ exceeded: false, differenceCents: 40_000, usedPercent: 60 });
  });
  it('reserva: base = despesas; sem despesas usa 70% da renda', () => {
    const a = monthSummary({ incomeCents: [1_000_000], expenses: [exp('a', 200_000)], goalCents: 0, reserveMonths: 6 }).reserve;
    expect(a).toEqual({ months: 6, baseCents: 200_000, baseSource: 'expenses', targetCents: 1_200_000 });
    const b = monthSummary({ incomeCents: [1_000_000], expenses: [], goalCents: 0, reserveMonths: 3 }).reserve;
    expect(b).toEqual({ months: 3, baseCents: 700_000, baseSource: 'income_fallback', targetCents: 2_100_000 });
  });
  it('sem renda: comprometido = 0 (sem dividir por zero)', () => {
    expect(monthSummary({ incomeCents: [], expenses: [exp('a', 5_000)], goalCents: 0, reserveMonths: 6 }).committedPercent).toBe(0);
  });
  it('distribuição ordenada do maior para o menor, com percentual', () => {
    const d = monthSummary({ incomeCents: [0], expenses: [exp('a', 100), exp('b', 300), exp('c', 0)], goalCents: 0, reserveMonths: 6 }).distribution;
    expect(d.map((x) => x.expenseId)).toEqual(['b', 'a']);
    expect(d[0].percentOfTotal).toBe(75);
  });
});

describe('anual', () => {
  it('total, média e maior mês (empate = primeiro)', () => {
    const months = Array.from({ length: 12 }, (_, i) => ({ ym: `2026-${String(i + 1).padStart(2, '0')}`, expensesCents: i === 2 || i === 5 ? 1200 : 0, incomeCents: 0 }));
    const y = yearlyStats(months);
    expect(y.totalYearCents).toBe(2400); expect(y.averageMonthlyCents).toBe(200); expect(y.biggestMonth.ym).toBe('2026-03');
  });
});

describe('vencimentos', () => {
  const mk = (id: string, dueDay: number, t = 0) => ({ id, name: id, amountCents: 100, dueDay, createdAt: new Date(t) });
  it('mês atual: ignora vencidas, ordena por dia, máx 3, calcula hoje/amanhã', () => {
    const r = computeDues([mk('a', 5), mk('b', 12), mk('c', 10), mk('d', 11), mk('e', 20)], '2026-10', { ym: '2026-10', day: 10 }, 3);
    expect(r.map((x) => x.expenseId)).toEqual(['c', 'd', 'b']);
    expect(r[0]).toMatchObject({ daysUntil: 0, urgent: true });
    expect(r[1]).toMatchObject({ daysUntil: 1, urgent: true });
    expect(r[2]).toMatchObject({ daysUntil: 2, urgent: false });
  });
  it('outro mês: não filtra por dia e não tem "dias até"', () => {
    const r = computeDues([mk('a', 5), mk('b', 1)], '2026-11', { ym: '2026-10', day: 28 }, 3);
    expect(r.map((x) => x.expenseId)).toEqual(['b', 'a']);
    expect(r[0]).toMatchObject({ daysUntil: null, urgent: false });
  });
});
