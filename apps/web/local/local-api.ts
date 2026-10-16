/**
 * "Servidor dentro do aparelho" do app Android. Mesma interface do cliente da API, mas os dados ficam no celular.
 * Para não divergir do servidor, REAPROVEITA o código dele: as validações (@fin/shared) e os cálculos (api/src/domain/finance).
 * As regras que o servidor aplica no banco (renda principal, recorrência, cópia de mês, limites) são reimplementadas aqui e cobertas por testes.
 */
import './zod-jitless'; // PRIMEIRO: precisa rodar antes de qualquer esquema ser criado
import { ApiError } from '@fin/api-client';
import {
  DEFAULT_TIMEZONE, MAX_CENTS, MAX_CREDIT_CARDS, MAX_INCOMES_PER_MONTH, PALETTE, copyMonthSchema, createCardSchema, createCryptoSchema, createExpenseSchema, createIncomeSchema,
  createInvestmentSchema, createPurchaseSchema, listExpensesQuery, prevYm, setPinSchema, summaryQuery, todayIn, updateCardSchema, updateCryptoSchema, updateExpenseSchema,
  updateIncomeSchema, updateInvestmentSchema, updateSettingsSchema, yearlyQuery,
} from '@fin/shared';
import { z } from 'zod';

import { cardUsage, computeDues, cryptoPosition, cryptoTotals, monthSummary, monthsToTarget, yearlyStats } from '../../api/src/domain/finance';
import { sha256Hex } from './sha256';

/* ---------------- armazenamento ---------------- */
export interface Store { read(): string | null; write(value: string): void; clear(): void }
const KEY = 'md.local.v1';
/** Grava em DOIS lugares: localStorage do WebView e (no app Android) SharedPreferences, de forma síncrona — se um falhar ou ficar para trás, vale o mais novo. */
export function browserStore(): Store {
  const android = () => (typeof window !== 'undefined' ? (window as any).AndroidApp : undefined);
  const stamp = (raw: string | null) => { try { const j = JSON.parse(raw ?? ''); return typeof j?.savedAt === 'number' && j?.v ? j.savedAt : -1; } catch { return -1; } };
  return {
    read() {
      let ls: string | null = null, an: string | null = null;
      try { ls = localStorage.getItem(KEY); } catch { /* sem localStorage */ }
      try { an = android()?.loadData?.() || null; } catch { /* sem ponte */ }
      const a = stamp(ls), b = stamp(an); if (a < 0 && b < 0) return null; return b > a ? an : ls;
    },
    write(value) {
      let okLs = false, okAn = false;
      try { localStorage.setItem(KEY, value); okLs = true; } catch { /* cheio ou bloqueado */ }
      try { if (android()?.saveData) okAn = !!android().saveData(value); } catch { /* ponte indisponível */ }
      if (!okLs && !okAn) throw new Error('storage');
    },
    clear() { try { localStorage.removeItem(KEY); } catch { /* */ } try { android()?.saveData?.(''); } catch { /* */ } },
  };
}

/* ---------------- tipos do estado ---------------- */
interface Inc { id: string; ym: string; name: string; amountCents: number; recurring: boolean; isPrimary: boolean; seq: number }
interface Exp { id: string; ym: string; name: string; icon: string; color: string; amountCents: number; recurring: boolean; dueDay: number | null; installmentCurrent: number | null; installmentTotal: number | null; seq: number }
interface Pur { id: string; name: string; amountCents: number; installmentCurrent: number | null; installmentTotal: number | null; seq: number }
interface Card { id: string; name: string; color: string; limitCents: number; seq: number; purchases: Pur[] }
interface Inv { id: string; name: string; type: string; targetLimitCents: number; monthlyAmountCents: number; seq: number }
interface Hold { id: string; coinId: string | null; quantity: string; buyPriceCents: number; seq: number }
interface Settings { displayName: string | null; locale: string; theme: 'light' | 'dark'; timezone: string; monthlyGoalCents: number; privacyMode: boolean; onboarded: boolean; nameAsked: boolean; tutorialVersion: number }
type Prices = Record<string, { brl: number; change24h: number | null; at: number }>;
interface State { v: 1; savedAt: number; seq: number; settings: Settings; pin: { salt: string; hash: string } | null; months: Record<string, { incomes: Inc[]; expenses: Exp[] }>; opened: string[]; cards: Card[]; investments: Inv[]; holdings: Hold[]; prices: Prices; lastBackupAt: number | null }

