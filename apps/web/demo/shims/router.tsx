import { useSyncExternalStore } from 'react';
/** Roteador por "#" (funciona abrindo o arquivo direto, sem servidor). Substitui next/navigation e next/link na prévia. */
const subscribe = (cb: () => void) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb); };
export const currentPath = () => (location.hash.replace(/^#/, '') || '/mensal').split('?')[0];
export function usePathname() { return useSyncExternalStore(subscribe, currentPath, () => '/mensal'); }
export function useRouter() { return { replace: (p: string) => { location.hash = p; }, push: (p: string) => { location.hash = p; }, back: () => history.back(), refresh: () => undefined }; }
