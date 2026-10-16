'use client';
import { useQuery } from '@tanstack/react-query';
import { formatBRL } from '@fin/shared';
import { useState } from 'react';
import { useApi } from '@/lib/api-context';
import { friendlyError } from '@/lib/errors';
import { Money, useMe } from '@/lib/me';
import { currentYm, monthName } from '@/lib/months';
import { PageHead } from './AppShell';
import { Icon } from './Icon';
import { BigMoney, EmptyState, ErrorState, Skeleton } from './ui';

interface Month { ym: string; expensesCents: number; incomeCents: number }
interface Yearly { year: number; months: Month[]; totalYearCents: number; averageMonthlyCents: number; biggestMonth: { ym: string; expensesCents: number } }

export function AnnualScreen({ initialYear }: { initialYear?: number }) {
  const api = useApi(); const me = useMe(); const tz = me.data?.settings.timezone;
  const [year, setYear] = useState(initialYear ?? Number(currentYm(tz).slice(0, 4)));
  const q = useQuery<Yearly>({ queryKey: ['yearly', year], queryFn: () => api.reports.yearly(year) });
  const stepper = <div className="year-step" role="group" aria-label="Ano"><button className="m-arrow" aria-label="Ano anterior" onClick={() => setYear((y) => y - 1)}><Icon name="left" size={18} stroke={2} /></button><strong aria-live="polite">{year}</strong><button className="m-arrow" aria-label="Próximo ano" onClick={() => setYear((y) => y + 1)}><Icon name="right" size={18} stroke={2} /></button></div>;
  const head = <PageHead title="Visão anual" actions={stepper} />;
  if (q.isError) return <>{head}<ErrorState message={friendlyError(q.error)} onRetry={() => q.refetch()} /></>;
  if (!q.data) return <>{head}<Skeleton h={320} /><Skeleton h={100} /></>;

  const y = q.data; const withData = y.months.filter((m) => m.expensesCents > 0 || m.incomeCents > 0);
  const max = Math.max(...y.months.map((m) => m.expensesCents), 1); const now = currentYm(tz); const big = y.biggestMonth.expensesCents > 0 ? y.biggestMonth.ym : null;
  const incomeSum = withData.reduce((a, m) => a + m.incomeCents, 0); const spentSum = withData.reduce((a, m) => a + m.expensesCents, 0); const saved = incomeSum - spentSum;
  const letters = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  if (withData.length === 0) return <>{head}<div className="card"><EmptyState icon="bars" title={`Sem lançamentos em ${year}`} text="Quando você registrar rendas e despesas, o ano aparece aqui mês a mês." /></div></>;

  return (
    <div className="annual">
      {head}
      <div className="annual-grid">
        <section className="hero2 chart-hero" aria-label="Gasto no ano">
          <div><div className="hl">Gasto em {year}{year === Number(now.slice(0, 4)) ? ' até agora' : ''}</div><BigMoney cents={y.totalYearCents} testId="year-total" /></div>
          <div className="achart" role="group" aria-label="Gastos por mês">
            {y.averageMonthlyCents > 0 && <div className="aavg" style={{ bottom: `calc(${(y.averageMonthlyCents / max) * 100}% * .86 + 22px)` }} aria-hidden="true" />}
            {y.months.map((m, i) => (
              <div className="acol" key={m.ym}>
                <div className="abar-wrap"><button className={`abar${m.ym === now ? ' cur' : ''}${m.ym === big ? ' max' : ''}`} style={{ height: `${Math.max((m.expensesCents / max) * 100, m.expensesCents ? 3 : 1.5)}%` }} data-v={formatBRL(m.expensesCents)} aria-label={`${monthName(m.ym)}: ${formatBRL(m.expensesCents)}`} /></div>
                <span className={`alabel${m.ym === now ? ' cur' : ''}`}>{letters[i]}</span>
              </div>))}
          </div>
          <div className="legend"><span><i className="lg cur" />mês atual</span><span><i className="lg max" />maior gasto</span><span><i className="lg avg" />média</span></div>
        </section>
        <div className="annual-side">
          <div className="two-tiles">
            <div className="card tile3"><span className="muted">Média por mês</span><b className="mono" data-testid="year-avg"><Money cents={y.averageMonthlyCents} /></b><span className="muted">nos {withData.length} {withData.length === 1 ? 'mês' : 'meses'} com dados</span></div>
            <div className="card tile3"><span className="muted">Mês mais caro</span><b className="mono" data-testid="year-biggest" style={{ textTransform: 'capitalize' }}>{big ? monthName(big) : '—'}</b><span className="muted"><Money cents={y.biggestMonth.expensesCents} /></span></div>
          </div>
          {incomeSum > 0 && <div className={`saved${saved < 0 ? ' neg' : ''}`}><span><b>{saved < 0 ? 'Faltou no ano' : 'Sobrou no ano'}</b><small>renda menos despesas, nos meses com lançamentos</small></span><b className="mono" data-testid="year-saved"><Money cents={saved} /></b></div>}
          <section className="card" aria-label="Mês a mês"><header className="card-head"><h2>Mês a mês</h2></header>
            <ul className="mbm">{[...withData].reverse().map((m) => <li key={m.ym}><span style={{ textTransform: 'capitalize' }}>{monthName(m.ym)}</span><span className="mbm-bar" aria-hidden="true"><i style={{ width: `${(m.expensesCents / max) * 100}%` }} /></span><b className="mono"><Money cents={m.expensesCents} /></b></li>)}</ul>
            <p className="muted" style={{ marginTop: 10 }}>Soma apenas meses que têm lançamentos gravados.</p></section>
        </div>
      </div>
    </div>
  );
}
