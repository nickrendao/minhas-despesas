'use client';
import { useIsMutating, useQuery, useQueryClient } from '@tanstack/react-query';
import { MAX_INCOMES_PER_MONTH, todayIn } from '@fin/shared';
import Link from 'next/link';
import { useState } from 'react';
import { useApi } from '@/lib/api-context';
import { friendlyError } from '@/lib/errors';
import { buildMonthCsv, download } from '@/lib/exports';
import { expenseIcon } from '@/lib/expense-icon';
import { Money, useMe } from '@/lib/me';
import { setSelectedYm, useSelectedYm } from '@/lib/month-store';
import { currentYm, monthLabel, monthName, shiftYm } from '@/lib/months';
import { invalidateMoney } from '@/lib/queries';
import { useShell, Tools } from './AppShell';
import { BrandMark } from './BrandMark';
import { Dialog } from './Dialog';
import { ExpenseDialog, ExpenseLike, GoalDialog, IncomeDialog, IncomeLike } from './FormDialogs';
import { Icon } from './Icon';
import { BigMoney, EmptyState, ErrorState, InstallmentDots, SegBar, Skeleton, Tile } from './ui';

interface Exp extends ExpenseLike { icon: string; color: string }
interface Due { expenseId: string; name: string; amountCents: number; dueDay: number; daysUntil: number | null; urgent: boolean }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dueTag = (d: Due) => (d.daysUntil === null ? `dia ${d.dueDay}` : d.daysUntil === 0 ? 'hoje' : d.daysUntil === 1 ? 'amanhã' : `${d.daysUntil} dias`);

function MonthPicker({ ym, onChange }: { ym: string; onChange: (v: string) => void }) {
  const chip = (d: number) => { const v = shiftYm(ym, d); return <button key={d} className="m-chip" aria-label={`Ir para ${monthLabel(v)}`} onClick={() => onChange(v)}>{monthName(v).slice(0, 3)}</button>; };
  return (
    <div className="month-picker" role="group" aria-label="Mês">
      <button className="m-arrow" aria-label="Mês anterior" onClick={() => onChange(shiftYm(ym, -1))}><Icon name="left" size={18} stroke={2} /></button>
      <div className="m-chips">{chip(-2)}{chip(-1)}<span className="m-chip cur" aria-current="date"><span className="cur-long">{monthName(ym)}</span><span className="cur-short">{monthName(ym).slice(0, 3)} {ym.slice(0, 4)}</span></span>{chip(1)}</div>
      <button className="m-arrow" aria-label="Próximo mês" onClick={() => onChange(shiftYm(ym, 1))}><Icon name="right" size={18} stroke={2} /></button>
    </div>
  );
}

