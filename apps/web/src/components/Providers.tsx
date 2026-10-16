'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiContext } from '@/lib/api-context';
import { webApi } from '@/lib/web-api';

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } } }));
  return <QueryClientProvider client={qc}><ApiContext.Provider value={webApi}>{children}</ApiContext.Provider></QueryClientProvider>;
}