const E = (status: number, code: string, message: string, details: { path: string; message: string }[] = []) => new ApiError(status, code, message, details);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
function parse(schema: { safeParse(i: unknown): any }, input: unknown): any {
  const r = schema.safeParse(input);
  if (!r.success) throw E(400, 'VALIDATION_ERROR', 'Dados inválidos', r.error.issues.map((i: any) => ({ path: i.path.join('.'), message: i.message })));
  return r.data;
}
const deviceTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE; } catch { return DEFAULT_TIMEZONE; } };
const randomId = () => (typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
const emptyState = (tz: string): State => ({ v: 1, savedAt: 0, seq: 1, settings: { displayName: null, locale: 'pt', theme: 'light', timezone: tz, monthlyGoalCents: 0, privacyMode: false, onboarded: false, nameAsked: false, tutorialVersion: 0 },
  pin: null, months: {}, opened: [], cards: [], investments: [], holdings: [], prices: {}, lastBackupAt: null });

const incDto = (i: Inc) => ({ id: i.id, ym: i.ym, name: i.name, amountCents: i.amountCents, recurring: i.recurring, isPrimary: i.isPrimary });
const expDto = (e: Exp) => ({ id: e.id, ym: e.ym, name: e.name, icon: e.icon, color: e.color, amountCents: e.amountCents, recurring: e.recurring, dueDay: e.dueDay, installmentCurrent: e.installmentCurrent, installmentTotal: e.installmentTotal });
const bySeq = <T extends { seq: number }>(l: T[]) => [...l].sort((a, b) => a.seq - b.seq);
const incOrdered = (l: Inc[]) => [...l].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.seq - b.seq);       // principal primeiro
const TTL = 30_000;

/* ---------------- backup ---------------- */
const centsZ = z.number().int().min(0).max(MAX_CENTS); const ymZ = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/); const idZ = z.string().min(1).max(64); const colorZ = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const instZ = z.number().int().min(1).max(99).nullable(); const nameZ = (n: number) => z.string().trim().min(1).max(n);
const backupSchema = z.object({
  app: z.literal('minhas-despesas-local'), version: z.number().int().min(1).max(1),
  data: z.object({
    settings: z.record(z.string(), z.unknown()),
    months: z.record(ymZ, z.object({
      incomes: z.array(z.object({ id: idZ, name: nameZ(24), amountCents: centsZ, recurring: z.boolean(), isPrimary: z.boolean().default(false) })).max(MAX_INCOMES_PER_MONTH),
      expenses: z.array(z.object({ id: idZ, name: nameZ(60), icon: z.string().min(1).max(24), color: colorZ, amountCents: centsZ, recurring: z.boolean(), dueDay: z.number().int().min(1).max(31).nullable(), installmentCurrent: instZ, installmentTotal: instZ })).max(500),
    })).refine((m) => Object.keys(m).length <= 1200, 'Meses demais'),
    opened: z.array(ymZ).max(1200),
    cards: z.array(z.object({ id: idZ, name: nameZ(40), color: colorZ, limitCents: centsZ, purchases: z.array(z.object({ id: idZ, name: nameZ(60), amountCents: centsZ, installmentCurrent: instZ, installmentTotal: instZ })).max(2000) })).max(MAX_CREDIT_CARDS),
    investments: z.array(z.object({ id: idZ, name: nameZ(60), type: z.string().max(30), targetLimitCents: centsZ, monthlyAmountCents: centsZ })).max(200),
    holdings: z.array(z.object({ id: idZ, coinId: z.string().max(40).nullable(), quantity: z.string().regex(/^\d{1,18}(\.\d{1,12})?$/), buyPriceCents: centsZ })).max(200),
  }),
});

export interface Deps { now?: () => number; fetchImpl?: typeof fetch; id?: () => string }

export class LocalBackend {
  private s: State; private readonly now: () => number; private readonly newId: () => string; private inflight = new Map<string, Promise<void>>();
  constructor(private readonly store: Store, private readonly deps: Deps = {}) { this.now = deps.now ?? (() => Date.now()); this.newId = deps.id ?? randomId; this.s = this.load(); }

