'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useApi } from '@/lib/api-context';
import { COINS, coinById } from '@/lib/coins';
import { CRYPTO_ICONS } from '@/lib/crypto-icons';
import { friendlyError } from '@/lib/errors';
import { Money } from '@/lib/me';
import { PageHead } from './AppShell';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { MoneyField } from './MoneyField';
import { ConfirmDialog } from './MoreDialogs';
import { EmptyState, ErrorState, Skeleton } from './ui';

interface Item { id: string; coinId: string | null; quantity: string; buyPriceCents: number; priceAvailable: boolean; currentPriceCents: number | null; change24hPercent: number | null; investedCents: number; currentValueCents: number | null; gainCents: number | null; gainPercent: number | null }
interface Valuation { items: Item[]; totals: { pricedCount: number; investedCents: number; currentValueCents: number; gainCents: number; gainPercent: number | null }; asOf: string }
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')}%`;

/** Emblema: ícone real (CC0) quando existe; senão, círculo colorido com a inicial. */
export function CoinBadge({ coinId, size = 28 }: { coinId: string | null; size?: number }) {
  const coin = coinById(coinId);
  if (!coin) return <span className="coin empty" style={{ width: size, height: size }} aria-hidden>?</span>;
  const svg = CRYPTO_ICONS[coin.symbol.toLowerCase()];
  return svg ? <span className="coin" style={{ width: size, height: size }} aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />
    : <span className="coin" style={{ width: size, height: size, background: coin.color, fontSize: size * 0.42 }} aria-hidden>{coin.symbol[0]}</span>;
}
function QuantityField({ value, label, onCommit }: { value: string; label: string; onCommit: (q: string) => void }) {
  const [text, setText] = useState(value === '0' ? '' : value.replace('.', ',')); const [bad, setBad] = useState(false);
  useEffect(() => { setText(value === '0' ? '' : value.replace('.', ',')); setBad(false); }, [value]);
  function commit() { const n = text.trim() === '' ? '0' : text.trim().replace(',', '.'); if (!/^\d{1,18}(\.\d{1,12})?$/.test(n)) { setBad(true); return; } setBad(false); if (n !== value) onCommit(n); }
  return <input className={`input mono${bad ? ' bad' : ''}`} inputMode="decimal" aria-label={label} aria-invalid={bad} placeholder="0" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
}

