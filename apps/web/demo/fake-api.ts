/**
 * "API de mentira" da PRÉVIA: guarda tudo na memória da página (recarregar = volta ao início).
 * Os CÁLCULOS usam as mesmas funções financeiras da API real (domain/finance), então os números são fiéis.
 */
import { MAX_CREDIT_CARDS, MAX_INCOMES_PER_MONTH, PALETTE, prevYm } from '@fin/shared';
import { todayIn } from '@fin/shared';
import { cardUsage, computeDues, cryptoPosition, cryptoTotals, monthSummary, monthsToTarget, yearlyStats } from '../../api/src/domain/finance';
import { currentYm, shiftYm } from '../src/lib/months';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 90));
const limit = (code: string, message: string) => Object.assign(new Error(message), { name: 'ApiError', status: 409, code, details: [] });

type Inc = { id: string; ym: string; name: string; amountCents: number; recurring: boolean; isPrimary: boolean };
type Exp = { id: string; ym: string; name: string; icon: string; color: string; amountCents: number; recurring: boolean; dueDay: number | null; installmentCurrent: number | null; installmentTotal: number | null };
const months = new Map<string, { incomes: Inc[]; expenses: Exp[] }>(); const opened = new Set<string>();
const slot = (ym: string) => { if (!months.has(ym)) months.set(ym, { incomes: [], expenses: [] }); return months.get(ym)!; };

const now = currentYm();
const ex = (ym: string, name: string, icon: string, c: number, amountCents: number, recurring: boolean, dueDay: number | null = null, ic: number | null = null, it: number | null = null): Exp =>
  ({ id: uid(), ym, name, icon, color: PALETTE[c % PALETTE.length], amountCents, recurring, dueDay, installmentCurrent: ic, installmentTotal: it });
const mercado = [78000, 91050, 83020, 99010, 87040, 94080]; const lazer = [20000, 45000, 15000, 60000, 30000, 38000]; const freela = [0, 80000, 0, 120000, 0, 150000];
for (let i = 5; i >= 0; i--) {
  const ym = shiftYm(now, -i); const k = 5 - i; const m = slot(ym); opened.add(ym);
  m.incomes.push({ id: uid(), ym, name: 'Salário', amountCents: 500000, recurring: true, isPrimary: true });
  if (freela[k]) m.incomes.push({ id: uid(), ym, name: 'Freela', amountCents: freela[k], recurring: false, isPrimary: false });
  m.expenses.push(ex(ym, 'Aluguel', '🏠', 0, 150000, true, 5), ex(ym, 'Internet', '🌐', 3, 9990, true, 10), ex(ym, 'Energia', '💡', 1, 18050, true, 15),
    ex(ym, 'Mercado', '🛒', 2, mercado[k], false), ex(ym, 'Lazer', '🎬', 4, lazer[k], false));
  if (i === 0) m.expenses.push(ex(ym, 'Curso online', '🎓', 5, 14990, false, 20, 3, 12));
}

// A prévia mostra o tutorial como para uma pessoa nova. Dentro do mostruário (#/…?notutorial) ele começa como já visto.
let settings: any = { displayName: 'Ana', locale: 'pt', theme: 'light', timezone: 'America/Sao_Paulo', monthlyGoalCents: 300000, privacyMode: false, hasPin: false, tutorialVersion: /notutorial/.test(location.hash) ? 1 : 0 };
let pin: string | null = null;

const cards: any[] = [
  { id: uid(), name: 'Nubank', color: '#7A4B8C', limitCents: 500000, purchases: [
    { id: uid(), name: 'Notebook', amountCents: 189900, installmentCurrent: 3, installmentTotal: 10 }, { id: uid(), name: 'Supermercado', amountCents: 42050, installmentCurrent: null, installmentTotal: null } ] },
  { id: uid(), name: 'Inter', color: '#C97064', limitCents: 200000, purchases: [
    { id: uid(), name: 'Passagem aérea', amountCents: 120000, installmentCurrent: 1, installmentTotal: 4 }, { id: uid(), name: 'Restaurante', amountCents: 45000, installmentCurrent: null, installmentTotal: null } ] },
];
const investments: any[] = [
  { id: uid(), name: 'Reserva de emergência', type: 'cdb', targetLimitCents: 3000000, monthlyAmountCents: 100000 },
  { id: uid(), name: 'Viagem', type: 'tesouro_selic', targetLimitCents: 800000, monthlyAmountCents: 50000 },
];
const holdings: any[] = [
  { id: uid(), coinId: 'bitcoin', quantity: '0.015', buyPriceCents: 30000000 },
  { id: uid(), coinId: 'ethereum', quantity: '0.5', buyPriceCents: 1500000 },
  { id: uid(), coinId: 'solana', quantity: '3', buyPriceCents: 80000 },
];
const price: Record<string, number> = { bitcoin: 345000, ethereum: 18500, solana: 950, binancecoin: 3300, ripple: 3.1, cardano: 2.4, dogecoin: 0.9, polkadot: 38 };
const chg: Record<string, number> = { bitcoin: 1.42, ethereum: -0.87, solana: 3.1, binancecoin: 0.4, ripple: -1.2, cardano: 0.1, dogecoin: 2.2, polkadot: -0.6 };