export function MensalScreen({ initialYm }: { initialYm?: string }) {
  const api = useApi(); const qc = useQueryClient(); const shell = useShell(); const me = useMe(); const saving = useIsMutating() > 0;
  useState(() => { if (initialYm) setSelectedYm(initialYm); });   // antes de ler o mês selecionado
  const [ym, setYm] = useSelectedYm();
  const tz = me.data?.settings.timezone ?? 'America/Sao_Paulo'; const name = me.data?.settings.displayName ?? '';
  const [dlg, setDlg] = useState<null | { t: 'exp'; e?: Exp } | { t: 'inc'; i?: IncomeLike } | { t: 'goal' } | { t: 'overwrite'; target: string }>(null);

  const month = useQuery({ queryKey: ['month', ym], queryFn: () => api.months.open(ym) });
  const summary = useQuery({ queryKey: ['summary', ym], queryFn: () => api.reports.summary(ym) });
  const dues = useQuery<Due[]>({ queryKey: ['dues', ym], queryFn: () => api.reports.dues(ym) });
  const cards = useQuery<{ usedCents: number }[]>({ queryKey: ['cards'], queryFn: () => api.cards.list() });
  const header = (
    <header className="page-head mensal-head">
      <div className="mh-brand"><BrandMark size={44} /></div>
      <div className="ph-titles">
        <div className="eyebrow"><span className="d-only">{greet()}{name ? `, ${name}` : ''}</span><span className="m-only">{greet()}{name ? ',' : ''}</span></div>
        <div className="m-only m-name" aria-hidden="true">{name}</div>
        <h1 className="h1-month">{cap(monthLabel(ym))}</h1>
      </div>
      <div className="ph-tools"><Tools /></div>
      <div className="mh-month"><MonthPicker ym={ym} onChange={setYm} /></div>
      <button className="btn mh-new" onClick={() => shell.openQuickAdd(ym)}><Icon name="plus" size={18} stroke={2.4} />Nova despesa</button>
    </header>
  );

  if (month.isError || summary.isError) return <div className="dash">{header}<ErrorState message={friendlyError(month.error ?? summary.error)} onRetry={() => { month.refetch(); summary.refetch(); }} /></div>;
  if (!month.data || !summary.data) return <div className="dash">{header}<Skeleton h={230} /><Skeleton h={160} n={2} /></div>;

  const s = summary.data; const incomes: IncomeLike[] = [...(month.data.incomes as IncomeLike[])].sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary));
  const primary = incomes.find((i) => i.isPrimary); const expenses: Exp[] = month.data.expenses;
  const fixed = expenses.filter((e) => e.recurring); const variable = expenses.filter((e) => !e.recurring);
  const sum = (l: Exp[]) => l.reduce((a, e) => a + e.amountCents, 0);
  const negative = s.balanceCents < 0; const committed = Math.min(100, s.committedPercent);
  const parts = s.incomeCents > 0 ? (s.distribution as any[]).map((d) => ({ id: d.expenseId, name: d.name, color: d.color, pct: (d.amountCents / s.incomeCents) * 100 })) : [];
  const cardsTotal = cards.data ? cards.data.reduce((a, c) => a + c.usedCents, 0) : null;
  const today = todayIn(tz); const isNow = ym === today.ym;
  const dueLabel = (e: Exp) => { if (!e.dueDay) return null; if (isNow) { const d = e.dueDay - today.day; if (d === 0) return { text: 'hoje', urgent: true }; if (d === 1) return { text: 'amanhã', urgent: true }; } return { text: `dia ${e.dueDay}`, urgent: false }; };
  const next = shiftYm(ym, 1);
  async function makePrimary(i: IncomeLike) {
    try { await api.incomes.update(i.id, { isPrimary: true }); await invalidateMoney(qc); shell.toast(`“${i.name}” agora é a renda principal.`); } catch (e) { shell.toast(friendlyError(e)); }
  }
  async function copy(overwrite: boolean) {
    try { await api.months.copy(ym, next, overwrite); await invalidateMoney(qc); shell.toast(`Copiado para ${monthName(next)}.`); setDlg(null); }
    catch (e: any) { if (e?.code === 'MONTH_NOT_EMPTY') setDlg({ t: 'overwrite', target: next }); else shell.toast(friendlyError(e)); }
  }
  function exportCsv() {
    const csv = buildMonthCsv([...incomes.map((i) => ({ kind: 'Renda' as const, name: i.name, dueDay: null, installmentCurrent: null, installmentTotal: null, amountCents: i.amountCents })),
      ...expenses.map((e) => ({ kind: (e.recurring ? 'Despesa fixa' : 'Despesa variável') as 'Despesa fixa', name: e.name, dueDay: e.dueDay, installmentCurrent: e.installmentCurrent ?? null, installmentTotal: e.installmentTotal ?? null, amountCents: e.amountCents }))]);
    csv ? download(`despesas-${ym}.csv`, csv, 'text/csv;charset=utf-8', true) : shell.toast('Nada para exportar neste mês.');
  }
  const row = (e: Exp) => {
    const due = dueLabel(e); const inst = e.installmentTotal ? { c: e.installmentCurrent ?? 1, t: e.installmentTotal } : null;
    return (
      <li key={e.id}><button className="item" onClick={() => setDlg({ t: 'exp', e })} aria-label={`Editar despesa ${e.name}`}>
        <Tile name={expenseIcon(e.icon)} color={e.color} />
        <span className="nm-wrap"><b className="nm">{e.name}</b>
          {inst ? <span className="sub"><InstallmentDots current={inst.c} total={inst.t} /> <span>{inst.c} de {inst.t}</span></span> : <span className={`sub sub-narrow${due?.urgent ? ' urgent' : ''}`}>{due ? `Vence ${due.text}` : e.recurring ? 'Repete todo mês' : 'Este mês'}</span>}</span>
        <span className={`meta${due?.urgent ? ' urgent' : ''}`}>{inst ? `${inst.c} de ${inst.t}` : due ? due.text : '—'}</span>
        <b className="amt"><Money cents={e.amountCents} /></b>
      </button></li>
    );
  };
  const list = (title: string, l: Exp[], icon: string, empty: string) => (
    <section className="card list-card" aria-label={title}>
      <header className="card-head"><h2><Icon name={icon} size={17} />{title}</h2><b className="mono sum"><Money cents={sum(l)} /></b></header>
      {l.length ? <ul className="items">{l.map(row)}</ul> : <EmptyState icon="receipt" title={empty} action={<button className="btn sm ghost" onClick={() => shell.openQuickAdd(ym)}><Icon name="plus" size={16} />Adicionar</button>} />}
    </section>
  );

  return (
    <div className="dash">
      {header}
      <div className="dash-top">
        <section className="hero2" aria-label="Resumo do mês">
          <div className="hero-row">
            <div><div className="hl">{negative ? 'Faltou em ' : 'Sobra em '}{monthName(ym)}</div><BigMoney cents={s.balanceCents} testId="balance" className={negative ? 'neg' : ''} /></div>
            <div className="pills">
              <span className="status-pill"><i className={saving ? 'busy' : ''} />{saving ? 'Salvando…' : 'Salvo'}</span>
              {primary && <span className="status-pill principal" data-testid="principal-pill" title={`Renda principal: ${primary.name}`}><Icon name={primary.recurring ? 'repeat' : 'star'} size={13} stroke={2.2} /><span>{primary.name}</span></span>}
            </div>
          </div>
          <div>
            <SegBar parts={parts} label={`${s.committedPercent}% da renda comprometida`} />
            <div className="hl row-between" style={{ marginTop: 8 }}><span role="progressbar" aria-label="Renda comprometida" aria-valuenow={committed} aria-valuemin={0} aria-valuemax={100}>{s.incomeCents > 0 ? `${s.committedPercent}% da renda comprometida` : 'Defina uma renda para ver o quanto está comprometido'}</span>{s.incomeCents > 0 && <span className="mono">{Math.max(0, 100 - s.committedPercent)}% livre</span>}</div>
          </div>
          <div className="tiles">
            <div className="tile2"><span className="hl"><Icon name="up" size={14} stroke={2.2} />Renda</span><b data-testid="income"><Money cents={s.incomeCents} /></b></div>
            <div className="tile2"><span className="hl"><Icon name="arrowDown" size={14} stroke={2.2} />Despesas</span><b data-testid="expenses"><Money cents={s.expensesCents} /></b></div>
            {cardsTotal !== null && <div className="tile2"><span className="hl"><Icon name="card" size={14} stroke={2.2} />Cartões</span><b data-testid="cards-total"><Money cents={cardsTotal} /></b></div>}
          </div>
        </section>

        <section className="card dues-card" aria-label="Vence em breve">
          <header className="card-head"><h2>Vence em breve</h2><Link href="/agenda" className="link">{'Ver agenda'}</Link></header>
          {dues.isLoading && <Skeleton h={64} n={2} />}
          {dues.data && dues.data.length === 0 && <EmptyState icon="clock" title="Nada vencendo por agora" text="Defina o dia de vencimento nas despesas para ver os avisos aqui." />}
          {dues.data && dues.data.length > 0 && <ul className="dues">{dues.data.map((d) => (
            <li key={d.expenseId} className={`due${d.urgent ? ' urgent' : ''}`}><div className="dday"><b>{String(d.dueDay).padStart(2, '0')}</b><span>{monthName(ym).slice(0, 3).toUpperCase()}</span></div>
              <div className="dinfo"><b>{d.name}</b><span className="dtag">{dueTag(d)}</span></div><b className="damt"><Money cents={d.amountCents} /></b></li>))}</ul>}
        </section>
      </div>

      <div className="row-actions" role="group" aria-label="Ações do mês">
        <button className="btn ghost sm" onClick={() => void copy(false)}><Icon name="copy" size={16} />Copiar p/ {monthName(next)}</button>
        <button className="btn ghost sm" onClick={exportCsv}><Icon name="download" size={16} />Exportar CSV</button>
      </div>

      <div className="dash-lists">{list('Fixas', fixed, 'repeat', 'Nenhuma despesa fixa')}{list('Variáveis', variable, 'arrowDown', 'Nenhuma despesa variável')}</div>

      <div className="dash-extra">
        <section className="card" aria-label="Rendas">
          <header className="card-head"><h2>Rendas <span className="count">{incomes.length}/{MAX_INCOMES_PER_MONTH}</span></h2><button className="btn sm ghost" disabled={incomes.length >= MAX_INCOMES_PER_MONTH} onClick={() => setDlg({ t: 'inc' })}><Icon name="plus" size={16} />Nova renda</button></header>
          {incomes.length === 0 ? <EmptyState icon="up" title="Nenhuma renda neste mês" text="Adicione seu salário ou outras entradas para calcular a sobra." /> :
            <ul className="items">{incomes.map((i) => (
              <li key={i.id} className="inc-row">
                <button className="item" onClick={() => setDlg({ t: 'inc', i })} aria-label={`Editar renda ${i.name}`}>
                  <Tile name="up" color="#009929" />
                  <span className="nm-wrap"><b className="nm">{i.name}</b><span className="sub">{i.isPrimary && <span className="pill-main">Principal</span>}{i.recurring ? 'Repete todo mês' : 'Só neste mês'}</span></span>
                  <span className="meta" /><b className="amt"><Money cents={i.amountCents} /></b>
                </button>
                {i.isPrimary ? <span className="star on" role="img" aria-label={`Renda principal: ${i.name}`}><Icon name="star" size={18} /></span>
                  : <button className="star" aria-label={`Tornar ${i.name} a renda principal`} title="Tornar principal" onClick={() => void makePrimary(i)}><Icon name="star" size={18} /></button>}
              </li>))}</ul>}
        </section>
        <section className="card" aria-label="Maiores gastos">
          <header className="card-head"><h2>Maiores gastos</h2></header>
          {s.distribution.length === 0 ? <EmptyState icon="bars" title="Sem gastos ainda" text="Quando você lançar despesas, mostramos aqui para onde o dinheiro vai." /> :
            <ul className="topspend">{(s.distribution as any[]).slice(0, 5).map((d) => <li key={d.expenseId}><span className="ts-name">{d.name}</span><span className="ts-bar" role="img" aria-label={`${d.percentOfTotal}% das despesas`}><i style={{ width: `${d.percentOfTotal}%`, background: d.color }} /></span><span className="ts-pct mono">{d.percentOfTotal}%</span></li>)}</ul>}
        </section>
        <section className="card" aria-label="Meta de gastos">
          <header className="card-head"><h2>Meta de gastos</h2><button className="btn sm ghost" onClick={() => setDlg({ t: 'goal' })}><Icon name="target" size={16} />{s.goal ? 'Editar' : 'Definir'}</button></header>
          {s.goal ? <div className="goal">
            <div className="track" role="progressbar" aria-label="Meta de gastos usada" aria-valuenow={Math.round(s.goal.usedPercent)} aria-valuemin={0} aria-valuemax={100}><i className={s.goal.exceeded ? 'over' : ''} style={{ width: `${s.goal.usedPercent}%` }} /></div>
            <p className={s.goal.exceeded ? 'over-text' : 'muted'}>{s.goal.exceeded ? <>Meta ultrapassada em <b><Money cents={s.goal.differenceCents} /></b></> : <>Faltam <b><Money cents={s.goal.differenceCents} /></b> para atingir a meta de <Money cents={s.goal.goalCents} /></>}</p></div>
            : <EmptyState icon="target" title="Sem meta definida" text="Defina um limite mensal de gastos para acompanhar o progresso." />}
        </section>
      </div>

      {dlg?.t === 'exp' && <ExpenseDialog ym={ym} expense={dlg.e} onClose={() => setDlg(null)} onDone={(m) => shell.toast(m)} />}
      {dlg?.t === 'inc' && <IncomeDialog ym={ym} income={dlg.i} incomeCount={incomes.length} onClose={() => setDlg(null)} onDone={(m) => shell.toast(m)} />}
      {dlg?.t === 'goal' && <GoalDialog goalCents={s.goal?.goalCents ?? 0} onClose={() => setDlg(null)} onSaved={async (c) => { await api.me.updateSettings({ monthlyGoalCents: c }); await qc.invalidateQueries({ queryKey: ['me'] }); await invalidateMoney(qc); shell.toast(c ? 'Meta salva.' : 'Meta removida.'); }} />}
      {dlg?.t === 'overwrite' && <Dialog title="Substituir dados?" onClose={() => setDlg(null)}><div className="form"><p>O mês de <b>{monthName(dlg.target)}</b> já tem lançamentos. Copiar vai <b>substituí-los</b> pelos de {monthName(ym)}.</p><div className="form-actions"><button className="btn ghost" onClick={() => setDlg(null)}>Cancelar</button><button className="btn danger" onClick={() => void copy(true)}>Substituir</button></div></div></Dialog>}
    </div>
  );
}
function greet() { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }
