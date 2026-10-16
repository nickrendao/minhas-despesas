'use client';
import { useState } from 'react';
import { canInstallPwa, isIOS, isStandalone } from '@/lib/platform';
import { Icon } from './Icon';

const KEY = 'md.hint.ios';
/** Só no Safari do iPhone/iPad, fora do app instalado: ensina o caminho "Adicionar à Tela de Início" (o iOS não oferece botão de instalar). Some para sempre ao dispensar. */
export function InstallHint({ loc = typeof location !== 'undefined' ? location : undefined, ios = isIOS(), standalone = isStandalone() }: { loc?: { protocol: string; hostname: string }; ios?: boolean; standalone?: boolean }) {
  const [hidden, setHidden] = useState(() => { try { return !!localStorage.getItem(KEY); } catch { return false; } });
  if (hidden || !loc || !ios || standalone || !canInstallPwa(loc)) return null;
  const dismiss = () => { try { localStorage.setItem(KEY, '1'); } catch { /* sem armazenamento: some só desta vez */ } setHidden(true); };
  return (
    <aside className="install-hint" role="note" aria-label="Como instalar no iPhone">
      <span className="ih-ico" aria-hidden="true"><Icon name="share" size={20} /></span>
      <p><b>Instale no seu iPhone:</b> toque em <b>Compartilhar</b> <Icon name="share" size={14} /> e depois em <b>Adicionar à Tela de Início</b>. Assim o app abre em tela cheia e funciona offline.</p>
      <button className="btn sm" onClick={dismiss}>Entendi</button>
    </aside>
  );
}
