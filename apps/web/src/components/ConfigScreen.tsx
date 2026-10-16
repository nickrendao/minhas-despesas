'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApi } from '@/lib/api-context';
import { useAppMode } from '@/lib/app-mode';
import { friendlyError } from '@/lib/errors';
import { download } from '@/lib/exports';
import { useMe } from '@/lib/me';
import { webChangePassword, webDeleteAccount, webLogout } from '@/lib/web-api';
import { PageHead, useShell } from './AppShell';
import { Icon } from './Icon';
import { RestoreDialog } from './LocalDataDialogs';
import { ConfirmDialog } from './MoreDialogs';
import { Field, Segmented, Skeleton } from './ui';

interface Props { onLogout?: () => Promise<void>; changePassword?: (c: string, n: string) => Promise<void>; deleteAccount?: (p: string) => Promise<void> }

export function ConfigScreen({ onLogout = webLogout, changePassword = webChangePassword, deleteAccount = webDeleteAccount }: Props) {
  const api = useApi(); const qc = useQueryClient(); const router = useRouter(); const me = useMe(); const shell = useShell(); const mode = useAppMode();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const ok = (text: string) => setMsg({ kind: 'ok', text }); const fail = (e: unknown) => setMsg({ kind: 'error', text: friendlyError(e) });
  const refreshMe = () => qc.invalidateQueries({ queryKey: ['me'] });
  const save = async (patch: Record<string, unknown>, done?: string) => { try { await api.me.updateSettings(patch); await refreshMe(); if (done) ok(done); } catch (e) { fail(e); } };
  const [curPin, setCurPin] = useState(''); const [newPin, setNewPin] = useState('');
  const [cp, setCp] = useState(''); const [np, setNp] = useState(''); const [cf, setCf] = useState('');
  const [delOpen, setDelOpen] = useState(false); const [delPw, setDelPw] = useState('');
  const [dlg, setDlg] = useState<null | 'restore' | 'reset'>(null);
  if (!me.data) return <><PageHead title="Configurações" /><Skeleton h={180} n={2} /></>;
  const s = me.data.settings; const lastBackup = me.data.local?.lastBackupAt ?? null;

  async function setPin(pin: string | null) {
    try { if (s.hasPin) { const v = await api.me.verifyPin(curPin); if (!v.valid) { setMsg({ kind: 'error', text: 'PIN atual incorreto.' }); return; } }
      await api.me.setPin(pin); setCurPin(''); setNewPin(''); await refreshMe(); ok(pin ? 'PIN salvo.' : 'PIN removido.'); } catch (e) { fail(e); }
  }
  async function submitPassword(e: React.FormEvent) {
    e.preventDefault(); if (np !== cf) { setMsg({ kind: 'error', text: 'As senhas novas não coincidem.' }); return; }
    try { await changePassword(cp, np); setCp(''); setNp(''); setCf(''); ok('Senha alterada. Suas outras sessões foram encerradas.'); } catch (e2) { fail(e2); }
  }
  async function exportJson() { try { const d = await api.me.export(); download('minhas-despesas-backup.json', JSON.stringify(d, null, 2), 'application/json'); await refreshMe(); ok('Backup baixado.'); } catch (e) { fail(e); } }
  async function logout() { await onLogout(); qc.clear(); router.replace('/login'); }
  async function removeAccount(e: React.FormEvent) { e.preventDefault(); try { await deleteAccount(delPw); qc.clear(); router.replace('/login'); } catch (e2) { fail(e2); } }
  const when = (t: number) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="config">
      <PageHead title="Configurações" eyebrow={mode.local ? 'Seus dados ficam só neste aparelho.' : me.data.email} />
      {msg && <div className={msg.kind === 'ok' ? 'ok-box' : 'alert-box'} role={msg.kind === 'ok' ? 'status' : 'alert'}><Icon name={msg.kind === 'ok' ? 'check' : 'alert'} size={18} />{msg.text}</div>}
      <div className="config-grid">
        <section className="card" aria-label="Perfil"><header className="card-head"><h2>Perfil e aparência</h2></header>
          <div className="form">
            <Field label="Como quer ser chamado"><input className="input" aria-label="Nome de exibição" defaultValue={s.displayName ?? ''} maxLength={30} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (s.displayName ?? '')) void save({ displayName: v || null }, 'Nome salvo.'); }} /></Field>
            <Field label="Idioma" hint="A preferência é salva, mas as telas ainda estão só em português."><select className="input" aria-label="Idioma" value={s.locale} onChange={(e) => void save({ locale: e.target.value })}><option value="pt">Português</option><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option></select></Field>
            <div className="field"><span className="field-label">Tema</span><Segmented label="Tema" value={s.theme} onChange={(theme) => void save({ theme })} options={[{ v: 'light', label: 'Claro' }, { v: 'dark', label: 'Escuro' }]} /></div>
          </div></section>
        <section className="card" aria-label="Privacidade"><header className="card-head"><h2>Privacidade</h2></header>
          <p className="muted">O botão de olho no topo oculta valores na tela. O PIN é opcional e serve para mostrá-los de novo. É uma trava contra “olhadas”, <b>não</b> substitui a senha do aparelho{mode.local ? '' : ' nem a senha da conta'}.</p>
          <div className="form" style={{ marginTop: 14 }}>
            {s.hasPin && <Field label="PIN atual"><input className="input mono" type="password" inputMode="numeric" maxLength={6} aria-label="PIN atual" value={curPin} onChange={(e) => setCurPin(e.target.value.replace(/\D/g, ''))} /></Field>}
            <Field label={s.hasPin ? 'Novo PIN (4 a 6 números)' : 'Definir PIN (4 a 6 números)'}><input className="input mono" type="password" inputMode="numeric" maxLength={6} aria-label="Novo PIN" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} /></Field>
            <div className="form-actions">{s.hasPin && <button className="btn ghost" onClick={() => setPin(null)}>Remover PIN</button>}<button className="btn" disabled={newPin.length < 4} onClick={() => setPin(newPin)}>Salvar PIN</button></div>
          </div></section>
        {!mode.local && (
          <section className="card" aria-label="Segurança"><header className="card-head"><h2>Segurança</h2></header>
            <form onSubmit={submitPassword} className="form">
              <Field label="Senha atual"><input className="input" type="password" autoComplete="current-password" value={cp} onChange={(e) => setCp(e.target.value)} required /></Field>
              <Field label="Nova senha"><input className="input" type="password" autoComplete="new-password" placeholder="mínimo 6 caracteres" value={np} onChange={(e) => setNp(e.target.value)} required /></Field>
              <Field label="Confirmar nova senha"><input className="input" type="password" autoComplete="new-password" value={cf} onChange={(e) => setCf(e.target.value)} required /></Field>
              <div className="form-actions"><button type="button" className="btn ghost" onClick={logout}><Icon name="logout" size={17} />Sair da conta</button><button className="btn">Alterar senha</button></div>
            </form></section>)}
        <section className="card" aria-label="Ajuda"><header className="card-head"><h2>Ajuda</h2></header>
          <p className="muted">Quer rever como o app funciona? O tutorial mostra, em poucos passos, rendas, despesas, cartões e privacidade.</p>
          <div className="form" style={{ marginTop: 14 }}><button className="btn ghost" onClick={shell.openTutorial}><Icon name="help" size={17} />Rever o tutorial</button></div></section>
        {mode.local ? (
          <section className="card" aria-label="Seus dados"><header className="card-head"><h2>Seus dados e backup</h2></header>
            <p className="muted">Tudo o que você registra fica guardado <b>só neste aparelho</b>. Se desinstalar o app, limpar os dados dele ou trocar de celular, é o <b>backup</b> que recupera tudo. Baixe um de vez em quando.</p>
            <p className="muted" data-testid="last-backup" style={{ marginTop: 8 }}>Último backup: <b>{lastBackup ? when(lastBackup) : 'ainda não feito'}</b></p>
            <div className="form" style={{ marginTop: 14 }}>
              <button className="btn" onClick={exportJson}><Icon name="download" size={17} />Baixar backup completo</button>
              <button className="btn ghost" onClick={() => setDlg('restore')}><Icon name="up" size={17} />Restaurar backup</button>
              <button className="btn ghost danger-text" onClick={() => setDlg('reset')}><Icon name="trash" size={17} />Apagar todos os dados</button>
            </div></section>
        ) : (
          <section className="card" aria-label="Seus dados"><header className="card-head"><h2>Seus dados</h2></header>
            <p className="muted">Baixe uma cópia de tudo que você registrou, ou apague sua conta de forma permanente.</p>
            <div className="form" style={{ marginTop: 14 }}>
              <button className="btn ghost" onClick={exportJson}><Icon name="download" size={17} />Baixar backup completo (JSON)</button>
              {!delOpen ? <button className="btn ghost danger-text" onClick={() => setDelOpen(true)}><Icon name="trash" size={17} />Excluir minha conta e todos os dados</button> : (
                <form onSubmit={removeAccount} className="form"><div className="alert-box"><Icon name="alert" size={18} />Isso apaga TODOS os seus dados de forma permanente. Confirme com sua senha.</div>
                  <Field label="Senha"><input className="input" type="password" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} required /></Field>
                  <div className="form-actions"><button type="button" className="btn ghost" onClick={() => setDelOpen(false)}>Cancelar</button><button className="btn danger">Excluir definitivamente</button></div></form>)}
            </div></section>)}
      </div>
      {dlg === 'restore' && <RestoreDialog onClose={() => setDlg(null)} onRestore={async (json) => { await mode.importBackup!(json); await qc.invalidateQueries(); shell.toast('Backup restaurado.'); }} />}
      {dlg === 'reset' && <ConfirmDialog title="Apagar todos os dados?" text="Isso apaga rendas, despesas, cartões, investimentos e configurações DESTE aparelho. Não dá para desfazer. Se quiser guardar algo, baixe um backup antes." confirmLabel="Apagar tudo" onClose={() => setDlg(null)} onConfirm={async () => { await mode.resetAll!(); qc.clear(); window.location.hash = '#/mensal'; window.location.reload(); }} />}
    </div>
  );
}