  private load(): State {
    const raw = this.store.read();
    if (raw) { try { const j = JSON.parse(raw); if (j && j.v === 1 && j.months && j.settings) return { ...emptyState(deviceTz()), ...j, settings: { ...emptyState(deviceTz()).settings, ...j.settings } }; } catch { /* dado corrompido: começa vazio */ } }
    return emptyState(deviceTz());
  }
  private persist() { this.s.savedAt = this.now(); try { this.store.write(JSON.stringify(this.s)); } catch { throw E(500, 'STORAGE_ERROR', 'Não foi possível salvar neste aparelho.'); } }
  /** Executa uma alteração de forma "tudo ou nada": se algo falhar (inclusive gravar), o estado volta ao que era. */
  private mutate<T>(fn: () => T): T { const snap = JSON.stringify(this.s); try { const r = fn(); this.persist(); return r; } catch (e) { this.s = JSON.parse(snap); throw e; } }
  private seq() { return this.s.seq++; }
  private slot(ym: string) { return (this.s.months[ym] ??= { incomes: [], expenses: [] }); }
  private view(ym: string) { return this.s.months[ym] ?? { incomes: [], expenses: [] }; }
  private snapshot(ym: string) { const m = this.view(ym); return { ym, incomes: incOrdered(m.incomes).map(incDto), expenses: bySeq(m.expenses).map(expDto) }; }
  private findInc(id: string) { for (const m of Object.values(this.s.months)) { const i = m.incomes.find((x) => x.id === id); if (i) return i; } throw E(404, 'NOT_FOUND', 'Renda não encontrada'); }
  private findExp(id: string) { for (const m of Object.values(this.s.months)) { const e = m.expenses.find((x) => x.id === id); if (e) return e; } throw E(404, 'NOT_FOUND', 'Despesa não encontrada'); }
  private card(id: string) { const c = this.s.cards.find((x) => x.id === id); if (!c) throw E(404, 'NOT_FOUND', 'Cartão não encontrado'); return c; }
  /** Garante "exatamente uma principal" no mês (promove a renda mais antiga se não houver). */
  private ensurePrimary(ym: string) { const l = this.view(ym).incomes; if (l.length && !l.some((i) => i.isPrimary)) bySeq(l)[0].isPrimary = true; }
  private cardDto(c: Card) { return { id: c.id, name: c.name, color: c.color, limitCents: c.limitCents, ...cardUsage(c.limitCents, c.purchases.map((p) => p.amountCents)), purchases: bySeq(c.purchases).map((p) => ({ id: p.id, name: p.name, amountCents: p.amountCents, installmentCurrent: p.installmentCurrent, installmentTotal: p.installmentTotal })) }; }
  private settingsDto() { const s = this.s.settings; return { ...s, hasPin: !!this.s.pin }; }

  /** Abre o mês: na PRIMEIRA vez copia as recorrentes do mês anterior (rendas e despesas, de forma independente). Reabrir não copia de novo. */
  private openInternal(ym: string) {
    if (!this.s.opened.includes(ym)) {
      this.s.opened.push(ym); const prev = this.view(prevYm(ym)); const m = this.slot(ym);
      if (!m.incomes.length) {
        for (const i of incOrdered(prev.incomes).filter((x) => x.recurring)) m.incomes.push({ id: this.newId(), ym, name: i.name, amountCents: i.amountCents, recurring: true, isPrimary: i.isPrimary, seq: this.seq() });
        this.ensurePrimary(ym);
      }
      if (!m.expenses.length) for (const e of bySeq(prev.expenses).filter((x) => x.recurring)) m.expenses.push({ ...e, id: this.newId(), ym, seq: this.seq() });
    }
    return this.snapshot(ym);
  }

