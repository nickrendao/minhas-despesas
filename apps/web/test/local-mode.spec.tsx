import { TextEncoder } from 'util';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '@/components/AppShell';
import { ConfigScreen } from '@/components/ConfigScreen';
import { CryptoScreen } from '@/components/CryptoScreen';
import { MensalScreen } from '@/components/MensalScreen';
import { ApiContext } from '@/lib/api-context';
import { AppModeProvider } from '@/lib/app-mode';
import { PrivacyProvider } from '@/lib/me';
import { browserStore, LocalBackend, Store } from '../local/local-api';

(global as any).TextEncoder = (global as any).TextEncoder ?? TextEncoder;
const downloads: { name: string; content: string }[] = [];
jest.mock('@/lib/exports', () => ({ ...jest.requireActual('@/lib/exports'), download: (name: string, content: string) => { downloads.push({ name, content }); } }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }), usePathname: () => '/mensal' }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...r }: any) => require('react').createElement('a', { href, ...r }, children) }));

class MemStore implements Store { v: string | null = null; read() { return this.v; } write(x: string) { this.v = x; } clear() { this.v = null; } }
async function mount(ui: React.ReactElement, o: { store?: MemStore; fetchImpl?: any } = {}) {
  const store = o.store ?? new MemStore(); const backend = new LocalBackend(store, { fetchImpl: o.fetchImpl }); const me = await backend.me.get();
  const mode = { local: true, importBackup: (j: unknown) => backend.me.importBackup(j).then(() => undefined), resetAll: () => backend.me.resetAll().then(() => undefined) };
  const view = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ApiContext.Provider value={backend as any}><AppModeProvider value={mode}><PrivacyProvider me={me as any}><AppShell>{ui}</AppShell></PrivacyProvider></AppModeProvider></ApiContext.Provider></QueryClientProvider>);
  return { backend, store, ...view };
}
const dialog = (name: string | RegExp) => screen.findByRole('dialog', { name });
const skipTutorial = async () => { await userEvent.click(within(await dialog(/Bem-vindo/)).getByRole('button', { name: 'Pular tutorial' })); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); };

