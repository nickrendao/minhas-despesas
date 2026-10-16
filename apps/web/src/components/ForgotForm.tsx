'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useApi } from '@/lib/api-context';
import { friendlyError } from '@/lib/errors';
import { AuthShell } from './AuthShell';
import { Icon } from './Icon';
import { Field } from './ui';

export function ForgotForm() {
  const api = useApi(); const [email, setEmail] = useState(''); const [done, setDone] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) { e.preventDefault(); setError(null); try { await api.auth.forgotPassword(email.trim()); setDone(true); } catch (err) { setError(friendlyError(err)); } }
  return (
    <AuthShell title="Recuperar senha" subtitle="Informe seu e-mail e enviaremos um link para criar uma nova senha.">
      {error && <div className="alert-box" role="alert"><Icon name="alert" size={18} />{error}</div>}
      {done ? <div className="ok-box" role="status"><Icon name="check" size={18} />Se o e-mail estiver cadastrado, enviamos as instruções.</div> : (
        <form onSubmit={submit} className="form"><Field label="E-mail"><input className="input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field><button className="btn block">Enviar link</button></form>)}
      <p className="center"><Link className="link" href="/login">Voltar ao login</Link></p>
    </AuthShell>
  );
}
