'use client';
import { useState } from 'react';
import { friendlyError } from '@/lib/errors';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

const MAX_BACKUP_BYTES = 6 * 1024 * 1024;
/** File.text() não existe em WebViews mais antigos: nesse caso lê com FileReader. */
const readText = (f: File): Promise<string> => (typeof f.text === 'function' ? f.text() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(f); }));

/** Restaurar um backup (.json) no app local. Aceita escolher o arquivo OU colar o texto (se o seletor de arquivos do aparelho falhar). */
export function RestoreDialog({ onClose, onRestore }: { onClose: () => void; onRestore: (json: unknown) => Promise<void> }) {
  const [text, setText] = useState(''); const [fileName, setFileName] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return; setError(null);
    if (f.size > MAX_BACKUP_BYTES) { setError('Arquivo grande demais para ser um backup do app.'); return; }
    try { setText(await readText(f)); setFileName(f.name); } catch { setError('Não foi possível ler o arquivo.'); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null); let json: unknown;
    try { json = JSON.parse(text); } catch { setError('Este arquivo não é um backup válido (não é JSON).'); return; }
    setBusy(true); try { await onRestore(json); onClose(); } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }
  return (
    <Dialog title="Restaurar backup" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <div className="alert-box"><Icon name="alert" size={18} /><span>Isto <b>substitui todos os dados atuais</b> deste aparelho pelos do backup.</span></div>
        <label className="field"><span className="field-label">Arquivo de backup (.json)</span><input className="input file" type="file" accept=".json,application/json" aria-label="Arquivo de backup" onChange={pick} /></label>
        {fileName && <p className="muted">Arquivo lido: <b>{fileName}</b></p>}
        <label className="field"><span className="field-label">Ou cole aqui o conteúdo do backup</span><textarea className="input area" aria-label="Conteúdo do backup" value={text} onChange={(e) => setText(e.target.value)} rows={4} spellCheck={false} /></label>
        {error && <div className="alert-box" role="alert"><Icon name="alert" size={18} />{error}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn danger" disabled={busy || !text.trim()}>{busy ? 'Restaurando…' : 'Restaurar'}</button></div>
      </form>
    </Dialog>
  );
}
