import './zod-jitless';   // PRIMEIRO (antes de qualquer esquema do Zod existir)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { AgendaScreen } from '@/components/AgendaScreen';
import { AnnualScreen } from '@/components/AnnualScreen';
import { AppShell } from '@/components/AppShell';
import { AuthGate } from '@/components/AuthGate';
import { CardsScreen } from '@/components/CardsScreen';
import { ConfigScreen } from '@/components/ConfigScreen';
import { CryptoScreen } from '@/components/CryptoScreen';
import { InvestScreen } from '@/components/InvestScreen';
import { MensalScreen } from '@/components/MensalScreen';
import { InstallHint } from '@/components/InstallHint';
import { AboutScreen } from '@/components/AboutScreen';
import { ApiContext } from '@/lib/api-context';
import { AppModeProvider } from '@/lib/app-mode';
import { browserStore, LocalBackend } from './local-api';
import { usePathname } from '../demo/shims/router';

/* App instalado no celular: sem servidor, sem login. Os dados ficam no aparelho (LocalBackend). Começa 100% vazio. */
const backend = new LocalBackend(browserStore());
const mode = { local: true, importBackup: (j: unknown) => backend.me.importBackup(j).then(() => undefined), resetAll: () => backend.me.resetAll().then(() => undefined) };
const noop = async () => undefined;
// pede ao navegador para NÃO apagar os dados automaticamente quando faltar espaço (no iPhone/Chrome; no Android nativo não faz diferença)
try { void navigator.storage?.persist?.(); } catch { /* sem suporte */ }

function Routes() {
  const path = usePathname();
  const screens: Record<string, React.ReactNode> = {
    '/mensal': <MensalScreen />, '/cartao': <CardsScreen />, '/anual': <AnnualScreen />, '/agenda': <AgendaScreen />, '/investir': <InvestScreen />, '/cripto': <CryptoScreen />,
    '/config': <ConfigScreen onLogout={noop} changePassword={noop} deleteAccount={noop} />, '/sobre': <AboutScreen />,
  };
  return <AuthGate><AppShell onLogout={noop}>{screens[path] ?? <MensalScreen />}</AppShell></AuthGate>;
}
const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, refetchOnWindowFocus: false, staleTime: 5_000 } } });
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}><ApiContext.Provider value={backend as any}><AppModeProvider value={mode}><Routes /><InstallHint /></AppModeProvider></ApiContext.Provider></QueryClientProvider>,
);
