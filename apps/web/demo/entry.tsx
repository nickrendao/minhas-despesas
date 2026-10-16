import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { AgendaScreen } from '@/components/AgendaScreen';
import { AnnualScreen } from '@/components/AnnualScreen';
import { AppShell } from '@/components/AppShell';
import { AuthGate } from '@/components/AuthGate';
import { CardsScreen } from '@/components/CardsScreen';
import { ConfigScreen } from '@/components/ConfigScreen';
import { CryptoScreen } from '@/components/CryptoScreen';
import { ForgotForm } from '@/components/ForgotForm';
import { InvestScreen } from '@/components/InvestScreen';
import { LoginForm } from '@/components/LoginForm';
import { MensalScreen } from '@/components/MensalScreen';
import { SupportScreen } from '@/components/SupportScreen';
import { ApiContext } from '@/lib/api-context';
import { fakeApi } from './fake-api';
import { usePathname } from './shims/router';

function Banner() {
  const [open, setOpen] = useState(true);
  if (!open || window.parent !== window) return null;   // dentro do mostruário (moldura) a faixa é desnecessária
  return (
    <div className="demo-banner" role="note">
      <span><b>PRÉVIA DE DEMONSTRAÇÃO</b> · dados fictícios · nada é salvo (recarregar volta ao início)</span>
      <span><a href="#/login">Ver tela de login</a> · <a href="#/mensal">Voltar ao app</a> <button aria-label="Fechar aviso" onClick={() => setOpen(false)}>✕</button></span>
    </div>
  );
}

function Routes() {
  const path = usePathname();
  if (path === '/login') return <LoginForm login={async () => undefined} />;
  if (path === '/forgot-password') return <ForgotForm />;
  const screens: Record<string, React.ReactNode> = {
    '/mensal': <MensalScreen />, '/cartao': <CardsScreen />, '/anual': <AnnualScreen />, '/agenda': <AgendaScreen />, '/investir': <InvestScreen />,
    '/cripto': <CryptoScreen />, '/apoie': <SupportScreen />,
    '/config': <ConfigScreen onLogout={async () => undefined} changePassword={async () => undefined} deleteAccount={async () => undefined} />,
  };
  return <AuthGate><AppShell onLogout={async () => undefined}>{screens[path] ?? <div className="card">Tela não encontrada.</div>}</AppShell></AuthGate>;
}

/* Mostruário: avisa que está pronto e aceita mudar o tema a pedido da página que o contém. */
const qcRef: { current?: QueryClient } = {};
window.addEventListener('message', async (e) => {
  if (e.data?.fin === 'tutorial') { await fakeApi.me.updateSettings({ tutorialVersion: 0 }); await qcRef.current?.invalidateQueries({ queryKey: ['me'] }); history.replaceState(null, '', location.href.replace('?notutorial', '')); location.reload(); return; }
  if (e.data?.fin !== 'theme' || (e.data.value !== 'light' && e.data.value !== 'dark')) return;
  await fakeApi.me.updateSettings({ theme: e.data.value }); await qcRef.current?.invalidateQueries({ queryKey: ['me'] });
});
const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, refetchOnWindowFocus: false, staleTime: 15_000 } } });
qcRef.current = qc;
if (window.parent !== window) window.parent.postMessage({ fin: 'ready' }, '*');
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}><ApiContext.Provider value={fakeApi}><Banner /><Routes /></ApiContext.Provider></QueryClientProvider>,
);
