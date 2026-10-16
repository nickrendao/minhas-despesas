'use client';
import { PALETTE, INVESTMENT_TYPES } from '@fin/shared';
import { useState } from 'react';
import { friendlyError } from '@/lib/errors';
import { centsToInput, parseMoneyInput } from '@/lib/money-input';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { Field } from './ui';

export const TYPE_LABELS: Record<string, string> = { tesouro_selic: 'Tesouro Selic', cdb: 'CDB', fundos_di: 'Fundos DI', poupanca: 'Poupança', acoes: 'Ações', fiis: 'Fundos Imobiliários', cripto: 'Criptomoeda', outro: 'Outro' };

function useRun(onClose: () => void) {
  const [busy, setBusy] = useState(false); const [formError, setFormError] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>) { setBusy(true); setFormError(null); try { await fn(); onClose(); } catch (e) { setFormError(friendlyError(e)); } finally { setBusy(false); } }
  return { busy, formError, run };
}
const ErrBox = ({ msg }: { msg: string | null }) => (msg ? <div className="alert-box" role="alert"><Icon name="alert" size={18} />{msg}</div> : null);

export function ConfirmDialog({ title, text, confirmLabel, onConfirm, onClose }: { title: string; text: string; confirmLabel: string; onConfirm: () => Promise<unknown>; onClose: () => void }) {
  const { busy, formError, run } = useRun(onClose);
  return <Dialog title={title} onClose={onClose}><div className="form"><p>{text}</p><ErrBox msg={formError} /><div className="form-actions"><button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn danger" disabled={busy} data-autofocus onClick={() => void run(onConfirm)}>{confirmLabel}</button></div></div></Dialog>;
}

export function CardDialog({ card, onClose, onSave, onDelete }: { card: { name: string; color: string; limitCents: number }; onClose: () => void; onSave: (v: { name: string; color: string; limitCents: number }) => Promise<unknown>; onDelete: () => Promise<unknown> }) {
  const { busy, formError, run } = useRun(onClose); const [name, setName] = useState(card.name); const [limit, setLimit] = useState(centsToInput(card.limitCents)); const [color, setColor] = useState(card.color);
  const [errs, setErrs] = useState<Record<string, string>>({}); const [del, setDel] = useState(false);
  function submit(ev: React.FormEvent) {
    ev.preventDefault(); const e: Record<string, string> = {}; const c = limit.trim() === '' ? 0 : parseMoneyInput(limit);
    if (!name.trim()) e.name = 'Informe um nome.'; if (c === null) e.limit = 'Valor inválido. Exemplo: 5.000,00'; setErrs(e); if (Object.keys(e).length) return;
    void run(() => onSave({ name: name.trim(), color, limitCents: c ?? 0 }));
  }
  return (
    <Dialog title="Editar cartão" onClose={onClose}>
      <form className="form" noValidate onSubmit={submit}>
        <Field label="Nome do cartão" error={errs.name}><input className="input" data-autofocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-invalid={!!errs.name} /></Field>
        <Field label="Limite (R$)" error={errs.limit}><input className="input mono" inputMode="decimal" value={limit} placeholder="0,00" onChange={(e) => setLimit(e.target.value)} aria-invalid={!!errs.limit} /></Field>
        <div className="field"><span className="field-label">Cor</span><div className="swatches" role="group" aria-label="Cor do cartão">{PALETTE.map((c) => <button type="button" key={c} className="sw" aria-label={`Cor ${c}`} aria-pressed={c === color} style={{ background: c }} onClick={() => setColor(c)}>{c === color && <Icon name="check" size={15} stroke={3} />}</button>)}</div></div>
        <ErrBox msg={formError} />
        <div className="form-actions">
          {!del ? <button type="button" className="btn ghost danger-text" onClick={() => setDel(true)}><Icon name="trash" size={17} />Excluir cartão</button> : <button type="button" className="btn danger" disabled={busy} onClick={() => void run(onDelete)}>Confirmar exclusão</button>}
          <button className="btn" disabled={busy}>Salvar</button>
        </div>
      </form>
    </Dialog>
  );
}

