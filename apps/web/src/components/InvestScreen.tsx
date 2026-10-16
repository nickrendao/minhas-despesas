'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '@/lib/api-context';
import { friendlyError } from '@/lib/errors';
import { Money } from '@/lib/me';
import { currentYm, monthName, shiftYm } from '@/lib/months';
import { PageHead, useShell } from './AppShell';
import { Icon } from './Icon';
import { PlanDialog, TYPE_LABELS } from './MoreDialogs';
import { BigMoney, EmptyState, ErrorState, Segmented, Skeleton } from './ui';

const TIPS = [
  { t: 'Tesouro Selic', d: 'Título público pós-fixado que acompanha a taxa básica de juros. Costuma ter liquidez diária e é considerado um dos investimentos de menor risco do país.', tags: ['liquidez diária', 'risco baixo'] },
  { t: 'CDB com liquidez diária', d: 'Emitido por bancos, costuma render em torno de um percentual do CDI. Vale conferir se há cobertura do FGC até o limite legal.', tags: ['liquidez diária', 'risco baixo'] },
  { t: 'Fundos DI / Renda Fixa simples', d: 'Fundos que investem em títulos pós-fixados. Compare a taxa de administração antes de escolher, pois ela reduz o rendimento líquido.', tags: ['liquidez diária', 'risco baixo'] },
  { t: 'Poupança', d: 'Opção mais simples e tradicional, com liquidez imediata, mas historicamente rende menos que as opções acima na maioria dos cenários.', tags: ['liquidez imediata', 'risco baixo'] },
];
interface Plan { id: string; name: string; type: string; targetLimitCents: number; monthlyAmountCents: number; monthsToTarget: number }

export function InvestScreen() {
  const api = useApi(); const qc = useQueryClient(); const shell = useShell(); const ym = currentYm();
  const [months, setMonths] = useState(6); const [edit, setEdit] = useState<Plan | null>(null); const [busy, setBusy] = useState(false);
  const plans = useQuery<Plan[]>({ queryKey: ['investments'], queryFn: () => api.investments.list() });
  const summary = useQuery({ queryKey: ['summary', ym, months], queryFn: () => api.reports.summary(ym, months) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['investments'] });
  async function create() { setBusy(true); try { const p = await api.investments.create({}); await refresh(); setEdit(p); } catch (e) { shell.toast(friendlyError(e)); } finally { setBusy(false); } }
  const head = <PageHead title="Investimentos" actions={<button className="btn sm" disabled={busy} onClick={create}><Icon name="plus" size={16} stroke={2.4} />Novo plano</button>} />;
  if (plans.isError) return <>{head}<ErrorState message={friendlyError(plans.error)} onRetry={() => plans.refetch()} /></>;
  const r = summary.data?.reserve;
  return (
    <div className="invest">
      {head}
      <div className="invest-grid">
        <div className="invest-col">
          {!plans.data && <Skeleton h={170} n={2} />}
          {plans.data?.length === 0 && <div className="card"><EmptyState icon="sprout" title="Nenhum plano ainda" text="Crie um plano para acompanhar quanto falta para atingir seu objetivo." /></div>}
          {plans.data?.map((p) => (
            <section className="card plan" key={p.id} aria-label={p.name}>
              <header className="plan-head"><div><h2>{p.name}</h2><span className="type-pill">{TYPE_LABELS[p.type] ?? p.type}</span></div>
                {p.monthsToTarget > 0 && <div className="months-badge"><b className="mono">{p.monthsToTarget}</b><small>{p.monthsToTarget === 1 ? 'mês' : 'meses'}</small></div>}</header>
              <div className="plan-tiles"><div className="tile3"><span className="muted">Objetivo</span><b className="mono"><Money cents={p.targetLimitCents} /></b></div><div className="tile3"><span className="muted">Por mês</span><b className="mono"><Money cents={p.monthlyAmountCents} /></b></div></div>
              {p.monthsToTarget > 0 ? <p className="muted">Chega lá em <b>{monthName(shiftYm(ym, p.monthsToTarget))} de {shiftYm(ym, p.monthsToTarget).slice(0, 4)}</b>, no ritmo atual.</p> : <p className="muted">Defina o objetivo e o valor mensal para ver a previsão.</p>}
              <div className="row-actions"><button className="btn ghost sm" aria-label={`Editar plano ${p.name}`} onClick={() => setEdit(p)}><Icon name="pencil" size={15} />Editar</button></div>
            </section>))}
        </div>
        <div className="invest-col">
          <section className="hero2 reserve-card" aria-label="Reserva de emergência">
            <h2>Reserva de emergência</h2><p className="hp">Quantos meses de gastos você quer guardar?</p>
            <Segmented label="Meses de reserva" value={months} onChange={setMonths} options={[3, 6, 9, 12].map((v) => ({ v, label: `${v}x` }))} />
            <div className="reserve-body">
              <span className="hl">Sua reserva ideal</span>
              {r ? <><BigMoney cents={r.targetCents} testId="reserve" /><p className="hp">{months} × <Money cents={r.baseCents} /> ({r.baseSource === 'income_fallback' ? 'sem despesas lançadas: usamos 70% da renda' : `suas despesas de ${monthName(ym)}`}). Educadores financeiros costumam indicar de 3 a 6 meses para renda fixa e de 6 a 12 meses para renda variável.</p></> : <div className="skeleton" style={{ height: 90 }} />}
            </div>
          </section>
          <section aria-label="Onde guardar"><h2 className="section-title">Onde guardar</h2>
            <div className="tips">{TIPS.map((t) => <article className="tip" key={t.t}><h3>{t.t}</h3><p>{t.d}</p><div className="tags">{t.tags.map((g) => <span key={g}>{g}</span>)}</div></article>)}</div>
            <p className="muted" style={{ marginTop: 12 }}>Conteúdo educativo, não é recomendação de investimento personalizada. Rentabilidade, tributação e condições variam entre instituições e mudam com o tempo.</p></section>
        </div>
      </div>
      {edit && <PlanDialog plan={edit} onClose={() => setEdit(null)} onSave={async (v) => { await api.investments.update(edit.id, v); await refresh(); shell.toast('Plano atualizado.'); }} onDelete={async () => { await api.investments.remove(edit.id); await refresh(); shell.toast('Plano excluído.'); }} />}
    </div>
  );
}
