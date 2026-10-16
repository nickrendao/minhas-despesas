const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function currentYm(timeZone: string | undefined = 'America/Sao_Paulo', now = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: timeZone ?? "America/Sao_Paulo", year: 'numeric', month: '2-digit' }).formatToParts(now);
  return `${p.find((x) => x.type === 'year')!.value}-${p.find((x) => x.type === 'month')!.value}`;
}
export function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
export const monthName = (ym: string) => MESES[Number(ym.split('-')[1]) - 1];
export const monthLabel = (ym: string) => `${monthName(ym)} de ${ym.split('-')[0]}`;

/** Dias entre duas datas {ym, day} (positivo = futuro). Só para rótulos de interface. */
export function daysBetween(a: { ym: string; day: number }, b: { ym: string; day: number }): number {
  const t = (x: { ym: string; day: number }) => Date.UTC(Number(x.ym.slice(0, 4)), Number(x.ym.slice(5, 7)) - 1, x.day);
  return Math.round((t(b) - t(a)) / 86400000);
}
