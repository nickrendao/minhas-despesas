/**
 * Estratégia de dinheiro (decisão arquitetural):
 *  - Todo valor monetário trafega e é armazenado como INTEIRO EM CENTAVOS (BRL).
 *  - Nunca usamos float para dinheiro: 0.1 + 0.2 !== 0.3 em ponto flutuante.
 *  - Quantidades de cripto usam string decimal (precisão arbitrária) no contrato.
 *  - Conversão para texto "R$ 1.234,56" acontece só na borda (interface).
 */
export const MAX_CENTS = 2_000_000_000; // R$ 20.000.000,00 (cabe em INT4 do PostgreSQL)

export function isValidCents(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_CENTS;
}

/** Converte reais (number vindo de dados legados em float) para centavos inteiros. */
export function reaisToCents(reais: number | string | null | undefined): number {
  if (reais === null || reais === undefined || reais === '') return 0;
  const n = typeof reais === 'string' ? Number(reais.replace(',', '.')) : reais;
  if (!Number.isFinite(n)) return 0;
  // Math.round corrige o erro binário (ex.: 1.005*100 = 100.49999999999999)
  return Math.round((n + Number.EPSILON) * 100);
}

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

/** Soma segura de inteiros. */
export function sumCents(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

/** Percentual inteiro arredondado, 0 quando a base é 0 (regra do site atual: "comprometido"). */
export function percentRounded(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}