describe('app local: primeiro uso, do zero', () => {
  it('abre VAZIO, com o tutorial; nada de "demonstração", "sair da conta" ou dados de exemplo', async () => {
    await mount(<MensalScreen initialYm="2026-10" />); await dialog(/Bem-vindo/);
    expect(document.body.textContent).not.toMatch(/DEMONSTRAÇÃO|dados fictícios|Sair da conta|Entrar/); await skipTutorial();
    expect((await screen.findByTestId('balance')).textContent).toMatch(/R\$\s?0,00/); expect(screen.getByText('Nenhuma renda neste mês')).toBeInTheDocument(); expect(screen.getByText('Nenhuma despesa fixa')).toBeInTheDocument(); expect(screen.getByText('Nenhuma despesa variável')).toBeInTheDocument();
    expect(screen.queryByTestId('principal-pill')).not.toBeInTheDocument(); expect(screen.getByText('Nada vencendo por agora')).toBeInTheDocument(); expect(screen.getByText('Sem gastos ainda')).toBeInTheDocument();
  });
  it('o último passo do tutorial fala em backup (os dados ficam só no aparelho)', async () => {
    await mount(<MensalScreen initialYm="2026-10" />); for (let i = 0; i < 5; i++) await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Próximo/ })); expect((await dialog('Sua privacidade, do seu jeito')).textContent).toMatch(/só neste aparelho.*backup/);
  });
  it('pular o tutorial grava na conta local e ele não volta ao reabrir o app', async () => {
    const store = new MemStore(); const a = await mount(<MensalScreen initialYm="2026-10" />, { store }); await skipTutorial(); await waitFor(() => expect(JSON.parse(store.v!).settings.tutorialVersion).toBe(1)); a.unmount();
    await mount(<MensalScreen initialYm="2026-10" />, { store }); await screen.findByTestId('balance'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('menu "Mais" no celular não oferece "Sair da conta" e a barra lateral não tem o botão de sair', async () => {
    const m = await mount(<MensalScreen initialYm="2026-10" />); await skipTutorial(); await userEvent.click(screen.getByRole('button', { name: 'Mais opções' })); const d = await dialog('Mais'); expect(within(d).queryByText(/Sair da conta/)).not.toBeInTheDocument(); expect(within(d).getByRole('link', { name: /Cripto/ })).toBeInTheDocument();
    expect(within(d).getByRole('link', { name: /Sobre e ajuda/ })).toHaveAttribute('href', '/sobre'); expect(within(d).queryByText(/Apoie|Pix/i)).not.toBeInTheDocument();   // sem doações no app local
    expect(m.container.querySelector('.side-nav.foot')?.textContent).toMatch(/Sobre e ajuda/); expect(m.container.querySelector('.side-nav.foot')?.textContent).not.toMatch(/Apoie|Pix/i);
    expect(m.container.querySelector('.side-user')?.textContent).toMatch(/Você/); expect(m.container.querySelector('.side-user button')).toBeNull();
  });
});

describe('app local: usar à vontade (UI ↔ servidor local de verdade)', () => {
  it('registra renda, despesa com ícone e vencimento; o resumo calcula; tudo persiste ao reabrir', async () => {
    const store = new MemStore(); const a = await mount(<MensalScreen initialYm="2026-10" />, { store }); await skipTutorial(); await screen.findByTestId('balance');
    await userEvent.click(screen.getByRole('button', { name: /Nova renda/ })); let d = await dialog('Nova renda'); await userEvent.type(within(d).getByLabelText('Nome'), 'Salário'); await userEvent.type(within(d).getByLabelText('Valor (R$)'), '5.000'); await userEvent.click(within(d).getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(screen.getByTestId('income').textContent).toMatch(/5\.000,00/)); expect(await screen.findByTestId('principal-pill')).toHaveTextContent('Salário');
    await userEvent.click(screen.getAllByRole('button', { name: /Nova despesa/ })[0]); d = await dialog('Nova despesa'); await userEvent.type(within(d).getByLabelText('Nome'), 'Aluguel'); await userEvent.type(within(d).getByLabelText('Valor (R$)'), '1.500,50'); await userEvent.type(within(d).getByLabelText('Vence no dia'), '5');
    await userEvent.click(within(d).getByRole('button', { name: /Toque para trocar/ })); await userEvent.click(within(d).getByRole('button', { name: 'Moradia' })); await userEvent.click(within(d).getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(screen.getByTestId('expenses').textContent).toMatch(/1\.500,50/)); expect(screen.getByTestId('balance').textContent).toMatch(/3\.499,50/); a.unmount();
    await mount(<MensalScreen initialYm="2026-10" />, { store }); expect((await screen.findByTestId('balance')).textContent).toMatch(/3\.499,50/); expect(screen.getByRole('button', { name: 'Editar despesa Aluguel' })).toBeInTheDocument();
  });
  it('PIN local: ocultar → mostrar exige o PIN certo', async () => {
    const m = await mount(<MensalScreen initialYm="2026-10" />); await skipTutorial(); await m.backend.me.setPin('4821'); await m.backend.me.updateSettings({ privacyMode: true }); m.unmount();
    await mount(<MensalScreen initialYm="2026-10" />, { store: m.store }); expect(await screen.findByTestId('balance')).toHaveTextContent('••••••'); await userEvent.click(screen.getAllByRole('button', { name: 'Mostrar valores' })[0]); const d = await dialog('Digite seu PIN');
    await userEvent.type(within(d).getByLabelText('PIN'), '0000'); await userEvent.click(within(d).getByRole('button', { name: 'Mostrar valores' })); expect(await within(d).findByRole('alert')).toHaveTextContent('PIN incorreto'); await userEvent.clear(within(d).getByLabelText('PIN')); await userEvent.type(within(d).getByLabelText('PIN'), '4821'); await userEvent.click(within(d).getByRole('button', { name: 'Mostrar valores' }));
    await waitFor(() => expect(screen.getByTestId('balance').textContent).toMatch(/R\$\s?0,00/));
  });
  it('CRIPTO: mostra a cotação vinda da internet e, se a internet cair, o último valor com o horário antigo', async () => {
    let up = true; const f = jest.fn(async () => { if (!up) throw new Error('offline'); return { ok: true, json: async () => ({ bitcoin: { brl: 300000, brl_24h_change: 1.2 } }) }; });
    const m = await mount(<CryptoScreen refreshMs={60000} />, { fetchImpl: f }); await skipTutorial(); await m.backend.crypto.create({ coinId: 'bitcoin', quantity: '0.5', buyPriceCents: 20000000 });
    await act(async () => { await m.backend.crypto.valuation(); }); m.unmount(); const v = await mount(<CryptoScreen refreshMs={60000} />, { store: m.store, fetchImpl: f }); expect((await screen.findByTestId('t-now')).textContent).toMatch(/150\.000,00/); expect(screen.getByText('+1,20%')).toBeInTheDocument(); void v;
    up = false; const off = await mount(<CryptoScreen refreshMs={60000} />, { store: m.store, fetchImpl: f }); void off; await waitFor(() => expect(screen.getAllByTestId('t-now').length).toBeGreaterThan(0));
  });
});

describe('app local: Configurações, backup e apagar tudo', () => {
  const cfg = async (store?: MemStore) => { const m = await mount(<ConfigScreen />, { store }); await skipTutorial(); await screen.findByRole('region', { name: 'Seus dados' }); return m; };
  it('mostra o que importa no celular e esconde o que só existe com conta (senha, sair, excluir conta)', async () => {
    await cfg(); expect(screen.getByText('Seus dados ficam só neste aparelho.')).toBeInTheDocument(); expect(screen.queryByRole('region', { name: 'Segurança' })).not.toBeInTheDocument(); expect(document.body.textContent).not.toMatch(/Excluir minha conta|Alterar senha|Senha atual/);
    expect(screen.getByTestId('last-backup')).toHaveTextContent('ainda não feito'); for (const n of ['Baixar backup completo', 'Restaurar backup', 'Apagar todos os dados']) expect(screen.getByRole('button', { name: new RegExp(n) })).toBeInTheDocument();
  });
  it('baixar backup: arquivo JSON do app local e "último backup" passa a ter data', async () => {
    downloads.length = 0; const m = await cfg(); await m.backend.expenses.create({ ym: '2026-10', name: 'Aluguel', amountCents: 150000 }); await userEvent.click(screen.getByRole('button', { name: /Baixar backup completo/ }));
    await waitFor(() => expect(downloads).toHaveLength(1)); expect(downloads[0].name).toBe('minhas-despesas-backup.json'); expect(JSON.parse(downloads[0].content)).toMatchObject({ app: 'minhas-despesas-local', version: 1 }); expect(downloads[0].content).toContain('Aluguel');
    await waitFor(() => expect(screen.getByTestId('last-backup')).not.toHaveTextContent('ainda não feito')); expect(await screen.findByRole('status')).toHaveTextContent('Backup baixado.');
  });
  it('restaurar: cola o backup (ou escolhe o arquivo) e os dados são substituídos; inválido mostra erro claro', async () => {
    const src = new LocalBackend(new MemStore()); await src.expenses.create({ ym: '2026-10', name: 'Do outro celular', amountCents: 777 }); const file = JSON.stringify(await src.me.export());
    const m = await cfg(); await m.backend.expenses.create({ ym: '2026-10', name: 'Vai sumir', amountCents: 1 });
    await userEvent.click(screen.getByRole('button', { name: /Restaurar backup/ })); let d = await dialog('Restaurar backup'); expect(within(d).getByText(/substitui todos os dados atuais/)).toBeInTheDocument(); expect(within(d).getByRole('button', { name: 'Restaurar' })).toBeDisabled();
    const ta = within(d).getByLabelText('Conteúdo do backup'); await userEvent.click(ta); await userEvent.paste('{lixo'); await userEvent.click(within(d).getByRole('button', { name: 'Restaurar' })); expect(await within(d).findByRole('alert')).toHaveTextContent('não é JSON');
    await userEvent.clear(ta); await userEvent.click(ta); await userEvent.paste('{"app":"outro"}'); await userEvent.click(within(d).getByRole('button', { name: 'Restaurar' })); expect(await within(d).findByRole('alert')).toHaveTextContent('não parece um backup válido');
    await userEvent.upload(within(d).getByLabelText('Arquivo de backup'), new File([file], 'backup.json', { type: 'application/json' })); expect(await within(d).findByText('backup.json')).toBeInTheDocument(); await userEvent.click(within(d).getByRole('button', { name: 'Restaurar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect((await m.backend.months.open('2026-10')).expenses.map((e: any) => e.name)).toEqual(['Do outro celular']); expect(await screen.findByRole('status')).toHaveTextContent('Backup restaurado.'); void d;
  });
  it('apagar tudo: pede confirmação, limpa o aparelho e recarrega o app (que volta ao zero)', async () => {
    const reload = jest.fn(); const orig = window.location; delete (window as any).location; (window as any).location = { ...orig, reload, hash: '' };
    const m = await cfg(); await m.backend.incomes.create({ ym: '2026-10', name: 'Salário', amountCents: 1 }); await userEvent.click(screen.getByRole('button', { name: /Apagar todos os dados/ })); const d = await dialog('Apagar todos os dados?'); expect(d.textContent).toMatch(/Não dá para desfazer/);
    await userEvent.click(within(d).getByRole('button', { name: 'Cancelar' })); expect((await m.backend.months.open('2026-10')).incomes).toHaveLength(1); expect(reload).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Apagar todos os dados/ })); await userEvent.click(within(await dialog('Apagar todos os dados?')).getByRole('button', { name: 'Apagar tudo' }));
    await waitFor(() => expect(reload).toHaveBeenCalled()); expect(m.store.v).toBeNull(); expect((await m.backend.months.open('2026-10')).incomes).toEqual([]); (window as any).location = orig;
  });
});
