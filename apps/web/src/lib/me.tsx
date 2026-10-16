'use client';
import { useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { formatBRL } from '@fin/shared';
import { Dialog } from '@/components/Dialog';
import { useApi } from './api-context';

export interface Settings { displayName: string | null; locale: string; theme: 'light' | 'dark'; timezone: string; monthlyGoalCents: number; privacyMode: boolean; hasPin: boolean; tutorialVersion?: number }
export interface Me { id: string; email: string; settings: Settings; local?: { lastBackupAt: number | null } }

export function useMe() {
  const api = useApi();
  return useQuery<Me>({ queryKey: ['me'], queryFn: () => api.me.get(), staleTime: 60_000 });
}

interface PrivacyCtx { hidden: boolean; toggle: () => void }
const Ctx = createContext<PrivacyCtx>({ hidden: false, toggle: () => undefined });
export const usePrivacy = () => useContext(Ctx);

/** Aplica o tema e controla "ocultar valores" (com PIN opcional para revelar). */
export function PrivacyProvider({ me, children }: { me: Me; children: React.ReactNode }) {
  const api = useApi();
  const [hidden, setHidden] = useState(me.settings.privacyMode);
  const [asking, setAsking] = useState(false); const [pin, setPin] = useState(''); const [pinError, setPinError] = useState(false);
  useEffect(() => { document.documentElement.dataset.theme = me.settings.theme; }, [me.settings.theme]);
  useEffect(() => { setHidden(me.settings.privacyMode); }, [me.settings.privacyMode]);

  const apply = useCallback(async (value: boolean) => { setHidden(value); await api.me.updateSettings({ privacyMode: value }).catch(() => undefined); }, [api]);
  const toggle = useCallback(() => {
    if (!hidden) { void apply(true); return; }
    if (me.settings.hasPin) { setPin(''); setPinError(false); setAsking(true); } else void apply(false);
  }, [hidden, me.settings.hasPin, apply]);

  async function confirmPin(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api.me.verifyPin(pin);
      if (r.valid) { setAsking(false); await apply(false); } else { setPinError(true); setPin(''); }
    } catch { setPinError(true); }
  }
  const value = useMemo(() => ({ hidden, toggle }), [hidden, toggle]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {asking && (
        <Dialog title="Digite seu PIN" onClose={() => setAsking(false)}>
          <form className="form" onSubmit={confirmPin}>
            <p className="muted">Confirme seu PIN para mostrar os valores.</p>
            <input className={`input mono${pinError ? ' bad' : ''}`} type="password" inputMode="numeric" maxLength={6} data-autofocus aria-label="PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
            {pinError && <div className="alert-box" role="alert">PIN incorreto.</div>}
            <div className="form-actions"><button type="button" className="btn ghost" onClick={() => setAsking(false)}>Cancelar</button><button className="btn">Mostrar valores</button></div>
          </form>
        </Dialog>
      )}
    </Ctx.Provider>
  );
}

/** Valor em reais; vira "••••••" quando "ocultar valores" está ativo. */
export function Money({ cents, className }: { cents: number; className?: string }) {
  const { hidden } = usePrivacy();
  return <span className={className}>{hidden ? '••••••' : formatBRL(cents)}</span>;
}
