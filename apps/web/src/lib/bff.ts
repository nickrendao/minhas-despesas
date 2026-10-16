import { clearRefreshCookie, parseCookies, REFRESH_COOKIE, serializeRefreshCookie } from './cookies';

/**
 * BFF (Backend-for-Frontend): o servidor do site conversa com a API e guarda o refresh token num cookie
 * httpOnly. O navegador só recebe o access token (vida curta, 15 min), que fica na memória da página.
 */
const apiUrl = () => process.env.API_URL ?? 'http://localhost:3333/api/v1';
const cookieDays = () => Number(process.env.REFRESH_COOKIE_DAYS ?? 30);
/** Secure em HTTPS, e em produção em qualquer domínio real. Em http://localhost (teste local) não pode ser Secure, senão alguns navegadores descartam o cookie. */
const isSecure = (req: Request) => {
  const u = new URL(req.url);
  if (req.headers.get('x-forwarded-proto') === 'https' || u.protocol === 'https:') return true;
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  return process.env.NODE_ENV === 'production' && !local;
};

const json = (status: number, body: unknown, setCookie?: string) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...(setCookie ? { 'set-cookie': setCookie } : {}) } });

/**
 * Defesa contra CSRF: o POST só é aceito se vier do próprio site. Sinais, do mais forte ao mais fraco:
 *  1) `Origin`, quando existe, é decisivo (inclusive o literal "null", que é recusado);
 *  2) `Sec-Fetch-Site`, enviado por todos os navegadores modernos e impossível de forjar por JavaScript de outro site: só "same-origin" passa;
 *  3) `Referer`, se for do próprio site;
 *  4) sem nenhum sinal, recusa.
 * (Descoberto em teste no Chrome: em chamadas do mesmo site o navegador pode NÃO enviar `Origin`, mas envia Sec-Fetch-Site e Referer.)
 */
export function originAllowed(req: Request): boolean {
  const allowed = new Set<string>([new URL(req.url).origin]);
  for (const o of (process.env.WEB_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)) allowed.add(o);
  const origin = req.headers.get('origin');
  if (origin !== null) return allowed.has(origin);
  const site = req.headers.get('sec-fetch-site');
  if (site !== null) return site === 'same-origin';
  const ref = req.headers.get('referer');
  if (ref) { try { return allowed.has(new URL(ref).origin); } catch { return false; } }
  return false;
}
const forbidden = () => json(403, { error: { code: 'FORBIDDEN_ORIGIN', message: 'Origem não permitida', details: [] } });

async function callApi(path: string, body: unknown, authorization?: string | null) {
  try {
    const res = await fetch(apiUrl() + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) }, body: JSON.stringify(body), cache: 'no-store' });
    return { status: res.status, json: res.status === 204 ? null : await res.json().catch(() => null) };
  } catch {
    return { status: 502, json: { error: { code: 'API_UNAVAILABLE', message: 'Serviço indisponível. Tente novamente.', details: [] } } };
  }
}

export async function handleLogin(req: Request): Promise<Response> {
  if (!originAllowed(req)) return forbidden();
  const body = await req.json().catch(() => ({}));
  const r = await callApi('/auth/login', body);
  if (r.status !== 200) return json(r.status, r.json);
  const { accessToken, refreshToken, expiresIn } = r.json.data;
  return json(200, { data: { accessToken, expiresIn } }, serializeRefreshCookie(refreshToken, { secure: isSecure(req), maxAgeSeconds: cookieDays() * 86400 }));
}

export async function handleRefresh(req: Request): Promise<Response> {
  if (!originAllowed(req)) return forbidden();
  const rt = parseCookies(req.headers.get('cookie'))[REFRESH_COOKIE];
  if (!rt) return json(401, { error: { code: 'NO_SESSION', message: 'Sem sessão', details: [] } });
  const r = await callApi('/auth/refresh', { refreshToken: rt });
  if (r.status !== 200) return json(r.status === 502 ? 502 : 401, r.json ?? { error: { code: 'NO_SESSION', message: 'Sessão expirada', details: [] } }, r.status === 502 ? undefined : clearRefreshCookie(isSecure(req)));
  const { accessToken, refreshToken, expiresIn } = r.json.data;
  return json(200, { data: { accessToken, expiresIn } }, serializeRefreshCookie(refreshToken, { secure: isSecure(req), maxAgeSeconds: cookieDays() * 86400 }));
}

export async function handleLogout(req: Request): Promise<Response> {
  if (!originAllowed(req)) return forbidden();
  const rt = parseCookies(req.headers.get('cookie'))[REFRESH_COOKIE];
  if (rt) await callApi('/auth/logout', { refreshToken: rt });
  return new Response(null, { status: 204, headers: { 'set-cookie': clearRefreshCookie(isSecure(req)), 'cache-control': 'no-store' } });
}

/**
 * Trocar senha: a API revoga todas as sessões e devolve uma NOVA. O cookie precisa ser trocado aqui, no servidor —
 * se o navegador ficasse com o refresh token antigo (já revogado), o usuário seria deslogado na próxima renovação.
 */
export async function handleChangePassword(req: Request): Promise<Response> {
  if (!originAllowed(req)) return forbidden();
  const auth = req.headers.get('authorization');
  if (!auth) return json(401, { error: { code: 'MISSING_TOKEN', message: 'Autenticação necessária', details: [] } });
  const r = await callApi('/auth/change-password', await req.json().catch(() => ({})), auth);
  if (r.status !== 200) return json(r.status, r.json);
  const { accessToken, refreshToken, expiresIn } = r.json.data;
  return json(200, { data: { accessToken, expiresIn } }, serializeRefreshCookie(refreshToken, { secure: isSecure(req), maxAgeSeconds: cookieDays() * 86400 }));
}

export async function handleDeleteAccount(req: Request): Promise<Response> {
  if (!originAllowed(req)) return forbidden();
  const auth = req.headers.get('authorization');
  if (!auth) return json(401, { error: { code: 'MISSING_TOKEN', message: 'Autenticação necessária', details: [] } });
  const r = await callApi('/auth/delete-account', await req.json().catch(() => ({})), auth);
  if (r.status !== 204) return json(r.status, r.json);
  return new Response(null, { status: 204, headers: { 'set-cookie': clearRefreshCookie(isSecure(req)), 'cache-control': 'no-store' } });
}