export function CryptoScreen({ refreshMs = 8000 }: { refreshMs?: number }) {
  const api = useApi(); const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null); const [picking, setPicking] = useState<string | null>(null); const [del, setDel] = useState<string | null>(null);
  const q = useQuery<Valuation>({ queryKey: ['crypto'], queryFn: () => api.crypto.valuation(), refetchInterval: refreshMs, refetchIntervalInBackground: false });
  const run = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onMutate: () => setErr(null), onSuccess: () => qc.invalidateQueries({ queryKey: ['crypto'] }), onError: (e) => { setErr(friendlyError(e)); qc.invalidateQueries({ queryKey: ['crypto'] }); } });
  const act = (fn: () => Promise<unknown>) => run.mutate(fn);
  const actions = <><button className="icon-btn" aria-label="Atualizar cotações" onClick={() => q.refetch()}><Icon name="refresh" size={18} /></button><button className="btn sm" disabled={run.isPending} onClick={() => act(() => api.crypto.create({}))}><Icon name="plus" size={16} stroke={2.4} />Nova moeda</button></>;
  if (q.isError && !q.data) return <><PageHead title="Cripto" /><ErrorState message={friendlyError(q.error)} onRetry={() => q.refetch()} /></>;
  if (!q.data) return <><PageHead title="Cripto" /><Skeleton h={150} /><Skeleton h={200} /></>;
  const { items, totals, asOf } = q.data; const time = new Date(asOf).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="crypto">
      <PageHead title="Cripto" eyebrow={items.length > 0 ? <span data-testid="asof">Atualizado às {time} · atualiza sozinho</span> : 'Suas moedas, com cotação em tempo real'} actions={actions} />
      {err && <div className="alert-box" role="alert"><Icon name="alert" size={18} />{err}</div>}
      {items.length === 0 && <div className="card"><EmptyState icon="coin" title="Nenhuma criptomoeda adicionada" text="Adicione a primeira para acompanhar quanto ela rende." /></div>}
      {totals.pricedCount > 0 && (
        <section className="hero2 crypto-hero" aria-label="Resumo de cripto">
          <div className="tiles three">
            <div className="tile2"><span className="hl">Investido</span><b data-testid="t-invested"><Money cents={totals.investedCents} /></b></div>
            <div className="tile2"><span className="hl">Valor atual</span><b data-testid="t-now"><Money cents={totals.currentValueCents} /></b></div>
            <div className="tile2"><span className="hl">Rendimento</span><b data-testid="t-gain" className={totals.gainCents < 0 ? 'neg' : 'pos'}>{totals.gainPercent === null ? '—' : pct(totals.gainPercent)}</b></div>
          </div>
        </section>)}
      <div className="holdings">
        {items.map((it) => {
          const coin = coinById(it.coinId);
          return (
            <section className="card holding" key={it.id} data-testid="holding" aria-label={coin ? coin.name : 'Moeda sem seleção'}>
              <header className="h-top"><button className="coin-btn" onClick={() => setPicking(it.id)}><CoinBadge coinId={it.coinId} size={34} /><span><b>{coin ? coin.name : 'Selecione uma moeda'}</b>{coin && <small>{coin.symbol}</small>}</span><Icon name="down" size={16} /></button>
                <button className="icon-btn sm plain" aria-label="Excluir moeda" onClick={() => setDel(it.id)}><Icon name="trash" size={16} /></button></header>
              <div className="two">
                <div className="field"><span className="field-label">Quantidade</span><QuantityField label="Quantidade" value={it.quantity} onCommit={(quantity) => act(() => api.crypto.update(it.id, { quantity }))} /></div>
                <div className="field"><span className="field-label">Preço médio pago (R$)</span><MoneyField className="input mono" label="Preço médio pago" cents={it.buyPriceCents} onCommit={(v) => act(() => api.crypto.update(it.id, { buyPriceCents: v }))} /></div>
              </div>
              {!coin && <p className="muted">Escolha uma moeda acima para acompanhar a cotação.</p>}
              {coin && !it.priceAvailable && <p className="muted">Não foi possível carregar a cotação de {coin.name} agora.</p>}
              {coin && it.priceAvailable && (
                <dl className="stats">
                  <div><dt>Preço atual</dt><dd><Money cents={it.currentPriceCents ?? 0} /></dd></div>
                  <div><dt>Variação 24h</dt><dd className={(it.change24hPercent ?? 0) < 0 ? 'neg' : 'pos'}>{it.change24hPercent === null ? '—' : pct(it.change24hPercent)}</dd></div>
                  <div><dt>Valor atual</dt><dd><Money cents={it.currentValueCents ?? 0} /></dd></div>
                  <div><dt>Rendimento</dt><dd className={(it.gainCents ?? 0) < 0 ? 'neg' : 'pos'}><Money cents={Math.abs(it.gainCents ?? 0)} />{it.gainPercent !== null && ` (${pct(it.gainPercent)})`}</dd></div>
                </dl>)}
            </section>);
        })}
      </div>
      {picking && (
        <Dialog title="Escolher moeda" onClose={() => setPicking(null)}>
          <div className="picker">{COINS.map((c) => <button key={c.id} className="picker-row" onClick={() => { const id = picking; setPicking(null); act(() => api.crypto.update(id, { coinId: c.id })); }}><CoinBadge coinId={c.id} size={32} /><span className="n">{c.name}</span><span className="muted">{c.symbol}</span></button>)}</div>
        </Dialog>)}
      {del && <ConfirmDialog title="Excluir moeda?" text="Esta posição será removida da sua carteira de cripto." confirmLabel="Excluir" onClose={() => setDel(null)} onConfirm={async () => { await api.crypto.remove(del); await qc.invalidateQueries({ queryKey: ['crypto'] }); }} />}
      <p className="muted">Cotações fornecidas pela CoinGecko, podem ter pequeno atraso em relação ao mercado. Isto não é uma recomendação de investimento: criptomoedas têm alta volatilidade e risco.</p>
    </div>
  );
}
