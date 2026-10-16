/**
 * Dados de contato e apoio. NADA pessoal fica no código: tudo vem de variáveis de ambiente em tempo de build
 * (NEXT_PUBLIC_*). Vazio = o recurso correspondente não aparece (ex.: sem chave Pix, não há bloco de doação).
 */
const v = (x: string | undefined) => (x ?? '').trim();
export const PIX_KEY = v(process.env.NEXT_PUBLIC_PIX_KEY);
export const PIX_KEY_DISPLAY = v(process.env.NEXT_PUBLIC_PIX_KEY_DISPLAY) || PIX_KEY;
export const FEEDBACK_EMAIL = v(process.env.NEXT_PUBLIC_FEEDBACK_EMAIL);
export const PRIVACY_URL = v(process.env.NEXT_PUBLIC_PRIVACY_URL);
export const SOURCE_URL = v(process.env.NEXT_PUBLIC_SOURCE_URL);
export const APP_VERSION = v(process.env.NEXT_PUBLIC_APP_VERSION) || '4.0.0-alpha';
