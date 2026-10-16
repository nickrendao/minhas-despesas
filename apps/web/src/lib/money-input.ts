/**
 * Converte o que a pessoa digita em CENTAVOS inteiros. Aceita "1.234,56", "1234,56", "1234.56", "1234", "R$ 10,5".
 * Regra: se há vírgula, ela é o separador decimal e pontos são milhar; sem vírgula, um único ponto com 1–2 dígitos
 * depois é decimal ("10.5" = 10,50) e qualquer outro uso do ponto é milhar ("1.234" = 1234,00).
 * Devolve null se não for um valor válido (negativo, texto, mais de 2 casas decimais...).
 */
/** Milhar válido: 1–3 dígitos, depois grupos de exatamente 3 (1.234 · 12.345.678). */
const GROUPED = /^\d{1,3}(\.\d{3})+$/;

export function parseMoneyInput(raw: string): number | null {
  let s = raw.replace(/R\$/gi, '').replace(/\s/g, '');
  if (!s) return null;
  if (!/^[0-9.,]+$/.test(s)) return null;
  let intPart: string, decPart = '';
  if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length !== 2) return null;
    if (parts[0].includes('.') && !GROUPED.test(parts[0])) return null;   // milhar mal formatado ("1.5.5,2")
    intPart = parts[0].replace(/\./g, ''); decPart = parts[1];
  } else {
    const dots = s.split('.');
    if (dots.length === 2 && dots[1].length > 0 && dots[1].length <= 2) { intPart = dots[0]; decPart = dots[1]; }
    else {
      if (s.includes('.') && !GROUPED.test(s)) return null;                 // "1.5.5" não é um milhar válido
      intPart = s.replace(/\./g, '');
    }
  }
  if (!/^\d*$/.test(intPart) || !/^\d{0,2}$/.test(decPart)) return null;
  const cents = Number(intPart || '0') * 100 + Number((decPart + '00').slice(0, 2));
  return Number.isSafeInteger(cents) && cents <= 2_000_000_000 ? cents : null;
}

/** Centavos -> texto para o campo ("1500,50"). */
export function centsToInput(cents: number): string {
  if (!cents) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}
