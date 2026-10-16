'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { setAuthLostHandler } from '@/lib/web-api';
import { PrivacyProvider, useMe } from '@/lib/me';

/** Só mostra o app se houver sessão. Sem sessão => /login. Restaura a sessão pelo cookie (renovação automática do cliente). */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const me = useMe();
  useEffect(() => { setAuthLostHandler(() => router.replace('/login')); return () => setAuthLostHandler(undefined); }, [router]);
  useEffect(() => { if (me.isError) router.replace('/login'); }, [me.isError, router]);
  if (!me.data) return <div className="wrap" aria-busy="true"><div className="skeleton" /><div className="skeleton" /></div>;
  return <PrivacyProvider me={me.data}>{children}</PrivacyProvider>;
}
