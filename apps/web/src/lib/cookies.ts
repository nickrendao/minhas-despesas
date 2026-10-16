/** Cookie do refresh token: httpOnly (JavaScript da página NÃO lê), SameSite=Lax, restrito a /api/auth. */
export const REFRESH_COOKIE = 'fin_rt';

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k) { try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignora cookie malformado */ } }
  }
  return out;
}

export function serializeRefreshCookie(value: string, opts: { secure: boolean; maxAgeSeconds: number }): string {
  return [
    `${REFRESH_COOKIE}=${encodeURIComponent(value)}`, 'Path=/api/auth', 'HttpOnly', 'SameSite=Lax',
    `Max-Age=${opts.maxAgeSeconds}`, ...(opts.secure ? ['Secure'] : []),
  ].join('; ');
}

export function clearRefreshCookie(secure: boolean): string {
  return [`${REFRESH_COOKIE}=`, 'Path=/api/auth', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0', ...(secure ? ['Secure'] : [])].join('; ');
}
