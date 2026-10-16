'use client';
import { formatBRL } from '@fin/shared';
import { Children, cloneElement, isValidElement, useId } from 'react';
import { usePrivacy } from '@/lib/me';
import { Icon } from './Icon';

/** Valor em destaque: "R$ 2.681" grande e ",45" pequeno. Oculta quando "ocultar valores" está ativo. */
export function BigMoney({ cents, className = '', testId }: { cents: number; className?: string; testId?: string }) {
  const { hidden } = usePrivacy();
  const s = formatBRL(cents).replace(/\u00a0/g, ' '); const i = s.lastIndexOf(',');
  return <div className={`bigmoney ${className}`} data-testid={testId}>{hidden ? '••••••' : <>{s.slice(0, i)}<small>{s.slice(i)}</small></>}</div>;
}
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} aria-disabled={disabled || undefined} disabled={disabled} className="switch" onClick={() => onChange(!checked)}><span /></button>;
}
export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return <div className="segmented" role="group" aria-label={label}>{options.map((o) => <button key={String(o.v)} type="button" aria-pressed={o.v === value} onClick={() => onChange(o.v)}>{o.label}</button>)}</div>;
}
export function Field({ label, error, hint, children }: { label: string; error?: string | null; hint?: string; children: React.ReactNode }) {
  const id = useId(); const msg = `${id}-msg`; const has = !!(error || hint);
  /* o rótulo se liga ao campo por for/id; ajuda e erro por aria-describedby (não entram no nome do campo) */
  const wired = Children.map(children, (c) => (isValidElement(c) && (c.type === 'input' || c.type === 'select') ? cloneElement(c as React.ReactElement<any>, { id, 'aria-describedby': has ? msg : undefined, 'aria-invalid': error ? true : (c.props as any)['aria-invalid'] }) : c));
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="field-control">{wired}</div>
      {error ? <span id={msg} className="field-error" role="alert">{error}</span> : hint ? <span id={msg} className="field-hint">{hint}</span> : null}
    </div>
  );
}
/** Barra segmentada: cada trecho é uma despesa (largura = % da renda). O que sobra é "livre". */
export function SegBar({ parts, label }: { parts: { id: string; name: string; pct: number; color: string }[]; label: string }) {
  const tones = ['#14150D', '#2E3120', '#474A36', '#5C5F48'];
  return <div className="segbar" role="img" aria-label={label}>{parts.filter((p) => p.pct > 0.3).map((p, i) => <i key={p.id} title={p.name} style={{ width: `${p.pct}%`, ['--c' as any]: p.color, ['--tone' as any]: tones[i % tones.length] }} />)}</div>;
}
export function InstallmentDots({ current, total }: { current: number; total: number }) {
  const n = Math.min(total, 12);
  return <span className="dots" role="img" aria-label={`Parcela ${current} de ${total}`}>{Array.from({ length: n }, (_, i) => <i key={i} className={i < Math.round((current / total) * n) ? 'on' : ''} />)}</span>;
}
export function Tile({ name, color, icon }: { name: string; color: string; icon?: string }) {
  return <span className="tile-ico" style={{ ['--c' as any]: color }} aria-hidden="true"><Icon name={name} size={icon ? 20 : 20} /></span>;
}
export function EmptyState({ icon = 'receipt', title, text, action }: { icon?: string; title: string; text?: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-ico" aria-hidden="true"><Icon name={icon} size={22} /></span><b>{title}</b>{text && <p>{text}</p>}{action}</div>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="error-state" role="alert"><Icon name="alert" size={20} /><div><b>Não foi possível carregar</b><p>{message}</p></div>{onRetry && <button className="btn sm" onClick={onRetry}>Tentar novamente</button>}</div>;
}
export function Skeleton({ h = 120, n = 1 }: { h?: number; n?: number }) {
  return <div aria-busy="true" aria-label="Carregando">{Array.from({ length: n }, (_, i) => <div key={i} className="skeleton" style={{ height: h }} />)}</div>;
}
