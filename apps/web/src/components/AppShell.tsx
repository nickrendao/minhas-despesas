'use client';
import { useIsMutating, useQuery, useQueryClient } from '@tanstack/react-query';
import { TUTORIAL_VERSION, formatBRL } from '@fin/shared';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApi } from '@/lib/api-context';
import { monthLabel } from '@/lib/months';
import { getSelectedYm, setSelectedYm } from '@/lib/month-store';
import { expenseIcon } from '@/lib/expense-icon';
import { NAV, NAV_FOOT, NAV_FOOT_LOCAL } from '@/lib/tabs';

/** No build do app local (NEXT_PUBLIC_APP_MODE=local) o rodapé "Apoie o projeto" nem entra no código final (constante resolvida na compilação). */
const HOSTED_FOOT = process.env.NEXT_PUBLIC_APP_MODE === 'local' ? NAV_FOOT_LOCAL : NAV_FOOT;
import { useMe, usePrivacy } from '@/lib/me';
import { webLogout } from '@/lib/web-api';
import { Dialog } from './Dialog';
import { ExpenseDialog } from './FormDialogs';
import { BrandMark } from './BrandMark';
import { Icon } from './Icon';
import { useAppMode } from '@/lib/app-mode';
import { Tutorial } from './Tutorial';
import { EmptyState, Tile } from './ui';

/* ---------- contexto: ações globais (nova despesa, busca, aviso) ---------- */
interface ShellApi { openQuickAdd: (ym?: string) => void; openSearch: () => void; openTutorial: () => void; toast: (msg: string, action?: { label: string; href: string }) => void }
const Ctx = createContext<ShellApi>({ openQuickAdd: () => undefined, openSearch: () => undefined, openTutorial: () => undefined, toast: () => undefined });
export const useShell = () => useContext(Ctx);

