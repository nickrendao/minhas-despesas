'use client';
import { useEffect, useRef, useState } from 'react';
import { useApi } from '@/lib/api-context';
import { friendlyError } from '@/lib/errors';

import Link from 'next/link';
import { AuthShell } from './AuthShell';
import { Icon } from './Icon';

export function VerifyEmail({ token }: { token: string }) {
  const api = useApi(); const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading'); const [msg, setMsg] = useState(''); const started = useRef(false);
  useEffect(() => {
    if (started.current) return; started.current = true;     // o link é de uso único: não pode ser consumido duas vezes (StrictMode)
    api.auth.verifyEmail(token).then(() => setState('ok')).catch((e) => { setMsg(friendlyError(e)); setState('error'); });
  }, [api, token]);
  return (
    <AuthShell title="Confirmação de e-mail">
      {state === 'loading' && <p className="muted" aria-busy="true">Confirmando…</p>}
      {state === 'ok' && <div className="ok-box" role="status"><Icon name="check" size={18} />E-mail confirmado! <Link className="link" href="/login">Entrar</Link></div>}
      {state === 'error' && <div className="alert-box" role="alert"><Icon name="alert" size={18} />{msg}</div>}
    </AuthShell>
  );
}
