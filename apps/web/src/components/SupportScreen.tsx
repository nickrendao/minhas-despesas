'use client';
import { useState } from 'react';
import { APP_VERSION, FEEDBACK_EMAIL, PIX_KEY, PIX_KEY_DISPLAY } from '@/lib/support';
import { PageHead, useShell } from './AppShell';
import { Icon } from './Icon';

/** Tela de apoio da plataforma hospedada. O bloco Pix só existe se a chave for configurada (NEXT_PUBLIC_PIX_KEY). */
export function SupportScreen() {
  const shell = useShell(); const [copied, setCopied] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(PIX_KEY); setCopied(true); shell.toast('Chave Pix copiada.'); setTimeout(() => setCopied(false), 2500); } catch { shell.toast(`Copie manualmente: ${PIX_KEY_DISPLAY}`); } }
  return (
    <div className="support">
      <PageHead title="Apoie o projeto" eyebrow={PIX_KEY ? 'Curtiu o app? Ajude a mantê-lo gratuito.' : 'Obrigado por usar o app.'} />
      <section className="card support-card">
        <span className="empty-ico big" aria-hidden="true"><Icon name="heart" size={26} /></span>
        <h2>Obrigado por usar o Minhas Despesas</h2>
        <p className="muted">O app é gratuito e feito com carinho.{PIX_KEY ? ' Se ele ajuda você, qualquer valor via Pix ajuda a mantê-lo no ar.' : ''}{FEEDBACK_EMAIL ? ' Você também pode mandar sugestões e erros por e-mail.' : ''}</p>
        {PIX_KEY && <div className="pix"><span className="muted">Chave Pix</span><b className="mono">{PIX_KEY_DISPLAY}</b></div>}
        <div className="row-actions">
          {PIX_KEY && <button className="btn" onClick={copy}><Icon name={copied ? 'check' : 'copy'} size={17} />{copied ? 'Copiada!' : 'Copiar chave Pix'}</button>}
          {FEEDBACK_EMAIL && <a className="btn ghost" href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Feedback — Minhas Despesas')}`}><Icon name="mail" size={17} />Enviar feedback</a>}
        </div>
        <p className="muted">Versão {APP_VERSION}</p>
      </section>
    </div>
  );
}
