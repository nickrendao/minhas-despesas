import { z } from 'zod';
import { MAX_CENTS } from './money';
import { YM_REGEX } from './months';
import { CRYPTO_COINS, INVESTMENT_TYPES, SUPPORTED_LOCALES } from './constants';

export const cents = z.number().int().min(0).max(MAX_CENTS);
export const ym = z.string().regex(YM_REGEX, 'Mês inválido (use AAAA-MM)');
export const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida (use #RRGGBB)');
export const uuid = z.string().uuid();
const name = (max = 60) => z.string().trim().min(1, 'Nome obrigatório').max(max);
const installment = z.number().int().min(1).max(99);

// ---------- Auth ----------
export const passwordNew = z.string().min(6, 'Mínimo de 6 caracteres').max(128);
export const registerSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: passwordNew });
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(128) });
export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(512) });
export const verifyEmailSchema = z.object({ token: z.string().min(20).max(512) });
export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(512), password: passwordNew });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordNew });
export const deleteAccountSchema = z.object({ password: z.string().min(1).max(128) });

// ---------- Settings ----------
export const updateSettingsSchema = z.object({
  displayName: z.string().trim().max(30).nullable().optional(),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  timezone: z.string().max(64).optional(),
  monthlyGoalCents: cents.optional(),
  privacyMode: z.boolean().optional(),
  onboarded: z.boolean().optional(),
  nameAsked: z.boolean().optional(),
  tutorialVersion: z.number().int().min(0).max(1000).optional(),
}).strict();
export const setPinSchema = z.object({ pin: z.string().regex(/^\d{4,6}$/, 'PIN deve ter de 4 a 6 números').nullable() });
export const verifyPinSchema = z.object({ pin: z.string().regex(/^\d{4,6}$/) });

// ---------- Incomes ----------
export const createIncomeSchema = z.object({
  ym, name: name(24).default('Renda'), amountCents: cents.default(0), recurring: z.boolean().default(false), isPrimary: z.boolean().optional(),
});
export const updateIncomeSchema = z.object({
  name: name(24).optional(), amountCents: cents.optional(), recurring: z.boolean().optional(), isPrimary: z.boolean().optional(),
}).strict();

// ---------- Expenses ----------
const expenseBase = {
  name: name(60),
  icon: z.string().trim().min(1).max(24).default('receipt'),   // chave do ícone de linha (ex.: 'home'); emojis antigos continuam aceitos
  color: color.optional(),
  amountCents: cents.default(0),
  recurring: z.boolean().default(false),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  installmentCurrent: installment.nullable().optional(),
  installmentTotal: installment.nullable().optional(),
};
const installmentsConsistent = (v: { installmentCurrent?: number | null; installmentTotal?: number | null }) =>
  v.installmentCurrent == null || v.installmentTotal == null || v.installmentCurrent <= v.installmentTotal;
const installmentMsg = { message: 'A parcela atual não pode ser maior que o total', path: ['installmentCurrent'] };

export const createExpenseSchema = z.object({ ym, ...expenseBase }).refine(installmentsConsistent, installmentMsg);
export const updateExpenseSchema = z.object({
  name: expenseBase.name.optional(), icon: z.string().trim().min(1).max(24).optional(), color: color.optional(),
  amountCents: cents.optional(), recurring: z.boolean().optional(), dueDay: expenseBase.dueDay,
  installmentCurrent: expenseBase.installmentCurrent, installmentTotal: expenseBase.installmentTotal,
}).strict().refine(installmentsConsistent, installmentMsg);

export const listExpensesQuery = z.object({
  ym: ym.optional(),
  type: z.enum(['fixed', 'variable']).optional(),
  q: z.string().trim().min(1).max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const copyMonthSchema = z.object({ target: ym, overwrite: z.boolean().default(false) });

// ---------- Credit cards ----------
export const createCardSchema = z.object({ name: name(40).default('Novo cartão'), color: color.optional(), limitCents: cents.default(0) });
export const updateCardSchema = z.object({ name: name(40).optional(), color: color.optional(), limitCents: cents.optional() }).strict();
export const createPurchaseSchema = z.object({
  name: name(60).default('Gasto'), amountCents: cents.refine((v) => v > 0, 'Valor deve ser maior que zero'),
  installmentCurrent: installment.nullable().optional(), installmentTotal: installment.nullable().optional(),
}).refine(installmentsConsistent, installmentMsg);

// ---------- Investments ----------
export const createInvestmentSchema = z.object({
  name: name(60).default('Meu investimento'), type: z.enum(INVESTMENT_TYPES).default('tesouro_selic'),
  targetLimitCents: cents.default(0), monthlyAmountCents: cents.default(0),
});
export const updateInvestmentSchema = z.object({
  name: name(60).optional(), type: z.enum(INVESTMENT_TYPES).optional(),
  targetLimitCents: cents.optional(), monthlyAmountCents: cents.optional(),
}).strict();

// ---------- Crypto ----------
const quantity = z.string().regex(/^\d{1,18}(\.\d{1,12})?$/, 'Quantidade inválida');
export const createCryptoSchema = z.object({
  coinId: z.enum(CRYPTO_COINS).nullable().default(null), quantity: quantity.default('0'), buyPriceCents: cents.default(0),
});
export const updateCryptoSchema = z.object({
  coinId: z.enum(CRYPTO_COINS).nullable().optional(), quantity: quantity.optional(), buyPriceCents: cents.optional(),
}).strict();

// ---------- Reports ----------
export const summaryQuery = z.object({ ym, reserveMonths: z.coerce.number().int().min(3).max(12).default(6) });
export const yearlyQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100) });
export const duesQuery = z.object({ ym });