/* ---------- ferramentas do topo: buscar, ocultar valores, tema ---------- */
export function Tools() {
  const { openSearch } = useShell(); const { hidden, toggle } = usePrivacy(); const api = useApi(); const qc = useQueryClient(); const me = useMe();
  const dark = me.data?.settings.theme === 'dark';
  return (
    <div className="tools">
      <button className="search-btn" onClick={openSearch} aria-label="Buscar despesas" title="Buscar despesas ( / )"><Icon name="search" size={18} /><span className="search-text">Buscar despesas</span><kbd>/</kbd></button>
      <button className="icon-btn" onClick={toggle} aria-pressed={hidden} aria-label={hidden ? 'Mostrar valores' : 'Ocultar valores'} title={hidden ? 'Mostrar valores' : 'Ocultar valores'}><Icon name={hidden ? 'eyeOff' : 'eye'} size={18} /></button>
      <button className="icon-btn" aria-label={dark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'} title="Alternar tema"
        onClick={async () => { await api.me.updateSettings({ theme: dark ? 'light' : 'dark' }).catch(() => undefined); await qc.invalidateQueries({ queryKey: ['me'] }); }}><Icon name={dark ? 'sun' : 'moon'} size={18} /></button>
    </div>
  );
}
export function PageHead({ eyebrow, title, actions, tools = true }: { eyebrow?: React.ReactNode; title: string; actions?: React.ReactNode; tools?: boolean }) {
  return (
    <header className="page-head">
      <div className="ph-titles">{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1></div>
      <div className="ph-actions">{tools && <div className="ph-tools"><Tools /></div>}{actions}</div>
    </header>
  );
}

/* ---------- busca em todos os meses ---------- */
function SearchDialog({ onClose }: { onClose: () => void }) {
  const api = useApi(); const router = useRouter(); const [q, setQ] = useState(''); const [dq, setDq] = useState('');
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  const res = useQuery({ queryKey: ['search', dq], enabled: dq.length > 0, queryFn: () => api.expenses.list({ q: dq, limit: 20 }) });
  const items: any[] = res.data?.data ?? [];
  return (
    <Dialog title="Buscar despesas" onClose={onClose} wide>
      <div className="search-box"><Icon name="search" size={18} /><input data-autofocus className="input" aria-label="Buscar despesas por nome" placeholder="Digite o nome da despesa…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="search-results" aria-live="polite">
        {!dq && <p className="muted pad">Procura em todos os meses. Comece a digitar.</p>}
        {dq && res.isLoading && <p className="muted pad">Buscando…</p>}
        {dq && res.isError && <p className="muted pad" role="alert">Não foi possível buscar agora.</p>}
        {dq && res.data && items.length === 0 && <EmptyState icon="search" title="Nada encontrado" text={`Nenhuma despesa com “${dq}”.`} />}
        {items.map((e) => (
          <button key={e.id} className="item" onClick={() => { setSelectedYm(e.ym); router.push('/mensal'); onClose(); }}>
            <Tile name={expenseIcon(e.icon)} color={e.color} /><span className="nm-wrap"><b className="nm">{e.name}</b><span className="sub" style={{ textTransform: 'capitalize' }}>{monthLabel(e.ym)}</span></span><b className="amt">{formatBRL(e.amountCents)}</b>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

/* ---------- menu "Mais" (celular) ---------- */
function MoreSheet({ onClose, onLogout, onSearch }: { onClose: () => void; onLogout: () => void; onSearch: () => void }) {
  const mode = useAppMode();
  const { hidden, toggle } = usePrivacy(); const api = useApi(); const qc = useQueryClient(); const me = useMe(); const dark = me.data?.settings.theme === 'dark';
  const items = [...NAV.filter((n) => !['/mensal', '/cartao', '/anual'].includes(n.href)), ...(mode.local ? NAV_FOOT_LOCAL : HOSTED_FOOT)];
  return (
    <Dialog title="Mais" onClose={onClose}>
      <div className="quick-actions" role="group" aria-label="Ações rápidas">
        <button onClick={() => { onClose(); onSearch(); }}><Icon name="search" size={20} />Buscar</button>
        <button aria-pressed={hidden} onClick={() => { toggle(); onClose(); }}><Icon name={hidden ? 'eyeOff' : 'eye'} size={20} />{hidden ? 'Mostrar valores' : 'Ocultar valores'}</button>
        <button onClick={async () => { await api.me.updateSettings({ theme: dark ? 'light' : 'dark' }).catch(() => undefined); await qc.invalidateQueries({ queryKey: ['me'] }); }}><Icon name={dark ? 'sun' : 'moon'} size={20} />{dark ? 'Tema claro' : 'Tema escuro'}</button>
      </div>
      <div className="more-list">
        {items.map((n) => <Link key={n.href} href={n.href} className="more-item" onClick={onClose}><Tile name={n.icon} color="#009929" /><span><b>{n.label}</b><small>{n.desc}</small></span><Icon name="right" size={17} /></Link>)}
        {!mode.local && <button className="more-item" onClick={onLogout}><Tile name="logout" color="#C2264F" /><span><b>Sair da conta</b><small>Encerrar a sessão neste aparelho</small></span></button>}
      </div>
    </Dialog>
  );
}

export function AppShell({ children, onLogout = webLogout }: { children: React.ReactNode; onLogout?: () => Promise<void> }) {
  const path = usePathname(); const router = useRouter(); const qc = useQueryClient(); const me = useMe(); const saving = useIsMutating() > 0;
  const mode = useAppMode(); const client = useApi(); const [tutorial, setTutorial] = useState(false); const tutorialAuto = useRef(false);
  const [quick, setQuick] = useState<{ ym: string } | null>(null); const [searching, setSearching] = useState(false); const [more, setMore] = useState(false);
  const [msg, setMsg] = useState<{ text: string; action?: { label: string; href: string } } | null>(null); const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toast = useCallback((text: string, action?: { label: string; href: string }) => { setMsg({ text, action }); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(null), 4500); }, []);
  const api = useMemo<ShellApi>(() => ({ openQuickAdd: (ym) => setQuick({ ym: ym ?? getSelectedYm() }), openSearch: () => setSearching(true), openTutorial: () => setTutorial(true), toast }), [toast, me.data?.settings.timezone]);
  // Tutorial de primeiro acesso: aparece UMA vez para quem ainda não viu a versão atual (vale para qualquer aparelho: o "visto" fica na conta)
  useEffect(() => {
    const v = me.data?.settings.tutorialVersion;
    if (!tutorialAuto.current && typeof v === 'number' && v < TUTORIAL_VERSION) { tutorialAuto.current = true; setTutorial(true); }
  }, [me.data]);
  const finishTutorial = useCallback(async () => {
    setTutorial(false);
    try { await client.me.updateSettings({ tutorialVersion: TUTORIAL_VERSION }); await qc.invalidateQueries({ queryKey: ['me'] }); }
    catch { toast('Não conseguimos salvar que você viu o tutorial; ele pode aparecer de novo.'); }
  }, [client, qc, toast]);
  useEffect(() => { setMore(false); }, [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { const t = e.target as HTMLElement; if (e.key === '/' && !e.metaKey && !e.ctrlKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); setSearching(true); } };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, []);
  async function logout() { await onLogout(); qc.clear(); router.replace('/login'); }
  const name = me.data?.settings.displayName || (mode.local ? 'Você' : me.data?.email.split('@')[0]) || ''; const moreActive = ['/agenda', '/investir', '/cripto', '/config', '/apoie'].includes(path);
  const link = (n: { href: string; label: string; icon: string }) => <Link key={n.href} href={n.href} className="side-link" aria-current={path === n.href ? 'page' : undefined}><Icon name={n.icon} />{n.label}</Link>;
  const bl = (href: string, icon: string, label: string) => <Link href={href} className="b-item" aria-current={path === href ? 'page' : undefined}><Icon name={icon} size={22} /><span>{label}</span></Link>;
  return (
    <Ctx.Provider value={api}>
      <div className="app">
        <aside className="sidebar">
          <div className="side-brand"><BrandMark size={38} /><span>Minhas Despesas</span></div>
          <nav aria-label="Principal" className="side-nav">{NAV.map(link)}</nav>
          <nav aria-label="Conta e ajustes" className="side-nav foot">{(mode.local ? NAV_FOOT_LOCAL : HOSTED_FOOT).map(link)}</nav>
          <div className="side-user"><span className="avatar" aria-hidden="true">{(name[0] ?? '?').toUpperCase()}</span><span className="who"><b>{name}</b><small><i className={saving ? 'busy' : ''} />{saving ? 'Salvando…' : 'Tudo salvo'}</small></span>{!mode.local && <button className="icon-btn sm plain" aria-label="Sair da conta" onClick={logout}><Icon name="logout" size={17} /></button>}</div>
        </aside>
        <main className="main" id="conteudo">{children}</main>
        <nav className="bnav" aria-label="Navegação principal (celular)">
          {bl('/mensal', 'calendar', 'Mês')}{bl('/cartao', 'card', 'Cartões')}
          <button className="fab" aria-label="Nova despesa" onClick={() => api.openQuickAdd()}><Icon name="plus" size={26} stroke={2.4} /></button>
          {bl('/anual', 'bars', 'Ano')}
          <button className={`b-item${moreActive ? ' on' : ''}`} aria-haspopup="dialog" aria-label="Mais opções" onClick={() => setMore(true)}><Icon name="grid" size={22} /><span>Mais</span></button>
        </nav>
        {msg && <div className="toast" role="status">{msg.text}{msg.action && <Link href={msg.action.href}>{msg.action.label}</Link>}</div>}
        {quick && <ExpenseDialog ym={quick.ym} onClose={() => setQuick(null)} onDone={(m) => { setSelectedYm(quick.ym); toast(m, path === '/mensal' ? undefined : { label: 'Ver no Mensal', href: '/mensal' }); }} />}
        {tutorial && <Tutorial onFinish={finishTutorial} />}
        {searching && <SearchDialog onClose={() => setSearching(false)} />}
        {more && <MoreSheet onClose={() => setMore(false)} onLogout={logout} onSearch={() => setSearching(true)} />}
      </div>
    </Ctx.Provider>
  );
}