export function PurchaseDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (b: { name: string; amountCents: number; installmentCurrent?: number; installmentTotal?: number }) => Promise<unknown> }) {
  const { busy, formError, run } = useRun(onClose); const [name, setName] = useState(''); const [value, setValue] = useState(''); const [cur, setCur] = useState(''); const [tot, setTot] = useState(''); const [errs, setErrs] = useState<Record<string, string>>({});
  function submit(ev: React.FormEvent) {
    ev.preventDefault(); const e: Record<string, string> = {}; const cents = parseMoneyInput(value); const c = cur ? Number(cur) : null, t = tot ? Number(tot) : null;
    if (!cents) e.value = 'Informe um valor maior que zero.';
    if ((c === null) !== (t === null)) e.inst = 'Preencha a parcela atual e o total.'; else if (c && t && (c > t || c < 1 || t > 99)) e.inst = 'Parcela inválida (a atual não pode passar do total).';
    setErrs(e); if (Object.keys(e).length) return;
    void run(() => onAdd({ name: name.trim() || 'Gasto', amountCents: cents!, ...(c && t ? { installmentCurrent: c, installmentTotal: t } : {}) }));
  }
  return (
    <Dialog title="Novo gasto no cartão" onClose={onClose}>
      <form className="form" noValidate onSubmit={submit}>
        <Field label="Nome do gasto"><input className="input" data-autofocus value={name} maxLength={60} placeholder="Ex.: Supermercado" onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Valor (R$)" error={errs.value}><input className="input mono" inputMode="decimal" value={value} placeholder="0,00" onChange={(e) => setValue(e.target.value)} aria-invalid={!!errs.value} /></Field>
        <div className="field"><span className="field-label">Parcela <small className="field-hint">(opcional)</small></span>
          <div className="inst-row"><input className="input mono" aria-label="Parcela atual" inputMode="numeric" value={cur} placeholder="1" onChange={(e) => setCur(e.target.value.replace(/\D/g, '').slice(0, 2))} /><span>de</span><input className="input mono" aria-label="Total de parcelas" inputMode="numeric" value={tot} placeholder="10" onChange={(e) => setTot(e.target.value.replace(/\D/g, '').slice(0, 2))} /></div>
          {errs.inst && <span className="field-error" role="alert">{errs.inst}</span>}</div>
        <ErrBox msg={formError} /><div className="form-actions"><button className="btn" disabled={busy}>Adicionar gasto</button></div>
      </form>
    </Dialog>
  );
}

export function PlanDialog({ plan, onClose, onSave, onDelete }: { plan: { name: string; type: string; targetLimitCents: number; monthlyAmountCents: number }; onClose: () => void; onSave: (v: { name: string; type: string; targetLimitCents: number; monthlyAmountCents: number }) => Promise<unknown>; onDelete: () => Promise<unknown> }) {
  const { busy, formError, run } = useRun(onClose); const [name, setName] = useState(plan.name); const [type, setType] = useState(plan.type); const [target, setTarget] = useState(centsToInput(plan.targetLimitCents)); const [monthly, setMonthly] = useState(centsToInput(plan.monthlyAmountCents));
  const [errs, setErrs] = useState<Record<string, string>>({}); const [del, setDel] = useState(false);
  function submit(ev: React.FormEvent) {
    ev.preventDefault(); const e: Record<string, string> = {}; const t = target.trim() === '' ? 0 : parseMoneyInput(target); const m = monthly.trim() === '' ? 0 : parseMoneyInput(monthly);
    if (!name.trim()) e.name = 'Informe um nome.'; if (t === null) e.target = 'Valor inválido.'; if (m === null) e.monthly = 'Valor inválido.'; setErrs(e); if (Object.keys(e).length) return;
    void run(() => onSave({ name: name.trim(), type, targetLimitCents: t ?? 0, monthlyAmountCents: m ?? 0 }));
  }
  return (
    <Dialog title="Plano de investimento" onClose={onClose}>
      <form className="form" noValidate onSubmit={submit}>
        <Field label="Nome" error={errs.name}><input className="input" data-autofocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-invalid={!!errs.name} /></Field>
        <Field label="Tipo de investimento"><select className="input" value={type} onChange={(e) => setType(e.target.value)}>{INVESTMENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</select></Field>
        <div className="two"><Field label="Objetivo (R$)" error={errs.target}><input className="input mono" inputMode="decimal" value={target} placeholder="0,00" onChange={(e) => setTarget(e.target.value)} aria-invalid={!!errs.target} /></Field>
          <Field label="Por mês (R$)" error={errs.monthly}><input className="input mono" inputMode="decimal" value={monthly} placeholder="0,00" onChange={(e) => setMonthly(e.target.value)} aria-invalid={!!errs.monthly} /></Field></div>
        <ErrBox msg={formError} />
        <div className="form-actions">{!del ? <button type="button" className="btn ghost danger-text" onClick={() => setDel(true)}><Icon name="trash" size={17} />Excluir</button> : <button type="button" className="btn danger" disabled={busy} onClick={() => void run(onDelete)}>Confirmar exclusão</button>}<button className="btn" disabled={busy}>Salvar</button></div>
      </form>
    </Dialog>
  );
}
