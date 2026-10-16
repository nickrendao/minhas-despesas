import type { QueryClient } from '@tanstack/react-query';
/** Depois de qualquer alteração financeira, tudo que depende dos lançamentos é recarregado. */
const MONEY = new Set(['month', 'summary', 'agenda', 'yearly', 'dues', 'search', 'cards']);
export const invalidateMoney = (qc: QueryClient) => qc.invalidateQueries({ predicate: (q) => MONEY.has(String(q.queryKey[0])) });
