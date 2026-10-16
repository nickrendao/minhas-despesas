'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MAX_CREDIT_CARDS, CARD_WARN_RATIO } from '@fin/shared';
import { useState } from 'react';
import { useApi } from '@/lib/api-context';
import { friendlyError } from '@/lib/errors';
import { buildCardsCsv, buildCardsOfx, download } from '@/lib/exports';
import { Money } from '@/lib/me';
import { invalidateMoney } from '@/lib/queries';
import { PageHead, useShell } from './AppShell';
import { CardDialog, ConfirmDialog, PurchaseDialog } from './MoreDialogs';
import { Icon } from './Icon';
import { EmptyState, ErrorState, Skeleton } from './ui';

interface Purchase { id: string; name: string; amountCents: number; installmentCurrent: number | null; installmentTotal: number | null }
interface Card { id: string; name: string; color: string; limitCents: number; usedCents: number; availableCents: number; usagePercent: number; warn: boolean; purchases: Purchase[] }

export function CardsScreen() {
  const api = useApi(); const qc = useQueryClient(); const shell = useShell();
  const q = useQuery<Card[]>({ queryKey: ['cards'], queryFn: () => api.cards.list() });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dlg, setDlg] = useState<null | 'edit' | 'purchase' | { del: Purchase }>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => invalidateMoney(qc);
  if (q.isError) return <><PageHead title="Cartões" /><ErrorState message={friendlyError(q.error)} onRetry={() => q.refetch()} /></>;
  if (!q.data) return <><PageHead title="Cartões" /><Skeleton h={190} /><Skeleton h={220} /></>;

  const list = q.data; const active = list.find((c) => c.id === activeId) ?? list[0];
  const full = list.length >= MAX_CREDIT_CARDS;
  async function create() {
    setBusy(true);
    try { const c = await api.cards.create({ name: 'Novo cartão', limitCents: 0 }); await refresh(); setActiveId(c.id); setDlg('edit'); } catch (e) { shell.toast(friendlyError(e)); } finally { setBusy(false); }
  }
  const exportCsv = () => { const t = buildCardsCsv(list); t ? download('cartoes.csv', t, 'text/csv;charset=utf-8', true) : shell.toast('Nenhum gasto lançado ainda para exportar.'); };
  const exportOfx = () => { const t = buildCardsOfx(list); t ? download('cartoes.ofx', t, 'application/x-ofx') : shell.toast('Nenhum gasto lançado ainda para exportar.'); };
  const warnAt = Math.round(CARD_WARN_RATIO * 100);

  return (
    <div className="cards-page">
      <PageHead eyebrow={`${list.length} de ${MAX_CREDIT_CARDS} cartões usados`} title="Cartões" actions={<button className="btn sm" disabled={full || busy} onClick={create}><Icon name="plus" size={16} stroke={2.4} />Novo cartão</button>} />
      {list.length === 0 && <div className="card"><EmptyState icon="card" title="Nenhum cartão cadastrado" text="Adicione o primeiro para acompanhar limite, fatura e parcelas." action={<button className="btn sm" onClick={create}><Icon name="plus" size={16} />Novo cartão</button>} /></div>}

      {list.length > 0 && active && (<>
        <div className="wallets" role="tablist" aria-label="Seus cartões">
          {list.map((c) => (
            <button key={c.id} role="tab" aria-selected={c.id === active.id} className={`wallet${c.id === active.id ? ' on' : ''}`} style={{ ['--cc' as any]: c.color }} onClick={() => setActiveId(c.id)}>
              <span className="w-top"><span className="chip-ico" aria-hidden="true" /><span className="w-pill">{Math.round(c.usagePercent)}% usado</span></span>
              <span className="w-name">{c.name}</span><span className="w-limit">Limite <Money cents={c.limitCents} /></span>
            </button>
          ))}
        </div>

        <div className="cards-detail">
          <section className="card" aria-label={`Detalhes de ${active.name}`}>
            <header className="card-head"><h2>{active.name}</h2><button className="btn sm ghost" onClick={() => setDlg('edit')}><Icon name="pencil" size={15} />Editar</button></header>
            <div className="muted">Usado neste cartão</div>
            <div className="usage"><b className="mono" data-testid="used"><Money cents={active.usedCents} /></b><span className="muted">de <Money cents={active.limitCents} /></span></div>
            <div className="meter"><div className={`track${active.warn ? ' warn' : ''}`} role="progressbar" aria-label="Limite usado" aria-valuenow={Math.round(active.usagePercent)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${active.usagePercent}%` }} /></div><span className="mark" style={{ left: `${warnAt}%` }} aria-hidden="true" /></div>
            <div className="meter-legend"><span>0%</span><span className={active.warn ? 'over-text' : ''}>alerta em {warnAt}%</span><span>100%</span></div>
            {active.warn && <div className="alert-box" role="status"><Icon name="alert" size={18} />Atenção: você já usou {warnAt}% ou mais do limite.</div>}
            <div className="tiles light">
              <div className="tile3"><span className="muted">Disponível</span><b className="mono" data-testid="available"><Money cents={active.availableCents} /></b></div>
              <div className="tile3"><span className="muted">Compras</span><b className="mono">{active.purchases.length} {active.purchases.length === 1 ? 'lançamento' : 'lançamentos'}</b></div>
            </div>
          </section>

          <section className="card" aria-label="Gastos no cartão">
            <header className="card-head"><h2>Gastos no cartão</h2><button className="btn sm" onClick={() => setDlg('purchase')}><Icon name="plus" size={15} stroke={2.4} />Gasto</button></header>
            {active.purchases.length === 0 ? <EmptyState icon="receipt" title="Nenhum gasto lançado" text="Registre as compras deste cartão para acompanhar a fatura." /> :
              <ul className="items">{active.purchases.map((p) => (
                <li key={p.id} className="purchase-li"><div className="item static">
                  <span className="nm-wrap"><b className="nm">{p.name}</b>{p.installmentTotal ? <span className="sub"><span className="pill-inst">{p.installmentCurrent ?? 1}/{p.installmentTotal}</span>faltam {p.installmentTotal - (p.installmentCurrent ?? 1)} parcelas</span> : <span className="sub">à vista</span>}</span>
                  <b className="amt"><Money cents={p.amountCents} /></b>
                  <button className="icon-btn sm plain" aria-label={`Excluir gasto ${p.name}`} onClick={() => setDlg({ del: p })}><Icon name="trash" size={16} /></button></div></li>))}</ul>}
            <div className="row-actions end"><button className="btn ghost sm" onClick={exportCsv}><Icon name="download" size={15} />CSV</button><button className="btn ghost sm" onClick={exportOfx}><Icon name="download" size={15} />OFX</button></div>
          </section>
        </div>

        {dlg === 'edit' && <CardDialog card={active} onClose={() => setDlg(null)} onSave={async (v) => { await api.cards.update(active.id, v); await refresh(); shell.toast('Cartão atualizado.'); }} onDelete={async () => { await api.cards.remove(active.id); await refresh(); setActiveId(null); shell.toast('Cartão excluído.'); }} />}
        {dlg === 'purchase' && <PurchaseDialog onClose={() => setDlg(null)} onAdd={async (b) => { await api.cards.addPurchase(active.id, b); await refresh(); shell.toast('Gasto adicionado.'); }} />}
        {dlg && typeof dlg === 'object' && 'del' in dlg && <ConfirmDialog title="Excluir gasto?" text={`“${dlg.del.name}” será removido da fatura de ${active.name}.`} confirmLabel="Excluir" onClose={() => setDlg(null)} onConfirm={async () => { await api.cards.removePurchase(active.id, dlg.del.id); await refresh(); shell.toast('Gasto excluído.'); }} />}
      </>)}
    </div>
  );
}
