'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApi } from '@/lib/api-context';
import { friendlyError } from '@/lib/errors';
import { webLogin } from '@/lib/web-api';
import { BrandMark } from './BrandMark';
import { Icon } from './Icon';
import { Field } from './ui';

export function LoginForm({ login = webLogin }: { login?: (email: string, password: string) => Promise<void> }) {
  const api = useApi(); const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null); const [info, setInfo] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setInfo(null);
    if (mode === 'signup' && password !== confirm) { setError('As senhas não coincidem. Digite a mesma senha nos dois campos.'); return; }
    setBusy(true);
    try {
      if (mode === 'signin') { await login(email.trim(), password); router.replace('/mensal'); }
      else {
        const r = await api.auth.register(email.trim(), password);
        setInfo(r.requiresEmailVerification ? 'Conta criada! Enviamos um link de confirmação para o seu e-mail.' : 'Conta criada! Agora é só entrar.');
        setMode('signin'); setPassword(''); setConfirm('');
      }
    } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }
  return (
    <main className="auth-page">
      <section className="auth-hero">
        <div className="ah-brand"><BrandMark size={40} /><span>Minhas Despesas</span></div>
        <div className="ah-copy">
          <h1>Seu dinheiro,<br /><em>sem complicação.</em></h1>
          <p>Despesas, cartões e metas num só lugar. Simples, rápido e sempre grátis.</p>
          <ul className="ah-chips"><li><Icon name="lock" size={15} />Dados protegidos</li><li><Icon name="phone" size={15} />Feito pro celular</li><li><Icon name="check" size={15} />Grátis</li></ul>
        </div>
      </section>
      <section className="auth-card" aria-label="Acesso">
        <div className="segmented tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'signin'} onClick={() => { setMode('signin'); setError(null); }}>Entrar</button>
          <button role="tab" aria-selected={mode === 'signup'} onClick={() => { setMode('signup'); setError(null); }}>Criar conta</button>
        </div>
        {error && <div className="alert-box" role="alert"><Icon name="alert" size={18} />{error}</div>}
        {info && <div className="ok-box" role="status"><Icon name="check" size={18} />{info}</div>}
        <form onSubmit={submit} noValidate className="form">
          <Field label="E-mail"><input className="input" type="email" autoComplete="email" inputMode="email" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Field label="Senha"><input className="input" type={show ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder={mode === 'signup' ? 'mínimo 6 caracteres' : 'Sua senha'} />
            <button type="button" className="pw-eye" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={show} onClick={() => setShow((v) => !v)}><Icon name={show ? 'eyeOff' : 'eye'} size={18} /></button></Field>
          {mode === 'signup' && <Field label="Confirmar senha"><input className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></Field>}
          <button className="btn block" disabled={busy}>{busy ? 'Aguarde…' : mode === 'signin' ? 'Entrar' : 'Criar conta'}{!busy && <Icon name="right" size={18} stroke={2.4} />}</button>
        </form>
        {mode === 'signin' && <p className="center"><Link className="link" href="/forgot-password">Esqueci minha senha</Link></p>}
      </section>
    </main>
  );
}
