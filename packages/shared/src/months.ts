/**
 * Mês é representado como "YYYY-MM" (texto), sem fuso horário.
 * Assim "o mês de setembro" é setembro para qualquer pessoa, em qualquer dispositivo.
 */
export const YM_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isYm(v: unknown): v is string {
  return typeof v === 'string' && YM_REGEX.test(v);
}

export function prevYm(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "Hoje" no fuso do usuário, como { ym, day } — evita erro de virada de mês por UTC. */
export function todayIn(timeZone: string, now: Date = new Date()): { ym: string; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { ym: `${get('year')}-${get('month')}`, day: Number(get('day')) };
}
