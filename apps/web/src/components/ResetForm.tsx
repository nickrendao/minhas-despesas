'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useApi } from '@/lib/api-context';
import { friendlyError } from '@/lib/errors';
import { AuthShell } from './AuthShell';
import { Icon } from './Icon';
import { Field } from './ui';

export function ResetForm({ token }: { token: string }) {
  const api = useApi(); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [done, setDone] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    try { await api.auth.resetPassword(token, password); setDone(true); } catch (e2) { setError(friendlyError(e2)); }
  }
  return (
    <AuthShell title="Nova senha">
      {error && <div className="alert-box" role="alert"><Icon name="alert" size={18} />{error}</div>}
      {done ? <div className="ok-box" role="status"><Icon name="check" size={18} />Senha alterada! <Link className="link" href="/login">Entrar</Link></div> : (
        <form onSubmit={submit} className="form">
          <Field label="Nova senha"><input className="input" type="password" autoComplete="new-password" placeholder="mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
          <Field label="Confirmar senha"><input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></Field>
          <button className="btn block">Salvar nova senha</button></form>)}
    </AuthShell>
  );
}