function openMonth(ym: string) {
  if (!opened.has(ym)) {
    opened.add(ym); const m = slot(ym); const p = months.get(prevYm(ym));
    if (p && !m.incomes.length) { m.incomes = p.incomes.filter((i) => i.recurring).map((i) => ({ ...i, id: uid(), ym })); if (m.incomes.length && !m.incomes.some((i) => i.isPrimary)) m.incomes[0].isPrimary = true; }
    if (p && !m.expenses.length) m.expenses = p.expenses.filter((e) => e.recurring).map((e) => ({ ...e, id: uid(), ym }));
  }
  const m = slot(ym); return { ym, incomes: ordered(m.incomes), expenses: m.expenses };
}
const findExp = (id: string) => { for (const m of months.values()) { const e = m.expenses.find((x) => x.id === id); if (e) return e; } throw new Error('Despesa não encontrada'); };
const ordered = (l: Inc[]) => [...l].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
const findInc = (id: string) => { for (const m of months.values()) { const e = m.incomes.find((x) => x.id === id); if (e) return e; } throw new Error('Renda não encontrada'); };
const cardView = (c: any) => ({ ...c, ...cardUsage(c.limitCents, c.purchases.map((p: any) => p.amountCents)) });

export const fakeApi: any = {
  auth: { register: () => wait({ requiresEmailVerification: false }), forgotPassword: () => wait(undefined) },
  me: {
    get: () => wait({ id: 'demo', email: 'ana@exemplo.com', settings: { ...settings } }),
    updateSettings: (b: any) => { settings = { ...settings, ...b }; return wait({ ...settings }); },
    setPin: (p: string | null) => { pin = p; settings = { ...settings, hasPin: !!p }; return wait({ hasPin: !!p }); },
    verifyPin: (p: string) => wait({ valid: !pin || p === pin }),
    export: () => wait({ aviso: 'Backup da PRÉVIA (dados fictícios)', rendas: [...months.values()].flatMap((m) => m.incomes), despesas: [...months.values()].flatMap((m) => m.expenses), cartoes: cards }),
  },
  months: {
    open: (ym: string) => wait(openMonth(ym)),
    copy: (ym: string, target: string, overwrite = false) => {
      const src = slot(ym); const dst = slot(target);
      if ((dst.incomes.length || dst.expenses.length) && !overwrite) return Promise.reject(Object.assign(new Error('x'), { name: 'ApiError', status: 409, code: 'MONTH_NOT_EMPTY', details: [] }));
      dst.incomes = src.incomes.map((i) => ({ ...i, id: uid(), ym: target })); dst.expenses = src.expenses.map((e) => ({ ...e, id: uid(), ym: target })); opened.add(target);
      return wait({ copiedIncomes: dst.incomes.length, copiedExpenses: dst.expenses.length });
    },
  },
  incomes: {
    create: (b: any) => { const m = slot(b.ym); if (m.incomes.length >= MAX_INCOMES_PER_MONTH) return Promise.reject(limit('LIMIT_REACHED', 'limite'));
      const makePrimary = b.isPrimary === true || !m.incomes.some((i) => i.isPrimary); if (makePrimary) m.incomes.forEach((i) => { i.isPrimary = false; });
      m.incomes.push({ id: uid(), ym: b.ym, name: b.name ?? 'Renda', amountCents: b.amountCents ?? 0, recurring: !!b.recurring, isPrimary: makePrimary }); return wait({}); },
    update: (id: string, b: any) => { const inc = findInc(id); const { isPrimary, ...rest } = b;
      if (isPrimary === false && inc.isPrimary) return Promise.reject(Object.assign(new Error('x'), { name: 'ApiError', status: 409, code: 'PRIMARY_REQUIRED', details: [] }));
      if (isPrimary === true) slot(inc.ym).incomes.forEach((i) => { i.isPrimary = false; }); Object.assign(inc, rest, isPrimary === true ? { isPrimary: true } : {}); return wait({}); },
    remove: (id: string) => { const inc = findInc(id); const m = slot(inc.ym); m.incomes = m.incomes.filter((i) => i.id !== id); if (inc.isPrimary && m.incomes.length) m.incomes[0].isPrimary = true; return wait(undefined); },
  },
  expenses: {
    list: (q: any = {}) => { const all = [...months.values()].flatMap((m) => m.expenses).filter((e) => (!q.q || e.name.toLowerCase().includes(String(q.q).toLowerCase())) && (!q.ym || e.ym === q.ym)).sort((a, b) => b.ym.localeCompare(a.ym)); return wait({ data: all.slice(0, q.limit ?? 50), meta: { page: 1, limit: q.limit ?? 50, total: all.length, totalPages: 1 } }); },
    create: (b: any) => { slot(b.ym).expenses.push({ id: uid(), ym: b.ym, name: b.name, icon: b.icon ?? 'receipt', color: b.color ?? PALETTE[slot(b.ym).expenses.length % PALETTE.length], amountCents: b.amountCents ?? 0, recurring: !!b.recurring, dueDay: b.dueDay ?? null, installmentCurrent: b.installmentCurrent ?? null, installmentTotal: b.installmentTotal ?? null }); return wait({}); },
    update: (id: string, b: any) => { Object.assign(findExp(id), b); return wait({}); },
    remove: (id: string) => { for (const m of months.values()) m.expenses = m.expenses.filter((e) => e.id !== id); return wait(undefined); },
  },
  reports: {
    summary: (ym: string, reserveMonths = 6) => { const m = slot(ym); return wait({ ym, ...monthSummary({ incomeCents: m.incomes.map((i) => i.amountCents), goalCents: settings.monthlyGoalCents, reserveMonths,
      expenses: m.expenses.map((e) => ({ id: e.id, name: e.name, color: e.color, amountCents: e.amountCents, recurring: e.recurring })) }) }); },
    yearly: (year: number) => { const list = Array.from({ length: 12 }, (_, k) => { const ym = `${year}-${String(k + 1).padStart(2, '0')}`; const m = months.get(ym);
      return { ym, expensesCents: m ? m.expenses.reduce((s, e) => s + e.amountCents, 0) : 0, incomeCents: m ? m.incomes.reduce((s, e) => s + e.amountCents, 0) : 0 }; });
      return wait({ year, months: list, ...yearlyStats(list) }); },
    dues: (ym: string) => wait(computeDues(slot(ym).expenses.filter((e) => e.dueDay).map((e) => ({ id: e.id, name: e.name, amountCents: e.amountCents, dueDay: e.dueDay!, createdAt: new Date(0) })), ym, todayIn(settings.timezone), 3)),
    agenda: (n = 3) => { const out: any[] = []; for (let k = 0; k < n; k++) { const ym = shiftYm(now, k); openMonth(ym);
      slot(ym).expenses.filter((e) => e.dueDay).sort((a, b) => a.dueDay! - b.dueDay!).forEach((e) => out.push({ ym, dueDay: e.dueDay, expenseId: e.id, name: e.name, amountCents: e.amountCents })); } return wait(out); },
  },
  cards: {
    list: () => wait(cards.map(cardView)),
    create: (b: any) => { if (cards.length >= MAX_CREDIT_CARDS) return Promise.reject(limit('LIMIT_REACHED', 'limite')); const c = { id: uid(), name: b.name ?? 'Novo cartão', color: PALETTE[cards.length % PALETTE.length], limitCents: b.limitCents ?? 0, purchases: [] }; cards.push(c); return wait(cardView(c)); },
    update: (id: string, b: any) => { Object.assign(cards.find((c) => c.id === id)!, b); return wait({}); },
    remove: (id: string) => { cards.splice(cards.findIndex((c) => c.id === id), 1); return wait(undefined); },
    addPurchase: (id: string, b: any) => { cards.find((c) => c.id === id)!.purchases.push({ id: uid(), name: b.name, amountCents: b.amountCents, installmentCurrent: b.installmentCurrent ?? null, installmentTotal: b.installmentTotal ?? null }); return wait({}); },
    removePurchase: (id: string, pid: string) => { const c = cards.find((x) => x.id === id)!; c.purchases = c.purchases.filter((p: any) => p.id !== pid); return wait(undefined); },
  },
  investments: {
    list: () => wait(investments.map((i) => ({ ...i, monthsToTarget: monthsToTarget(i.targetLimitCents, i.monthlyAmountCents) }))),
    create: () => { investments.push({ id: uid(), name: 'Meu investimento', type: 'tesouro_selic', targetLimitCents: 0, monthlyAmountCents: 0 }); return wait({}); },
    update: (id: string, b: any) => { Object.assign(investments.find((i) => i.id === id)!, b); return wait({}); },
    remove: (id: string) => { investments.splice(investments.findIndex((i) => i.id === id), 1); return wait(undefined); },
  },
  crypto: {
    valuation: () => {
      for (const k of Object.keys(price)) { price[k] *= 1 + (Math.random() - 0.5) * 0.006; chg[k] += (Math.random() - 0.5) * 0.1; }   // cotações SIMULADAS que "mexem" a cada consulta
      const items = holdings.map((h) => { const p = h.coinId ? price[h.coinId] : undefined; return { id: h.id, coinId: h.coinId, quantity: h.quantity, buyPriceCents: h.buyPriceCents, priceAvailable: p !== undefined,
        currentPriceCents: p !== undefined ? Math.round(p * 100) : null, change24hPercent: p !== undefined ? Math.round(chg[h.coinId] * 100) / 100 : null, ...cryptoPosition(h.quantity, h.buyPriceCents, p ?? null) }; });
      return wait({ items, totals: cryptoTotals(items), asOf: new Date().toISOString() });
    },
    create: () => { holdings.push({ id: uid(), coinId: null, quantity: '0', buyPriceCents: 0 }); return wait({}); },
    update: (id: string, b: any) => { Object.assign(holdings.find((h) => h.id === id)!, b); return wait({}); },
    remove: (id: string) => { holdings.splice(holdings.findIndex((h) => h.id === id), 1); return wait(undefined); },
  },
};
