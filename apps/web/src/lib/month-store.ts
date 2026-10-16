import { useSyncExternalStore } from 'react';
import { currentYm } from './months';
/** Mês selecionado, compartilhado entre telas (a busca, por exemplo, leva você até o mês do resultado). */
const deviceTz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; } })();
let ym = currentYm(deviceTz); const subs = new Set<() => void>();
export const getSelectedYm = () => ym;
export function setSelectedYm(v: string) { if (v !== ym) { ym = v; subs.forEach((f) => f()); } }
export const useSelectedYm = () => [useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, getSelectedYm, getSelectedYm), setSelectedYm] as const;
