/** Detecção de plataforma só para ajustes de comportamento (nunca para liberar/bloquear recursos). */
export function isIOS(nav: { userAgent?: string; platform?: string; maxTouchPoints?: number } | undefined = typeof navigator !== 'undefined' ? navigator : undefined): boolean {
  if (!nav) return false;
  const ua = nav.userAgent ?? '';
  return /iPad|iPhone|iPod/.test(ua) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);   // iPadOS se apresenta como Mac
}
/** App aberto pelo ícone da tela inicial (modo "standalone"), e não dentro do Safari. */
export function isStandalone(): boolean {
  if (typeof navigator === 'undefined') return false;
  try { return (navigator as any).standalone === true || (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches); } catch { return false; }
}
/** O Safari só instala PWA em https (ou localhost, para testes). */
export const canInstallPwa = (loc: { protocol: string; hostname: string }) => loc.protocol === 'https:' || loc.hostname === 'localhost';
