'use client';
import { useQuery } from '@tanstack/react-query';
import { todayIn } from '@fin/shared';
import { useApi } from '@/lib/api-context';
import { friendlyError } from '@/lib/errors';
import { Money, useMe } from '@/lib/me';
import { daysBetween, monthLabel, monthName } from '@/lib/months';
import { PageHead } from './AppShell';
import { EmptyState, ErrorState, Skeleton } from './ui';

interface Due { ym: string; dueDay: number; expenseId: string; name: string; amountCents: number }
const when = (d: number) => (d < 0 ? 'já venceu' : d === 0 ? 'vence hoje' : d === 1 ? 'vence amanhã' : `vence em ${d} dias`);

export function AgendaScreen() {
  const api = useApi(); const me = useMe(); const tz = me.data?.settings.timezone ?? 'America/Sao_Paulo';
  const q = useQuery<Due[]>({ queryKey: ['agenda'], queryFn: () => api.reports.agenda(3) });
  const head = <PageHead title="Agenda" eyebrow="Contas com dia de vencimento, dos próximos 3 meses." />;
  if (q.isError) return <>{head}<ErrorState message={friendlyError(q.error)} onRetry={() => q.refetch()} /></>;
  if (!q.data) return <>{head}<Skeleton h={130} /><Skeleton h={200} /></>;
  if (q.data.length === 0) return <>{head}<div className="card"><EmptyState icon="clock" title="Nenhum vencimento cadastrado" text="Defina o dia de vencimento em cada despesa, na tela Mensal, e elas aparecem aqui." /></div></>;

  const today = todayIn(tz); const diff = (d: Due) => daysBetween(today, { ym: d.ym, day: d.dueDay });
  const next = q.data.find((d) => diff(d) >= 0);
  const groups = q.data.reduce<Record<string, Due[]>>((a, d) => { (a[d.ym] ??= []).push(d); return a; }, {});
  return (
    <div className="agenda-page">
      {head}
      <div className="agenda-grid">
        {next && (() => { const n = diff(next); return (
          <section className="hero2 next-due" aria-label="Próximo vencimento">
            <div className={`nd-day${n <= 1 ? ' urgent' : ''}`}><b>{String(next.dueDay).padStart(2, '0')}</b><span>{monthName(next.ym).slice(0, 3).toUpperCase()}</span></div>
            <div className="nd-info"><span className={`nd-tag${n <= 1 ? ' urgent' : ''}`}>{when(n)}</span><b>{next.name}</b><span className="mono"><Money cents={next.amountCents} /></span></div>
          </section>); })()}
        <div className="agenda-months">
          {Object.entries(groups).map(([ym, items]) => {
            const upcoming = items.filter((d) => diff(d) >= 0).reduce((a, d) => a + d.amountCents, 0);
            return (
              <section key={ym} aria-label={monthLabel(ym)}>
                <header className="am-head"><h2 style={{ textTransform: 'capitalize' }}>{monthName(ym)}</h2>{upcoming > 0 && <span className="mono muted"><Money cents={upcoming} /> a vencer</span>}</header>
                <ul className="timeline">{items.map((d) => { const n = diff(d); return (
                  <li key={d.expenseId} className={n < 0 ? 'past' : n <= 1 ? 'soon' : ''}>
                    <span className="tl-dot" aria-hidden="true" />
                    <div className="tl-card"><b className="tl-day mono">{String(d.dueDay).padStart(2, '0')}</b><span className="nm-wrap"><b className="nm">{d.name}</b><span className={`sub${n >= 0 && n <= 1 ? ' urgent' : ''}`}>{when(n)}</span></span><b className="amt"><Money cents={d.amountCents} /></b></div>
                  </li>); })}</ul>
              </section>);
          })}
        </div>
      </div>
    </div>
  );
}
