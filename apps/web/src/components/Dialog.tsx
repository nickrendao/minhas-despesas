'use client';
import { useEffect, useId, useRef } from 'react';
import { Icon } from './Icon';

/** Janela modal: centralizada no desktop; "folha" que sobe da base no celular. Esc fecha, foco fica preso dentro e volta ao botão de origem. */
export function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null); const id = useId(); const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null; const body = document.body; const overflow = body.style.overflow; body.style.overflow = 'hidden';
    const focusables = () => [...(ref.current?.querySelectorAll<HTMLElement>('input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])') ?? [])].filter((e) => e.offsetParent !== null || e === document.activeElement);
    (ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables().find((e) => e.dataset.close === undefined) ?? ref.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current(); return; }
      if (e.key !== 'Tab') return; const f = focusables(); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); body.style.overflow = overflow; prev?.focus?.(); };
  }, []);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`sheet${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1}>
        <span className="grip" aria-hidden="true" />
        <header className="sheet-head"><h2 id={id}>{title}</h2><button className="icon-btn sm" aria-label="Fechar" data-close="" onClick={onClose}><Icon name="x" size={17} /></button></header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
