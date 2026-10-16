'use client';
import { useQueryClient } from '@tanstack/react-query';
import { PALETTE } from '@fin/shared';
import { useState } from 'react';
import { useApi } from '@/lib/api-context';
import { friendlyError } from '@/lib/errors';
import { invalidateMoney } from '@/lib/queries';
import { centsToInput, parseMoneyInput } from '@/lib/money-input';
import { monthLabel } from '@/lib/months';
import { expenseIcon, iconLabel } from '@/lib/expense-icon';
import { Dialog } from './Dialog';
import { EXPENSE_ICONS, Icon } from './Icon';
import { Field, Segmented, Switch, Tile } from './ui';

export interface ExpenseLike { id: string; name: string; amountCents: number; recurring: boolean; dueDay: number | null; installmentCurrent?: number | null; installmentTotal?: number | null; icon?: string; color?: string }
export interface IncomeLike { id: string; name: string; amountCents: number; recurring: boolean; isPrimary?: boolean }
const DEFAULT_COLOR = PALETTE[3];
type Errs = Record<string, string>;

function useSave(onClose: () => void, onDone?: (msg: string) => void) {
  const qc = useQueryClient(); const [busy, setBusy] = useState(false); const [formError, setFormError] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>, doneMsg: string) {
    setBusy(true); setFormError(null);
    try { await fn(); await invalidateMoney(qc); onDone?.(doneMsg); onClose(); } catch (e) { setFormError(friendlyError(e)); } finally { setBusy(false); }
  }
  return { busy, formError, run };
}