  /* ---- cotações (CoinGecko), com cache de 30 s e uso do último valor se a internet falhar ---- */
  private async prices(ids: string[]): Promise<Prices> {
    const uniq = [...new Set(ids)].sort(); const t = this.now(); const stale = uniq.filter((id) => !this.s.prices[id] || t - this.s.prices[id].at >= TTL);
    if (stale.length) { const key = stale.join(','); let p = this.inflight.get(key); if (!p) { p = this.fetchRemote(stale).finally(() => this.inflight.delete(key)); this.inflight.set(key, p); } await p; }
    const out: Prices = {}; for (const id of uniq) if (this.s.prices[id]) out[id] = this.s.prices[id]; return out;
  }
  private async fetchRemote(ids: string[]) {
    const f = this.deps.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined); if (!f) return;
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : undefined; const timer = ctl ? setTimeout(() => ctl.abort(), 5000) : undefined;
    try {
      const res = await f(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=brl&include_24hr_change=true`, { headers: { accept: 'application/json' }, signal: ctl?.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Record<string, { brl?: number; brl_24h_change?: number }>; const at = this.now(); let changed = false;
      for (const id of ids) { const r = json[id]; if (r && typeof r.brl === 'number' && isFinite(r.brl)) { this.s.prices[id] = { brl: r.brl, change24h: typeof r.brl_24h_change === 'number' ? r.brl_24h_change : null, at }; changed = true; } }
      if (changed) { try { this.persist(); } catch { /* cotação é descartável: falhar ao gravar não pode quebrar a tela */ } }
    } catch { /* sem internet/limite da CoinGecko: segue com o último valor conhecido */ } finally { if (timer) clearTimeout(timer); }
  }

  /* ---------------- API (mesma forma do cliente do servidor) ---------------- */
  readonly auth = { register: () => Promise.reject(E(400, 'LOCAL_MODE', 'Não disponível neste app')), forgotPassword: () => Promise.reject(E(400, 'LOCAL_MODE', 'Não disponível neste app')) };

  readonly me = {
    get: async () => ({ id: 'local', email: '', emailVerified: true, settings: this.settingsDto(), local: { lastBackupAt: this.s.lastBackupAt } }),
    updateSettings: async (b: unknown) => this.mutate(() => { const d = parse(updateSettingsSchema, b); Object.assign(this.s.settings, d); return this.settingsDto(); }),
    setPin: async (pin: string | null) => this.mutate(() => { const d = parse(setPinSchema, { pin }); if (d.pin === null) this.s.pin = null; else { const salt = this.newId().replace(/-/g, ''); this.s.pin = { salt, hash: sha256Hex(`${salt}:${d.pin}`) }; } return { hasPin: !!this.s.pin }; }),
    verifyPin: async (pin: string) => ({ valid: !this.s.pin || sha256Hex(`${this.s.pin.salt}:${pin}`) === this.s.pin.hash }),
    /** Backup completo (sem PIN e sem cotações). */
    export: async () => this.mutate(() => {
      this.s.lastBackupAt = this.now();
      return { app: 'minhas-despesas-local', version: 1, exportedAt: new Date(this.now()).toISOString(), data: clone({
        settings: this.s.settings, opened: this.s.opened, cards: bySeq(this.s.cards).map((c) => ({ id: c.id, name: c.name, color: c.color, limitCents: c.limitCents, purchases: bySeq(c.purchases).map(({ seq, ...p }) => p) })),
        months: Object.fromEntries(Object.entries(this.s.months).map(([k, m]) => [k, { incomes: incOrdered(m.incomes).map(({ seq, ym, ...i }) => i), expenses: bySeq(m.expenses).map(({ seq, ym, ...e }) => e) }])),
        investments: bySeq(this.s.investments).map(({ seq, ...i }) => i), holdings: bySeq(this.s.holdings).map(({ seq, ...h }) => h) }) };
    }),
    importBackup: async (json: unknown) => this.mutate(() => {
      const raw = typeof json === 'string' ? (() => { try { return JSON.parse(json); } catch { return null; } })() : json;
      const r = backupSchema.safeParse(raw); if (!r.success) throw E(400, 'INVALID_BACKUP', 'Backup inválido', r.error.issues.slice(0, 3).map((i) => ({ path: i.path.join('.'), message: i.message })));
      const d = r.data.data; const st = this.s; const fresh = emptyState(st.settings.timezone); fresh.pin = st.pin; fresh.prices = st.prices; fresh.lastBackupAt = st.lastBackupAt; fresh.seq = 1;
      const sp = updateSettingsSchema.safeParse(Object.fromEntries(Object.entries(d.settings).filter(([k]) => k in fresh.settings))); if (!sp.success) throw E(400, 'INVALID_BACKUP', 'Backup inválido');
      Object.assign(fresh.settings, sp.data);
      for (const [ym, m] of Object.entries(d.months)) {
        fresh.months[ym] = { incomes: m.incomes.map((i) => ({ ...i, ym, seq: fresh.seq++ })), expenses: m.expenses.map((e) => ({ ...e, ym, seq: fresh.seq++ })) };
        const inc = fresh.months[ym].incomes; const first = inc.findIndex((i) => i.isPrimary); inc.forEach((i, k) => { i.isPrimary = inc.length > 0 && k === (first >= 0 ? first : 0); });   // normaliza: uma só principal
      }
      fresh.opened = [...new Set(d.opened)]; fresh.cards = d.cards.map((c) => ({ ...c, seq: fresh.seq++, purchases: c.purchases.map((p) => ({ ...p, seq: fresh.seq++ })) }));
      fresh.investments = d.investments.map((i) => ({ ...i, seq: fresh.seq++ })); fresh.holdings = d.holdings.map((h) => ({ ...h, seq: fresh.seq++ }));
      this.s = fresh; return { ok: true };
    }),
    resetAll: async () => { this.store.clear(); this.s = emptyState(deviceTz()); this.inflight.clear(); return { ok: true }; },
  };

  readonly months = {
    // Abrir o mês é "melhor esforço": se o aparelho estiver sem espaço, a tela ainda abre (a cópia das recorrentes é refeita na próxima vez).
    open: async (ymIn: string) => {
      const ym = parse(summaryQuery, { ym: ymIn }).ym as string; const r = this.openInternal(ym);
      try { this.persist(); } catch { /* sem espaço: segue com o que está na memória */ }
      return r;
    },
    copy: async (from: string, target: string, overwrite = false) => this.mutate(() => {
      const b = parse(copyMonthSchema, { target, overwrite });
      if (from === b.target) throw E(400, 'SAME_MONTH', 'O mês de destino deve ser diferente do de origem');
      const src = this.view(from); const dst = this.view(b.target);
      if ((dst.incomes.length || dst.expenses.length) && !b.overwrite) throw E(409, 'MONTH_NOT_EMPTY', 'O mês de destino já tem dados. Confirme para substituir.');
      const m = this.slot(b.target); m.incomes = incOrdered(src.incomes).map((i) => ({ ...i, id: this.newId(), ym: b.target, seq: this.seq() })); m.expenses = bySeq(src.expenses).map((e) => ({ ...e, id: this.newId(), ym: b.target, seq: this.seq() }));
      this.ensurePrimary(b.target); if (!this.s.opened.includes(b.target)) this.s.opened.push(b.target);
      return { copiedIncomes: m.incomes.length, copiedExpenses: m.expenses.length };
    }),
  };

  readonly incomes = {
    create: async (body: unknown) => this.mutate(() => {
      const b = parse(createIncomeSchema, body); const m = this.slot(b.ym);
      if (m.incomes.length >= MAX_INCOMES_PER_MONTH) throw E(409, 'LIMIT_REACHED', `Você pode ter no máximo ${MAX_INCOMES_PER_MONTH} rendas por mês`);
      const makePrimary = b.isPrimary === true || !m.incomes.some((i) => i.isPrimary); if (makePrimary) m.incomes.forEach((i) => { i.isPrimary = false; });
      const inc: Inc = { id: this.newId(), ym: b.ym, name: b.name, amountCents: b.amountCents, recurring: b.recurring, isPrimary: makePrimary, seq: this.seq() }; m.incomes.push(inc); return incDto(inc);
    }),
    update: async (id: string, body: unknown) => this.mutate(() => {
      const { isPrimary, ...rest } = parse(updateIncomeSchema, body); const inc = this.findInc(id);
      if (isPrimary === false && inc.isPrimary) throw E(409, 'PRIMARY_REQUIRED', 'Para trocar a renda principal, marque outra renda como principal.');
      if (isPrimary === true && !inc.isPrimary) this.slot(inc.ym).incomes.forEach((i) => { i.isPrimary = false; });
      Object.assign(inc, rest, isPrimary === true ? { isPrimary: true } : {}); return incDto(inc);
    }),
    remove: async (id: string) => this.mutate(() => { const inc = this.findInc(id); const m = this.slot(inc.ym); m.incomes = m.incomes.filter((i) => i.id !== id); if (inc.isPrimary) this.ensurePrimary(inc.ym); }),
  };

  readonly expenses = {
    list: async (q: unknown = {}) => {
      const f = parse(listExpensesQuery, q); const needle = f.q ? String(f.q).toLowerCase() : null;
      let all = Object.entries(this.s.months).flatMap(([ym, m]) => m.expenses.map((e) => ({ ...e, ym }))).filter((e) => (!f.ym || e.ym === f.ym) && (!f.type || e.recurring === (f.type === 'fixed')) && (!needle || e.name.toLowerCase().includes(needle)));
      all = all.sort((a, b) => b.ym.localeCompare(a.ym) || a.seq - b.seq); const total = all.length;
      return { data: all.slice((f.page - 1) * f.limit, f.page * f.limit).map(expDto), meta: { page: f.page, limit: f.limit, total, totalPages: Math.max(1, Math.ceil(total / f.limit)) } };
    },
    create: async (body: unknown) => this.mutate(() => {
      const b = parse(createExpenseSchema, body); const m = this.slot(b.ym);
      const e: Exp = { id: this.newId(), ym: b.ym, name: b.name, icon: b.icon, color: b.color ?? PALETTE[m.expenses.length % PALETTE.length], amountCents: b.amountCents, recurring: b.recurring, dueDay: b.dueDay ?? null, installmentCurrent: b.installmentCurrent ?? null, installmentTotal: b.installmentTotal ?? null, seq: this.seq() };
      m.expenses.push(e); return expDto(e);
    }),
    update: async (id: string, body: unknown) => this.mutate(() => {
      const d = parse(updateExpenseSchema, body); const e = this.findExp(id); Object.assign(e, d);
      if (e.installmentCurrent != null && e.installmentTotal != null && e.installmentCurrent > e.installmentTotal) throw E(400, 'VALIDATION_ERROR', 'Dados inválidos', [{ path: 'installmentCurrent', message: 'A parcela atual não pode ser maior que o total' }]);
      return expDto(e);
    }),
    remove: async (id: string) => this.mutate(() => { const e = this.findExp(id); const m = this.slot(e.ym); m.expenses = m.expenses.filter((x) => x.id !== id); }),
  };

  readonly cards = {
    list: async () => bySeq(this.s.cards).map((c) => this.cardDto(c)),
    create: async (body: unknown) => this.mutate(() => {
      const b = parse(createCardSchema, body); if (this.s.cards.length >= MAX_CREDIT_CARDS) throw E(409, 'LIMIT_REACHED', `Você pode ter no máximo ${MAX_CREDIT_CARDS} cartões`);
      const c: Card = { id: this.newId(), name: b.name, color: b.color ?? PALETTE[this.s.cards.length % PALETTE.length], limitCents: b.limitCents, seq: this.seq(), purchases: [] }; this.s.cards.push(c); return this.cardDto(c);
    }),
    update: async (id: string, body: unknown) => this.mutate(() => { const d = parse(updateCardSchema, body); const c = this.card(id); Object.assign(c, d); return this.cardDto(c); }),
    remove: async (id: string) => this.mutate(() => { this.card(id); this.s.cards = this.s.cards.filter((c) => c.id !== id); }),
    addPurchase: async (id: string, body: unknown) => this.mutate(() => { const b = parse(createPurchaseSchema, body); const c = this.card(id); c.purchases.push({ id: this.newId(), name: b.name, amountCents: b.amountCents, installmentCurrent: b.installmentCurrent ?? null, installmentTotal: b.installmentTotal ?? null, seq: this.seq() }); return this.cardDto(c); }),
    removePurchase: async (id: string, pid: string) => this.mutate(() => { const c = this.card(id); if (!c.purchases.some((p) => p.id === pid)) throw E(404, 'NOT_FOUND', 'Gasto não encontrado'); c.purchases = c.purchases.filter((p) => p.id !== pid); }),
  };

  readonly investments = {
    list: async () => bySeq(this.s.investments).map((i) => ({ id: i.id, name: i.name, type: i.type, targetLimitCents: i.targetLimitCents, monthlyAmountCents: i.monthlyAmountCents, monthsToTarget: monthsToTarget(i.targetLimitCents, i.monthlyAmountCents) })),
    create: async (body: unknown) => this.mutate(() => { const b = parse(createInvestmentSchema, body ?? {}); const i: Inv = { id: this.newId(), ...b, seq: this.seq() }; this.s.investments.push(i); return { ...i, monthsToTarget: monthsToTarget(i.targetLimitCents, i.monthlyAmountCents) }; }),
    update: async (id: string, body: unknown) => this.mutate(() => { const d = parse(updateInvestmentSchema, body); const i = this.s.investments.find((x) => x.id === id); if (!i) throw E(404, 'NOT_FOUND', 'Investimento não encontrado'); Object.assign(i, d); return { ...i, monthsToTarget: monthsToTarget(i.targetLimitCents, i.monthlyAmountCents) }; }),
    remove: async (id: string) => this.mutate(() => { if (!this.s.investments.some((x) => x.id === id)) throw E(404, 'NOT_FOUND', 'Investimento não encontrado'); this.s.investments = this.s.investments.filter((x) => x.id !== id); }),
  };

  readonly crypto = {
    create: async (body: unknown) => this.mutate(() => { const b = parse(createCryptoSchema, body ?? {}); const h: Hold = { id: this.newId(), coinId: b.coinId, quantity: b.quantity, buyPriceCents: b.buyPriceCents, seq: this.seq() }; this.s.holdings.push(h); return clone(h); }),
    update: async (id: string, body: unknown) => this.mutate(() => { const d = parse(updateCryptoSchema, body); const h = this.s.holdings.find((x) => x.id === id); if (!h) throw E(404, 'NOT_FOUND', 'Moeda não encontrada'); Object.assign(h, d); return clone(h); }),
    remove: async (id: string) => this.mutate(() => { if (!this.s.holdings.some((x) => x.id === id)) throw E(404, 'NOT_FOUND', 'Moeda não encontrada'); this.s.holdings = this.s.holdings.filter((x) => x.id !== id); }),
    valuation: async () => {
      const hs = bySeq(this.s.holdings); const prices = await this.prices(hs.map((h) => h.coinId).filter((x): x is string => !!x));
      const items = hs.map((h) => { const p = h.coinId ? prices[h.coinId] : undefined; return { id: h.id, coinId: h.coinId, quantity: h.quantity, buyPriceCents: h.buyPriceCents, priceAvailable: !!p, currentPriceCents: p ? Math.round(p.brl * 100) : null, change24hPercent: p?.change24h ?? null, ...cryptoPosition(h.quantity, h.buyPriceCents, p ? p.brl : null) }; });
      const at = Math.max(0, ...Object.values(prices).map((p) => p.at)); return { items, totals: cryptoTotals(items), asOf: new Date(at || this.now()).toISOString() };
    },
  };

  readonly reports = {
    summary: async (ymIn: string, reserveMonths = 6) => {
      const q = parse(summaryQuery, { ym: ymIn, reserveMonths }); const m = this.view(q.ym);
      return { ym: q.ym, ...monthSummary({ incomeCents: m.incomes.map((i) => i.amountCents), goalCents: this.s.settings.monthlyGoalCents, reserveMonths: q.reserveMonths, expenses: bySeq(m.expenses).map((e) => ({ id: e.id, name: e.name, color: e.color, amountCents: e.amountCents, recurring: e.recurring })) }) };
    },
    yearly: async (year: number) => {
      const q = parse(yearlyQuery, { year });
      const list = Array.from({ length: 12 }, (_, k) => { const ym = `${q.year}-${String(k + 1).padStart(2, '0')}`; const m = this.s.months[ym]; return { ym, expensesCents: m ? m.expenses.reduce((a, e) => a + e.amountCents, 0) : 0, incomeCents: m ? m.incomes.reduce((a, e) => a + e.amountCents, 0) : 0 }; });
      return { year: q.year, months: list, ...yearlyStats(list) };
    },
    dues: async (ym: string) => computeDues(bySeq(this.view(ym).expenses).filter((e) => e.dueDay).map((e) => ({ id: e.id, name: e.name, amountCents: e.amountCents, dueDay: e.dueDay!, createdAt: new Date(e.seq) })), ym, todayIn(this.s.settings.timezone), 3),
    agenda: async (months = 3) => {
      const today = todayIn(this.s.settings.timezone); const [y, mo] = today.ym.split('-').map(Number); const out: { ym: string; dueDay: number; expenseId: string; name: string; amountCents: number }[] = [];
      for (let k = 0; k < months; k++) { const d = new Date(Date.UTC(y, mo - 1 + k, 1)); const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        bySeq(this.view(ym).expenses).filter((e) => e.dueDay).sort((a, b) => a.dueDay! - b.dueDay! || a.seq - b.seq).forEach((e) => out.push({ ym, dueDay: e.dueDay!, expenseId: e.id, name: e.name, amountCents: e.amountCents })); }
      return out;
    },
  };
}
