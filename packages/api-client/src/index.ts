/**
 * Cliente da API — usado IGUALMENTE pelo site (Next.js) e pelo app (React Native).
 * Só usa `fetch` padrão: nada específico de navegador. O armazenamento dos tokens é injetado
 * (site: cookie httpOnly via BFF ou memória; mobile: expo-secure-store).
 *
 * Garantias:
 *  - Renovação de sessão "single-flight": 10 chamadas simultâneas com token vencido geram UM único /auth/refresh
 *    (refresh token é rotativo — dois refresh com o mesmo token derrubariam a sessão por segurança).
 *  - Cada chamada é repetida no máximo UMA vez após renovar.
 *  - Erros sempre viram `ApiError` com `code` estável.
 */
export interface Tokens { accessToken: string; refreshToken: string }
export interface TokenStorage { get(): Promise<Tokens | null>; set(t: Tokens | null): Promise<void> }

export class MemoryTokenStorage implements TokenStorage {
  private t: Tokens | null = null;
  async get() { return this.t; }
  async set(t: Tokens | null) { this.t = t; }
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly details: { path: string; message: string }[] = []) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ClientOptions {
  baseUrl: string;                      // ex.: https://api.exemplo.com/api/v1
  storage: TokenStorage;
  onAuthLost?: () => void;              // chamado quando a sessão não pode ser renovada (mandar para o login)
  fetchImpl?: typeof fetch;
  /**
   * Modo "site seguro" (BFF): o refresh token vive num cookie httpOnly que o JavaScript não lê.
   * Em vez de guardar o refresh token, o site fornece esta função, que pede ao servidor do site
   * (que tem o cookie) um novo access token. Devolve null se a sessão acabou.
   */
  renew?: () => Promise<string | null>;
}

type Json = Record<string, any>;
const RENEWABLE = new Set(['INVALID_TOKEN', 'MISSING_TOKEN']);

