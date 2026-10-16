import { CRYPTO_COINS, INVESTMENT_TYPES, MAX_CENTS, PALETTE, reaisToCents, SUPPORTED_LOCALES, YM_REGEX } from '@fin/shared';

/**
 * Converte UMA linha da tabela legada `app_data` (um JSON gigante por usuário) em registros normalizados.
 * É uma função PURA (sem banco): por isso dá para testar com dados no formato real e rodar em "dry-run".
 * Formato legado (confirmado no código do site): todos os valores do JSON são TEXTO (JSON.stringify),
 * dinheiro em reais (float), ids de 7 caracteres.
 */

export interface LegacyAuthUser { id: string; email: string; encryptedPassword: string | null; emailConfirmedAt: Date | null }

export interface MigrationPlan {
  userId: string;
  user: { email: string; passwordHash: string; passwordAlgo: 'bcrypt' | 'scrypt'; emailVerifiedAt: Date | null } | null;
  settings: { displayName: string | null; locale: string; theme: string; monthlyGoalCents: number; privacyMode: boolean; pinPlain: string | null; onboarded: boolean; nameAsked: boolean };
  months: { ym: string; incomes: PlanIncome[]; expenses: PlanExpense[] }[];
  cards: { name: string; color: string; limitCents: number; purchases: PlanPurchase[] }[];
  investments: { name: string; type: string; targetLimitCents: number; monthlyAmountCents: number }[];
  crypto: { coinId: string | null; quantity: string; buyPriceCents: number }[];
  warnings: string[];
  /** Totais do dado ORIGINAL em reais (float), para conferir contra o que foi gravado. */
  legacyTotals: { expensesReais: number; incomesReais: number; cardPurchasesReais: number; counts: Record<string, number> };
}
interface PlanIncome { name: string; amountCents: number; recurring: boolean }
interface PlanExpense { name: string; icon: string; color: string; amountCents: number; recurring: boolean; dueDay: number | null; installmentCurrent: number | null; installmentTotal: number | null }
interface PlanPurchase { name: string; amountCents: number; installmentCurrent: number | null; installmentTotal: number | null }

const TYPE_MAP: Record<string, (typeof INVESTMENT_TYPES)[number]> = {
  'Tesouro Selic': 'tesouro_selic', 'CDB': 'cdb', 'Fundos DI': 'fundos_di', 'Poupança': 'poupanca',
  'Ações': 'acoes', 'Fundos Imobiliários': 'fiis', 'Criptomoeda': 'cripto', 'Outro': 'outro',
};

