import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { ApiContext } from '@/lib/api-context';
import { AppShell } from '@/components/AppShell';
import { PrivacyProvider, Me } from '@/lib/me';

export const replace = jest.fn(); export const push = jest.fn();
export const settings = (o: any = {}) => ({ displayName: 'Ana', locale: 'pt', theme: 'light', timezone: 'America/Sao_Paulo', monthlyGoalCents: 0, privacyMode: false, hasPin: false, ...o });
export const meOf = (o: any = {}): Me => ({ id: 'u1', email: 'ana@teste.com', settings: settings(o) } as Me);
export const inc = (id: string, name: string, amountCents: number, recurring = false, isPrimary = false) => ({ id, name, amountCents, recurring, isPrimary });
export const exp = (id: string, name: string, amountCents: number, recurring = false, dueDay: number | null = null, extra: any = {}) => ({ id, ym: '2026-10', name, icon: '🧾', color: '#3B6B8C', amountCents, recurring, dueDay, installmentCurrent: null, installmentTotal: null, ...extra });

export function fakeApi(over: any = {}) {
  const st = { incomes: [inc('i1', 'Salário', 500000, true, true)], expenses: [exp('e1', 'Aluguel', 150000, true, 5), exp('e2', 'Mercado', 80000)], ...over.state };
  const api: any = {
    me: { get: jest.fn(async () => meOf(over.settings)), updateSettings: jest.fn(async () => ({})), setPin: jest.fn(async () => ({})), verifyPin: jest.fn(async (p: string) => ({ valid: p === '4821' })), export: jest.fn(async () => ({ ok: 1 })) },
    months: { open: jest.fn(async (ym: string) => ({ ym, incomes: st.incomes, expenses: st.expenses })), copy: jest.fn(async () => ({})) },
    reports: {
      summary: jest.fn(async (ym: string, m = 6) => ({ ym, incomeCents: 500000, expensesCents: 230000, balanceCents: 270000, committedPercent: 46, goal: null, reserve: { months: m, baseCents: 200000, baseSource: 'expenses', targetCents: 200000 * m },
        distribution: [{ expenseId: 'e1', name: 'Aluguel', color: '#3B6B8C', amountCents: 150000, percentOfTotal: 65 }, { expenseId: 'e2', name: 'Mercado', color: '#B85C38', amountCents: 80000, percentOfTotal: 35 }], ...over.summary })),
      dues: jest.fn(async () => over.dues ?? [{ expenseId: 'e1', name: 'Aluguel', amountCents: 150000, dueDay: 5, daysUntil: 1, urgent: true }]),
      yearly: jest.fn(async (y: number) => ({ year: y, months: [], totalYearCents: 0, averageMonthlyCents: 0, biggestMonth: { ym: `${y}-01`, expensesCents: 0 }, ...over.yearly })),
      agenda: jest.fn(async () => over.agenda ?? []),
    },
    incomes: { create: jest.fn(async () => ({})), update: jest.fn(async () => ({})), remove: jest.fn(async () => undefined) },
    expenses: { create: jest.fn(async () => ({})), update: jest.fn(async () => ({})), remove: jest.fn(async () => undefined), list: jest.fn(async () => ({ data: over.found ?? [], meta: {} })) },
    cards: { list: jest.fn(async () => over.cards ?? []), create: jest.fn(async () => ({ id: 'cN' })), update: jest.fn(async () => ({})), remove: jest.fn(async () => undefined), addPurchase: jest.fn(async () => ({})), removePurchase: jest.fn(async () => undefined) },
    investments: { list: jest.fn(async () => over.plans ?? []), create: jest.fn(async () => ({ id: 'pN', name: 'Meu investimento', type: 'cdb', targetLimitCents: 0, monthlyAmountCents: 0, monthsToTarget: 0 })), update: jest.fn(async () => ({})), remove: jest.fn(async () => undefined) },
    crypto: { valuation: jest.fn(async () => over.crypto ?? { items: [], totals: { pricedCount: 0, investedCents: 0, currentValueCents: 0, gainCents: 0, gainPercent: null }, asOf: '2026-10-05T15:30:00.000Z' }), create: jest.fn(async () => ({})), update: jest.fn(async () => ({})), remove: jest.fn(async () => undefined) },
    auth: { register: jest.fn(async () => ({ requiresEmailVerification: true })), forgotPassword: jest.fn(async () => undefined) },
  };
  return api;
}
/** Renderiza dentro da casca real do app (barra lateral, menu inferior, janelas globais). */
export function renderApp(ui: React.ReactElement, api = fakeApi(), over: any = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const out = render(<QueryClientProvider client={qc}><ApiContext.Provider value={api}><PrivacyProvider me={meOf(over.settings)}><AppShell onLogout={over.onLogout ?? (async () => undefined)}>{ui}</AppShell></PrivacyProvider></ApiContext.Provider></QueryClientProvider>);
  return { api, ...out };
}
/** Sem a casca (para telas simples e de acesso). */
export function renderPlain(ui: React.ReactElement, api = fakeApi()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { api, ...render(<QueryClientProvider client={qc}><ApiContext.Provider value={api}>{ui}</ApiContext.Provider></QueryClientProvider>) };
}
