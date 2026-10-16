'use client';
import { useEffect, useState } from 'react';
import { centsToInput, parseMoneyInput } from '@/lib/money-input';
import { usePrivacy } from '@/lib/me';

/** Campo de valor: o texto é livre enquanto digita; ao sair, vira centavos (ou volta ao valor anterior se inválido). */
export function MoneyField({ cents, onCommit, label, className = 'amt' }: { cents: number; onCommit: (cents: number) => void; label: string; className?: string }) {
  const { hidden } = usePrivacy();
  const [text, setText] = useState(centsToInput(cents)); const [bad, setBad] = useState(false);
  useEffect(() => { setText(centsToInput(cents)); setBad(false); }, [cents]);
  function commit() {
    const parsed = parseMoneyInput(text);
    if (text.trim() === '') { setBad(false); if (cents !== 0) onCommit(0); return; }
    if (parsed === null) { setBad(true); return; }
    setBad(false); setText(centsToInput(parsed)); if (parsed !== cents) onCommit(parsed);
  }
  if (hidden) return <span className={className} aria-label={label}>••••••</span>;
  return <input className={`${className}${bad ? ' bad' : ''}`} inputMode="decimal" aria-label={label} aria-invalid={bad} placeholder="0,00" value={text}
    onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
}
