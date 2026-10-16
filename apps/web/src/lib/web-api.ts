import { ApiError, createApiClient, MemoryTokenStorage } from '@fin/api-client';

/**
 * Cliente da API para o NAVEGADOR. O access token fica só na memória da página (15 min);
 * o refresh token fica num cookie httpOnly que só o servidor do site (BFF) consegue ler.
 */
const storage = new MemoryTokenStorage();
let authLostHandler: (() => void) | undefined;
export const setAuthLostHandler = (fn?: () => void) => { authLostHandler = fn; };

async function refreshViaBff(): Promise<string | null> {
  const run = async () => {
    const r = await fetch('/api/auth/refresh', { method: 'POST' });
    if (!r.ok) return null;
    return (await r.json()).data.accessToken as string;
  };
  // Web Locks: com várias abas abertas, só UMA renova por vez (o cookie rotaciona a cada renovação).
  const locks = typeof navigator !== 'undefined' ? (navigator as any).locks : undefined;
  return locks ? locks.request('fin-refresh', run) : run();
}

export const webApi = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api/v1',
  storage, renew: refreshViaBff, onAuthLost: () => authLostHandler?.(),
});

async function bff(path: string, body?: unknown) {
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(r.status, j?.error?.code ?? 'HTTP_ERROR', j?.error?.message ?? 'Erro inesperado', j?.error?.details ?? []);
  return j;
}
export async function webLogin(email: string, password: string) {
  const j = await bff('/api/auth/login', { email, password });
  await storage.set({ accessToken: j.data.accessToken, refreshToken: '' });
}
export async function webLogout() {
  await bff('/api/auth/logout').catch(() => undefined);
  await storage.set(null);
}

/** Chamadas ao BFF que precisam do access token; se estiver vencido, renova e tenta de novo UMA vez. */
async function bffAuthed(path: string, body: unknown) {
  const call = async (token?: string) => fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  let r = await call((await storage.get())?.accessToken);
  if (r.status === 401) { const t = await refreshViaBff(); if (t) { await storage.set({ accessToken: t, refreshToken: '' }); r = await call(t); } }
  const j = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(r.status, j?.error?.code ?? 'HTTP_ERROR', j?.error?.message ?? 'Erro inesperado', j?.error?.details ?? []);
  return j;
}
export async function webChangePassword(currentPassword: string, newPassword: string) {
  const j = await bffAuthed('/api/auth/change-password', { currentPassword, newPassword });
  await storage.set({ accessToken: j.data.accessToken, refreshToken: '' });
}
export async function webDeleteAccount(password: string) {
  await bffAuthed('/api/auth/delete-account', { password });
  await storage.set(null);
}