export function transformLegacyUser(userId: string, blob: Record<string, unknown>, auth: LegacyAuthUser | null): MigrationPlan {
  const warnings: string[] = [];
  const warn = (m: string) => warnings.push(m);
  const getStr = (k: string): string | null => (typeof blob[k] === 'string' ? (blob[k] as string) : null);
  const getJson = <T>(k: string, fallback: T): T => {
    const s = getStr(k); if (s == null) return fallback;
    try { return JSON.parse(s) as T; } catch { warn(`Chave "${k}" com JSON inválido — ignorada`); return fallback; }
  };
  /** Valor em reais já saneado (>= 0 e dentro do limite). Qualquer ajuste é avisado com o valor exato. */
  const reais = (v: unknown, where: string): number => {
    const n = Number(v);
    if (v == null || v === '' || !Number.isFinite(n)) return 0;
    if (n < 0) { warn(`${where}: valor negativo (R$ ${n.toFixed(2)}) ajustado para R$ 0,00 — o novo modelo não aceita valores negativos`); return 0; }
    if (n * 100 > MAX_CENTS) { warn(`${where}: valor R$ ${n} acima do limite — ajustado para o máximo`); return MAX_CENTS / 100; }
    return n;
  };
  const money = (v: unknown, where: string): number => reaisToCents(reais(v, where));
  const text = (v: unknown, max: number, fallback: string, where: string): string => {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s) return fallback;
    if (s.length > max) { warn(`${where}: nome "${s.slice(0, 20)}…" cortado em ${max} caracteres`); return s.slice(0, max); }
    return s;
  };
  const color = (v: unknown, i: number) => (typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v) ? v : PALETTE[i % PALETTE.length]);
  const installments = (cur: unknown, tot: unknown, where: string): [number | null, number | null] => {
    const c = Number(cur) || 0, t = Number(tot) || 0;
    if (!c && !t) return [null, null];
    if (c < 1 || c > 99 || t < 1 || t > 99 || c > t) { if (c || t) warn(`${where}: parcelas inválidas (${c}/${t}) — descartadas`); return [null, null]; }
    return [c, t];
  };

  const salaryRecurring = getStr('salaryRecurring') === 'true';
  const salaryBase = Number(getStr('salaryBase')) || 0;

  // ---------- usuário ----------
  let user: MigrationPlan['user'] = null;
  if (auth) {
    user = {
      email: auth.email.trim().toLowerCase(),
      passwordHash: auth.encryptedPassword ?? '',
      passwordAlgo: 'bcrypt',
      emailVerifiedAt: auth.emailConfirmedAt,
    };
    if (!auth.encryptedPassword) warn('Usuário sem senha (login social?) — precisará usar "Esqueci minha senha"');
  } else {
    warn('Usuário NÃO encontrado em auth.users — não é possível migrar (sem e-mail)');
  }

  // ---------- configurações ----------
  const pin = getStr('privacyPin');
  const lang = getStr('lang');
  const nameRaw = getStr('displayName');
  const settings = {
    displayName: nameRaw ? nameRaw.trim().slice(0, 30) || null : null,
    locale: lang && (SUPPORTED_LOCALES as readonly string[]).includes(lang) ? lang : 'pt',
    theme: getStr('theme') === 'dark' ? 'dark' : 'light',
    monthlyGoalCents: money(getStr('monthlyGoal'), 'meta mensal'),
    privacyMode: getStr('privacyMode') === 'true',
    pinPlain: pin && /^\d{4,6}$/.test(pin) ? pin : null,
    onboarded: getStr('onboarded') === 'true',
    nameAsked: getStr('nameAsked') === 'true',
  };
  if (pin && !settings.pinPlain) warn('PIN legado em formato inválido — descartado');

  const totals = { expensesReais: 0, incomesReais: 0, cardPurchasesReais: 0, counts: { months: 0, incomes: 0, expenses: 0, cards: 0, purchases: 0, investments: 0, crypto: 0 } as Record<string, number> };

  // ---------- meses ----------
  const monthKeys = Object.keys(blob).filter((k) => k.startsWith('month:')).map((k) => k.slice(6)).sort();
  const months: MigrationPlan['months'] = [];
  monthKeys.forEach((ym, idx) => {
    if (!YM_REGEX.test(ym)) { warn(`Mês com chave inválida "${ym}" — ignorado`); return; }
    const m = getJson<{ salary?: number; incomes?: any[]; expenses?: any[] }>(`month:${ym}`, {});
    // mesma regra do applyRecurring legado: sem "incomes" mas com salário => uma renda "Renda"
    let incomesRaw = Array.isArray(m.incomes) ? m.incomes : [];
    if (incomesRaw.length === 0 && Number(m.salary) > 0) incomesRaw = [{ name: 'Renda', value: m.salary, recurring: salaryRecurring }];
    // renda recorrente global ligada: o ÚLTIMO mês recebe a renda base para que os próximos meses a herdem
    if (incomesRaw.length === 0 && salaryRecurring && salaryBase > 0 && idx === monthKeys.length - 1) {
      incomesRaw = [{ name: 'Renda', value: salaryBase, recurring: true }];
    }
    const incomes = incomesRaw.slice(0, 3).map((i) => {
      const r = reais(i.value, `renda ${ym}`);
      totals.incomesReais += r;
      return { name: text(i.name, 24, 'Renda', `renda ${ym}`), amountCents: reaisToCents(r), recurring: !!i.recurring };
    });
    if (incomesRaw.length > 3) warn(`Mês ${ym}: ${incomesRaw.length} rendas — mantidas só as 3 primeiras`);
    const expenses = (Array.isArray(m.expenses) ? m.expenses : []).map((e, n) => {
      const r = reais(e.value, `despesa "${e.name}" ${ym}`);
      totals.expensesReais += r;
      const [ic, it] = installments(e.installmentCurrent, e.installmentTotal, `despesa "${e.name}" ${ym}`);
      const due = Number(e.dueDay);
      return {
        name: text(e.name, 60, 'Despesa', `despesa ${ym}`), icon: typeof e.icon === 'string' && e.icon && e.icon.length <= 8 ? e.icon : '🧾',
        color: color(e.color, n), amountCents: reaisToCents(r), recurring: !!e.recurring,
        dueDay: Number.isInteger(due) && due >= 1 && due <= 31 ? due : null, installmentCurrent: ic, installmentTotal: it,
      };
    });
    totals.counts.incomes += incomes.length; totals.counts.expenses += expenses.length; totals.counts.months++;
    months.push({ ym, incomes, expenses });
  });

  // ---------- cartões ----------
  const cardsRaw = getJson<any[]>('cards', []);
  const cards = cardsRaw.slice(0, 5).map((c, n) => {
    // compatibilidade legada: cartão antigo só tinha "used" (sem lista de compras)
    const purchasesRaw: any[] = Array.isArray(c.purchases) ? c.purchases : Number(c.used) > 0 ? [{ name: 'Gastos anteriores', value: Number(c.used) }] : [];
    const purchases = purchasesRaw.map((p) => {
      const r = reais(p.value, `compra "${p.name}"`);
      totals.cardPurchasesReais += r;
      const [ic, it] = installments(p.installmentCurrent, p.installmentTotal, `compra "${p.name}"`);
      return { name: text(p.name, 60, 'Gasto', 'compra'), amountCents: reaisToCents(r), installmentCurrent: ic, installmentTotal: it };
    });
    totals.counts.purchases += purchases.length;
    return { name: text(c.name, 40, 'Cartão', 'cartão'), color: color(c.color, n), limitCents: money(c.limit, 'limite do cartão'), purchases };
  });
  if (cardsRaw.length > 5) warn(`${cardsRaw.length} cartões — mantidos só os 5 primeiros`);
  totals.counts.cards = cards.length;

  // ---------- investimentos ----------
  const investments = getJson<any[]>('investments', []).map((i) => ({
    name: text(i.name, 60, 'Investimento', 'investimento'),
    type: TYPE_MAP[i.type] ?? (warn(`Tipo de investimento desconhecido "${i.type}" -> "outro"`), 'outro'),
    targetLimitCents: money(i.targetLimit, 'meta do investimento'), monthlyAmountCents: money(i.monthlyAmount, 'aporte mensal'),
  }));
  totals.counts.investments = investments.length;

  // ---------- cripto ----------
  const crypto = getJson<any[]>('cryptoHoldings', []).map((h) => {
    const coin = typeof h.coinId === 'string' && (CRYPTO_COINS as readonly string[]).includes(h.coinId) ? h.coinId : null;
    if (h.coinId && !coin) warn(`Moeda desconhecida "${h.coinId}" — mantida sem moeda`);
    const q = Number(h.quantity);
    const quantity = Number.isFinite(q) && q >= 0 ? q.toFixed(12).replace(/0+$/, '').replace(/\.$/, '') || '0' : '0';
    return { coinId: coin, quantity, buyPriceCents: money(h.buyPrice, 'preço de compra cripto') };
  });
  totals.counts.crypto = crypto.length;

  return { userId, user, settings, months, cards, investments, crypto, warnings, legacyTotals: totals };
}
