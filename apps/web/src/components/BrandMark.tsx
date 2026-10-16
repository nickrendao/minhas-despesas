export const BRAND_GREEN = '#009929'; export const BRAND_INK = '#14150D';

/** Logo oficial: "A sobra" (barras de despesas + a bolinha que sobra), em tile verde. Único logo do produto. */
export function BrandMark({ size = 40 }: { size?: number }) {
  const k = BRAND_INK;
  return (
    <span className="brand" style={{ width: size, height: size }} role="img" aria-label="Minhas Despesas">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill={BRAND_GREEN} />
        <rect x="11" y="36" width="11" height="16" rx="5.5" fill={k} /><rect x="26.5" y="26" width="11" height="26" rx="5.5" fill={k} />
        <rect x="42" y="34" width="11" height="18" rx="5.5" fill={k} /><circle cx="47.5" cy="19" r="6.5" fill={k} />
      </svg>
    </span>
  );
}