/** Criar ou editar uma despesa. Mesmo formulário nos dois casos (consistência) — folha no celular, janela no desktop. */
export function ExpenseDialog({ ym, expense, onClose, onDone }: { ym: string; expense?: ExpenseLike; onClose: () => void; onDone?: (msg: string) => void }) {
  const api = useApi(); const edit = !!expense; const { busy, formError, run } = useSave(onClose, onDone);
  const [name, setName] = useState(expense?.name ?? ''); const [value, setValue] = useState(centsToInput(expense?.amountCents ?? 0));
  const [kind, setKind] = useState<'fixed' | 'variable'>(expense?.recurring ? 'fixed' : 'variable'); const [due, setDue] = useState(expense?.dueDay ? String(expense.dueDay) : '');
  const [cur, setCur] = useState(expense?.installmentCurrent ? String(expense.installmentCurrent) : ''); const [tot, setTot] = useState(expense?.installmentTotal ? String(expense.installmentTotal) : '');
  const [errs, setErrs] = useState<Errs>({}); const [confirmDel, setConfirmDel] = useState(false);
  const originalIcon = expenseIcon(expense?.icon); const [icon, setIcon] = useState(originalIcon); const [tint, setTint] = useState(expense?.color ?? DEFAULT_COLOR); const [pickOpen, setPickOpen] = useState(false);

  function validate() {
    const e: Errs = {}; const cents = value.trim() === '' ? 0 : parseMoneyInput(value);
    if (!name.trim()) e.name = 'Informe um nome.'; else if (name.trim().length > 60) e.name = 'No máximo 60 caracteres.';
    if (cents === null) e.value = 'Valor inválido. Exemplo: 1.234,56';
    const d = due.trim() === '' ? null : Number(due); if (d !== null && (!Number.isInteger(d) || d < 1 || d > 31)) e.due = 'Use um dia de 1 a 31.';
    const c = cur.trim() === '' ? null : Number(cur), t = tot.trim() === '' ? null : Number(tot);
    if ((c === null) !== (t === null)) e.inst = 'Preencha a parcela atual e o total.';
    else if (c !== null && t !== null && (!Number.isInteger(c) || !Number.isInteger(t) || c < 1 || t < 1 || t > 99 || c > t)) e.inst = 'A parcela atual não pode passar do total (máx. 99).';
    setErrs(e); return Object.keys(e).length ? null : { cents: cents ?? 0, d, c, t };
  }
  function submit(ev: React.FormEvent) {
    ev.preventDefault(); const v = validate(); if (!v) return;
    const body = { name: name.trim(), amountCents: v.cents, recurring: kind === 'fixed' };
    if (!edit) return run(async () => { await api.months.open(ym); await api.expenses.create({ ...body, ym, icon, color: tint, ...(v.d ? { dueDay: v.d } : {}), ...(v.c && v.t ? { installmentCurrent: v.c, installmentTotal: v.t } : {}) }); }, 'Despesa adicionada.');
    // ícone e cor só vão se a pessoa mudou (não troca silenciosamente o emoji antigo por ícone novo)
    return run(() => api.expenses.update(expense!.id, { ...body, dueDay: v.d, installmentCurrent: v.c, installmentTotal: v.t, ...(icon !== originalIcon ? { icon } : {}), ...(tint !== expense!.color ? { color: tint } : {}) }), 'Despesa atualizada.');
  }
  return (
    <Dialog title={edit ? 'Editar despesa' : 'Nova despesa'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="form">
        {!edit && <p className="muted">Será lançada em <b>{monthLabel(ym)}</b>.</p>}
        <Field label="Nome" error={errs.name}><input className="input" data-autofocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex.: Aluguel" aria-invalid={!!errs.name} /></Field>
        <Field label="Valor (R$)" error={errs.value}><input className="input mono" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" aria-invalid={!!errs.value} /></Field>
        <div className="field"><span className="field-label">Tipo</span><Segmented label="Tipo" value={kind} onChange={setKind} options={[{ v: 'fixed', label: 'Fixa (repete todo mês)' }, { v: 'variable', label: 'Variável' }]} /></div>
        <div className="field"><span className="field-label">Ícone e cor</span>
          <button type="button" className="icon-pick" aria-expanded={pickOpen} aria-controls="icon-panel" onClick={() => setPickOpen((v) => !v)}>
            <Tile name={icon} color={tint} /><span><b>{iconLabel(icon)}</b><small>{pickOpen ? 'Escolha abaixo' : 'Toque para trocar o ícone e a cor'}</small></span><Icon name="down" size={16} />
          </button>
          {pickOpen && (
            <div id="icon-panel" className="picker-panel">
              <div className="icon-grid" role="group" aria-label="Ícone">{EXPENSE_ICONS.map((i) => (
                <button type="button" key={i.id} className="ig" style={{ ['--c' as any]: tint }} aria-pressed={i.id === icon} aria-label={i.label} title={i.label} onClick={() => setIcon(i.id)}><Icon name={i.id} size={20} /></button>))}</div>
              <div className="swatches" role="group" aria-label="Cor">{PALETTE.map((c) => <button type="button" key={c} className="sw" aria-label={`Cor ${c}`} aria-pressed={c === tint} style={{ background: c }} onClick={() => setTint(c)}>{c === tint && <Icon name="check" size={15} stroke={3} />}</button>)}</div>
            </div>)}
        </div>
        <div className="two">
          <Field label="Vence no dia" error={errs.due} hint="Opcional"><input className="input mono" inputMode="numeric" value={due} onChange={(e) => setDue(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="--" aria-invalid={!!errs.due} /></Field>
          <div className="field"><span className="field-label">Parcela</span>
            <div className="inst-row"><input className="input mono" aria-label="Parcela atual" inputMode="numeric" value={cur} onChange={(e) => setCur(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="1" /><span>de</span><input className="input mono" aria-label="Total de parcelas" inputMode="numeric" value={tot} onChange={(e) => setTot(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="10" /></div>
            {errs.inst ? <span className="field-error" role="alert">{errs.inst}</span> : <span className="field-hint">Opcional</span>}</div>
        </div>
        {formError && <div className="alert-box" role="alert"><Icon name="alert" size={18} />{formError}</div>}
        <div className="form-actions">
          {edit && (!confirmDel ? <button type="button" className="btn ghost danger-text" onClick={() => setConfirmDel(true)}><Icon name="trash" size={17} />Excluir</button>
            : <button type="button" className="btn danger" disabled={busy} onClick={() => run(() => api.expenses.remove(expense!.id), 'Despesa excluída.')}>Confirmar exclusão</button>)}
          <button className="btn" disabled={busy}>{busy ? 'Salvando…' : edit ? 'Salvar' : 'Adicionar'}</button>
        </div>
      </form>
    </Dialog>
  );
}

/** `incomeCount` = quantas rendas o mês já tem (a primeira renda do mês vira principal sozinha). */
export function IncomeDialog({ ym, income, incomeCount = 0, onClose, onDone }: { ym: string; income?: IncomeLike; incomeCount?: number; onClose: () => void; onDone?: (msg: string) => void }) {
  const api = useApi(); const edit = !!income; const { busy, formError, run } = useSave(onClose, onDone);
  const [name, setName] = useState(income?.name ?? ''); const [value, setValue] = useState(centsToInput(income?.amountCents ?? 0)); const [rec, setRec] = useState(income?.recurring ?? false);
  const locked = edit ? !!income?.isPrimary : incomeCount === 0;   // a atual principal não se "desmarca"; a 1ª renda do mês já nasce principal
  const [primary, setPrimary] = useState(locked ? true : false);
  const [errs, setErrs] = useState<Errs>({}); const [confirmDel, setConfirmDel] = useState(false);
  function submit(ev: React.FormEvent) {
    ev.preventDefault(); const e: Errs = {}; const cents = value.trim() === '' ? 0 : parseMoneyInput(value);
    if (!name.trim()) e.name = 'Informe um nome.'; if (cents === null) e.value = 'Valor inválido. Exemplo: 5.000,00'; setErrs(e); if (Object.keys(e).length) return;
    const body = { name: name.trim().slice(0, 24), amountCents: cents ?? 0, recurring: rec, ...(primary && !locked ? { isPrimary: true } : {}) };
    return edit ? run(() => api.incomes.update(income!.id, body), 'Renda atualizada.') : run(async () => { await api.months.open(ym); await api.incomes.create({ ...body, ym }); }, 'Renda adicionada.');
  }
  return (
    <Dialog title={edit ? 'Editar renda' : 'Nova renda'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="form">
        <Field label="Nome" error={errs.name}><input className="input" data-autofocus value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Ex.: Salário" aria-invalid={!!errs.name} /></Field>
        <Field label="Valor (R$)" error={errs.value}><input className="input mono" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" aria-invalid={!!errs.value} /></Field>
        <div className="switch-row"><span><b>Repetir todo mês</b><small>Copia esta renda para o mês seguinte automaticamente.</small></span><Switch checked={rec} onChange={setRec} label="Repetir todo mês" /></div>
        <div className={`switch-row${locked ? ' locked' : ''}`}><span><b>Renda principal</b><small>{locked ? (edit ? 'Esta é a principal. Para trocar, marque outra renda como principal.' : 'É a primeira renda do mês, então já será a principal.') : 'Ela passa a ser a principal e a atual deixa de ser.'}</small></span>
          <Switch checked={primary} onChange={(v) => { if (!locked) setPrimary(v); }} label="Renda principal" disabled={locked} /></div>
        {formError && <div className="alert-box" role="alert"><Icon name="alert" size={18} />{formError}</div>}
        <div className="form-actions">
          {edit && (!confirmDel ? <button type="button" className="btn ghost danger-text" onClick={() => setConfirmDel(true)}><Icon name="trash" size={17} />Excluir</button>
            : <button type="button" className="btn danger" disabled={busy} onClick={() => run(() => api.incomes.remove(income!.id), 'Renda excluída.')}>Confirmar exclusão</button>)}
          <button className="btn" disabled={busy}>{busy ? 'Salvando…' : edit ? 'Salvar' : 'Adicionar'}</button>
        </div>
      </form>
    </Dialog>
  );
}

export function GoalDialog({ goalCents, onClose, onSaved }: { goalCents: number; onClose: () => void; onSaved: (cents: number) => Promise<unknown> }) {
  const [value, setValue] = useState(centsToInput(goalCents)); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [formError, setFormError] = useState<string | null>(null);
  async function save(cents: number) { setBusy(true); setFormError(null); try { await onSaved(cents); onClose(); } catch (e) { setFormError(friendlyError(e)); } finally { setBusy(false); } }
  return (
    <Dialog title="Meta de gastos do mês" onClose={onClose}>
      <form className="form" noValidate onSubmit={(ev) => { ev.preventDefault(); const c = value.trim() === '' ? 0 : parseMoneyInput(value); if (c === null) { setErr('Valor inválido. Exemplo: 3.000,00'); return; } setErr(null); void save(c); }}>
        <p className="muted">Defina quanto você quer gastar, no máximo, por mês. Acompanhamos o progresso na tela Mensal.</p>
        <Field label="Meta (R$)" error={err}><input className="input mono" data-autofocus inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" aria-invalid={!!err} /></Field>
        {formError && <div className="alert-box" role="alert"><Icon name="alert" size={18} />{formError}</div>}
        <div className="form-actions">{goalCents > 0 && <button type="button" className="btn ghost" disabled={busy} onClick={() => void save(0)}>Remover meta</button>}<button className="btn" disabled={busy}>Salvar meta</button></div>
      </form>
    </Dialog>
  );
}