export function createApiClient(opts: ClientOptions) {
  // `fetch` é resolvido só na hora da chamada (importar este módulo nunca falha, em nenhum ambiente)
  const doFetch: typeof fetch = opts.fetchImpl ?? ((...args) => fetch(...args));
  let refreshing: Promise<Tokens | null> | null = null;

  async function raw(method: string, path: string, body: unknown, accessToken?: string) {
    const res = await doFetch(opts.baseUrl + path, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return { status: 204, json: undefined as any };
    let json: Json | undefined;
    try { json = await res.json(); } catch { json = undefined; }
    return { status: res.status, json };
  }

  function toError(status: number, json?: Json) {
    const e = json?.error;
    return new ApiError(status, e?.code ?? 'HTTP_ERROR', e?.message ?? `Erro ${status}`, e?.details ?? []);
  }

  function renew(): Promise<Tokens | null> {
    if (!refreshing) {
      refreshing = (async () => {
        if (opts.renew) {
          const accessToken = await opts.renew();
          if (!accessToken) { await opts.storage.set(null); opts.onAuthLost?.(); return null; }
          const t = { accessToken, refreshToken: '' };
          await opts.storage.set(t);
          return t;
        }
        const current = await opts.storage.get();
        if (!current) return null;
        const r = await raw('POST', '/auth/refresh', { refreshToken: current.refreshToken });
        if (r.status !== 200) { await opts.storage.set(null); opts.onAuthLost?.(); return null; }
        const t = { accessToken: r.json.data.accessToken, refreshToken: r.json.data.refreshToken };
        await opts.storage.set(t);
        return t;
      })().finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function request<T = any>(method: string, path: string, body?: unknown, auth = true): Promise<{ data: T; meta?: Json }> {
    let tokens = auth ? await opts.storage.get() : null;
    // Sem token em memória (ex.: página recém-aberta) e com renovação disponível: renova ANTES de chamar,
    // em vez de fazer uma chamada que já sabemos que voltaria 401 (evita o ruído e uma ida ao servidor).
    if (auth && !tokens && opts.renew) { tokens = await renew(); if (!tokens) throw new ApiError(401, 'MISSING_TOKEN', 'Autenticação necessária'); }
    let r = await raw(method, path, body, tokens?.accessToken);
    if (auth && r.status === 401 && RENEWABLE.has(r.json?.error?.code)) {
      // se outra chamada já está renovando, esperamos a mesma renovação
      tokens = await renew();
      if (!tokens) throw toError(401, r.json);
      r = await raw(method, path, body, tokens.accessToken);
    }
    if (r.status >= 400) throw toError(r.status, r.json);
    return { data: r.json?.data as T, meta: r.json?.meta };
  }

  const get = <T = any>(p: string) => request<T>('GET', p).then((r) => r.data);
  const post = <T = any>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}).then((r) => r.data);
  const patch = <T = any>(p: string, b: unknown) => request<T>('PATCH', p, b).then((r) => r.data);
  const del = (p: string) => request('DELETE', p).then(() => undefined);
  const qs = (o: Record<string, string | number | undefined>) => {
    const s = Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
    return s ? `?${s}` : '';
  };

  async function saveSession(t: Tokens) { await opts.storage.set({ accessToken: t.accessToken, refreshToken: t.refreshToken }); }

  return {
    auth: {
      register: (email: string, password: string) => request<{ requiresEmailVerification: boolean }>('POST', '/auth/register', { email, password }, false).then((r) => r.data),
      verifyEmail: (token: string) => request('POST', '/auth/verify-email', { token }, false).then(() => undefined),
      async login(email: string, password: string) {
        const { data } = await request<Tokens>('POST', '/auth/login', { email, password }, false);
        await saveSession(data);
      },
      async logout() {
        const t = await opts.storage.get();
        if (t) await request('POST', '/auth/logout', { refreshToken: t.refreshToken }, false).catch(() => undefined);
        await opts.storage.set(null);
      },
      forgotPassword: (email: string) => request('POST', '/auth/forgot-password', { email }, false).then(() => undefined),
      resetPassword: (token: string, password: string) => request('POST', '/auth/reset-password', { token, password }, false).then(() => undefined),
      async changePassword(currentPassword: string, newPassword: string) {
        const { data } = await request<Tokens>('POST', '/auth/change-password', { currentPassword, newPassword });
        await saveSession(data);
      },
      async deleteAccount(password: string) { await request('POST', '/auth/delete-account', { password }); await opts.storage.set(null); },
    },
    me: {
      get: () => get('/me'),
      updateSettings: (b: Json) => patch('/me/settings', b),
      setPin: (pin: string | null) => request('PUT', '/me/pin', { pin }).then((r) => r.data),
      verifyPin: (pin: string) => post<{ valid: boolean }>('/me/pin/verify', { pin }),
      export: () => get('/me/export'),
    },
    months: {
      open: (ym: string) => post(`/months/${ym}/open`),
      copy: (ym: string, target: string, overwrite = false) => post(`/months/${ym}/copy`, { target, overwrite }),
    },
    incomes: { list: (ym: string) => get(`/incomes${qs({ ym })}`), create: (b: Json) => post('/incomes', b), update: (id: string, b: Json) => patch(`/incomes/${id}`, b), remove: (id: string) => del(`/incomes/${id}`) },
    expenses: {
      list: (q: { ym?: string; type?: 'fixed' | 'variable'; q?: string; page?: number; limit?: number } = {}) => request<any[]>('GET', `/expenses${qs(q)}`),
      create: (b: Json) => post('/expenses', b), update: (id: string, b: Json) => patch(`/expenses/${id}`, b), remove: (id: string) => del(`/expenses/${id}`),
    },
    cards: {
      list: () => get('/credit-cards'), get: (id: string) => get(`/credit-cards/${id}`), create: (b: Json) => post('/credit-cards', b), update: (id: string, b: Json) => patch(`/credit-cards/${id}`, b), remove: (id: string) => del(`/credit-cards/${id}`),
      addPurchase: (id: string, b: Json) => post(`/credit-cards/${id}/purchases`, b), removePurchase: (id: string, pid: string) => del(`/credit-cards/${id}/purchases/${pid}`),
    },
    investments: { list: () => get('/investments'), create: (b: Json) => post('/investments', b), update: (id: string, b: Json) => patch(`/investments/${id}`, b), remove: (id: string) => del(`/investments/${id}`) },
    crypto: { list: () => get('/crypto-holdings'), valuation: () => get('/crypto-holdings/valuation'), create: (b: Json) => post('/crypto-holdings', b), update: (id: string, b: Json) => patch(`/crypto-holdings/${id}`, b), remove: (id: string) => del(`/crypto-holdings/${id}`) },
    reports: {
      summary: (ym: string, reserveMonths = 6) => get(`/reports/summary${qs({ ym, reserveMonths })}`),
      yearly: (year: number) => get(`/reports/yearly${qs({ year })}`),
      dues: (ym: string) => get(`/reports/dues${qs({ ym })}`),
      agenda: (months = 3) => get(`/reports/agenda${qs({ months })}`),
    },
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;
