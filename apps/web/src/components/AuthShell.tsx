import { BrandMark } from './BrandMark';
/** Moldura das telas simples de acesso (esqueci senha, redefinir, confirmar e-mail). */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <main className="auth-page single">
      <section className="auth-card">
        <div className="auth-brand"><BrandMark size={44} /><span>Minhas Despesas</span></div>
        <h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}
        {children}
      </section>
    </main>
  );
}
