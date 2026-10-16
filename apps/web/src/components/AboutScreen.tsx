'use client';
import { APP_VERSION, FEEDBACK_EMAIL, PRIVACY_URL, SOURCE_URL } from '@/lib/support';
import { PageHead, useShell } from './AppShell';
import { Icon } from './Icon';

/** "Sobre e ajuda" do app local (Android/PWA). Sem doações: só versão, tutorial, feedback, política de privacidade e código-fonte. */
export function AboutScreen() {
  const shell = useShell();
  return (
    <div className="support">
      <PageHead title="Sobre e ajuda" eyebrow={`Versão ${APP_VERSION}`} />
      <section className="card support-card">
        <span className="empty-ico big" aria-hidden="true"><Icon name="help" size={26} /></span>
        <h2>Minhas Despesas</h2>
        <p className="muted">Gratuito e sem anúncios. Seus dados ficam <b>só neste aparelho</b>: não há conta, servidor nem rastreamento. A única conexão com a internet é a cotação das criptomoedas.</p>
        <div className="row-actions">
          <button className="btn" onClick={shell.openTutorial}><Icon name="help" size={17} />Rever o tutorial</button>
          {FEEDBACK_EMAIL && <a className="btn ghost" href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Feedback — Minhas Despesas')}`}><Icon name="mail" size={17} />Enviar feedback</a>}
          {PRIVACY_URL && <a className="btn ghost" href={PRIVACY_URL} target="_blank" rel="noopener noreferrer"><Icon name="lock" size={17} />Política de privacidade</a>}
          {SOURCE_URL && <a className="btn ghost" href={SOURCE_URL} target="_blank" rel="noopener noreferrer"><Icon name="download" size={17} />Código-fonte</a>}
        </div>
      </section>
    </div>
  );
}
