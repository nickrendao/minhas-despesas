import { ApiError } from '@fin/api-client';
import { TUTORIAL_VERSION } from '@fin/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigScreen } from '@/components/ConfigScreen';
import { MensalScreen } from '@/components/MensalScreen';
import { expenseIcon, iconLabel } from '@/lib/expense-icon';
import { EXPENSE_ICONS } from '@/components/Icon';
import { exp, fakeApi, inc, renderApp } from './helpers';

jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: require('./helpers').replace, push: require('./helpers').push }), usePathname: () => '/mensal' }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...r }: any) => require('react').createElement('a', { href, ...r }, children) }));
const dialog = (name: string | RegExp) => screen.findByRole('dialog', { name });
const mensal = (over: any = {}, settings: any = {}) => renderApp(<MensalScreen initialYm="2026-10" />, fakeApi({ ...over, settings }), { settings });

describe('1) Tutorial de primeiro acesso', () => {
  const novo = { tutorialVersion: 0 };
  it('aparece para quem ainda não viu e percorre os 6 passos na ordem', async () => {
    mensal({}, novo); const titles = ['Bem-vindo(a) ao Minhas Despesas', 'Comece pelas suas rendas', 'Lance suas despesas', 'Cartões de crédito', 'Acompanhe o mês', 'Sua privacidade, do seu jeito'];
    for (let i = 0; i < titles.length; i++) {
      const d = await dialog(titles[i]); expect(within(d).getByText(`Passo ${i + 1} de 6`)).toBeInTheDocument();
      if (i < 5) await userEvent.click(within(d).getByRole('button', { name: /Próximo/ }));
    }
    expect(screen.queryByRole('button', { name: 'Pular tutorial' })).not.toBeInTheDocument();     // no último passo não há "pular": só concluir
  });
  it('"Começar a usar" no último passo grava a versão atual na conta e fecha', async () => {
    const api = fakeApi({ settings: novo }); renderApp(<MensalScreen initialYm="2026-10" />, api, { settings: novo });
    for (let i = 0; i < 5; i++) await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Próximo/ }));
    await userEvent.click(within(await dialog('Sua privacidade, do seu jeito')).getByRole('button', { name: 'Começar a usar' }));
    await waitFor(() => expect(api.me.updateSettings).toHaveBeenCalledWith({ tutorialVersion: TUTORIAL_VERSION })); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('pular e Esc contam como "visto" (não volta a incomodar)', async () => {
    const api = fakeApi({ settings: novo }); const { unmount } = renderApp(<MensalScreen initialYm="2026-10" />, api, { settings: novo });
    await userEvent.click(within(await dialog(/Bem-vindo/)).getByRole('button', { name: 'Pular tutorial' })); await waitFor(() => expect(api.me.updateSettings).toHaveBeenCalledWith({ tutorialVersion: 1 })); unmount();
    const api2 = fakeApi({ settings: novo }); renderApp(<MensalScreen initialYm="2026-10" />, api2, { settings: novo }); await dialog(/Bem-vindo/); await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(api2.me.updateSettings).toHaveBeenCalledWith({ tutorialVersion: 1 }));
  });
  it('NÃO aparece para quem já viu a versão atual, nem quando o servidor não informa a versão', async () => {
    const { unmount } = mensal({}, { tutorialVersion: TUTORIAL_VERSION }); await screen.findByTestId('balance'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); unmount();
    mensal({}, {}); await screen.findByTestId('balance'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('uma versão FUTURA do tutorial volta a aparecer para quem só viu a anterior (tutorialVersion < atual)', async () => {
    expect(TUTORIAL_VERSION).toBeGreaterThanOrEqual(1); mensal({}, { tutorialVersion: TUTORIAL_VERSION - 1 }); expect(await dialog(/Bem-vindo/)).toBeInTheDocument();
  });
  it('mostra uma vez só: depois de fechado não reabre sozinho, mesmo que a conta seja relida', async () => {
    const api = fakeApi({ settings: novo }); renderApp(<MensalScreen initialYm="2026-10" />, api, { settings: novo });
    await userEvent.click(within(await dialog(/Bem-vindo/)).getByRole('button', { name: 'Pular tutorial' })); await screen.findByTestId('balance'); await new Promise((r) => setTimeout(r, 150));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(api.me.get.mock.calls.length).toBeGreaterThan(1);
  });
  it('navegação: Voltar, setas do teclado e primeiro passo sem "Voltar"', async () => {
    mensal({}, novo); const d = await dialog(/Bem-vindo/); expect(within(d).getByRole('button', { name: 'Voltar' })).toBeDisabled();
    await userEvent.click(within(d).getByRole('button', { name: /Próximo/ })); const d2 = await dialog('Comece pelas suas rendas'); await userEvent.click(within(d2).getByRole('button', { name: 'Voltar' })); await dialog(/Bem-vindo/);
    await userEvent.keyboard('{ArrowRight}'); await dialog('Comece pelas suas rendas'); await userEvent.keyboard('{ArrowLeft}'); await dialog(/Bem-vindo/);
  });
  it('as figuras do tutorial não contêm valores em reais (não podem parecer dados da pessoa)', async () => {
    mensal({}, novo); for (let i = 0; i < 6; i++) { const d = await screen.findByRole('dialog'); expect(d.textContent).not.toMatch(/R\$\s?\d/); if (i < 5) await userEvent.click(within(d).getByRole('button', { name: /Próximo/ })); }
  });
  it('falha ao salvar: avisa e fecha (não prende a pessoa no tutorial)', async () => {
    const api = fakeApi({ settings: novo }); api.me.updateSettings.mockRejectedValue(new ApiError(502, 'API_UNAVAILABLE', 'x')); renderApp(<MensalScreen initialYm="2026-10" />, api, { settings: novo });
    await userEvent.click(within(await dialog(/Bem-vindo/)).getByRole('button', { name: 'Pular tutorial' })); expect(await screen.findByRole('status')).toHaveTextContent('pode aparecer de novo'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('"Rever o tutorial" em Configurações reabre mesmo para quem já viu', async () => {
    const s = { tutorialVersion: TUTORIAL_VERSION }; renderApp(<ConfigScreen />, fakeApi({ settings: s }), { settings: s });
    await userEvent.click(await screen.findByRole('button', { name: /Rever o tutorial/ })); expect(await dialog(/Bem-vindo/)).toBeInTheDocument();
  });
});

describe('2) Ícone e cor da despesa (identidade visual do site)', () => {
  const openEdit = async (name: string) => { await userEvent.click(await screen.findByRole('button', { name: `Editar despesa ${name}` })); return dialog('Editar despesa'); };
  it('o seletor oferece só ícones da família do site, todos com nome acessível, e um único marcado', async () => {
    mensal(); const d = await openEdit('Mercado'); const toggle = within(d).getByRole('button', { name: /Toque para trocar/ }); expect(toggle).toHaveAttribute('aria-expanded', 'false'); await userEvent.click(toggle); expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const grid = within(d).getByRole('group', { name: 'Ícone' }); const btns = within(grid).getAllByRole('button'); expect(btns).toHaveLength(EXPENSE_ICONS.length);
    for (const b of btns) { expect(b).toHaveAccessibleName(); expect(b.querySelector('svg')).toBeTruthy(); }     // ícone de linha (SVG), nunca emoji
    expect(btns.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1); expect(within(d).getByRole('button', { name: 'Geral' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('trocar ícone e cor envia as chaves novas (e só elas) ao salvar', async () => {
    const { api } = mensal(); const d = await openEdit('Mercado'); await userEvent.click(within(d).getByRole('button', { name: /Toque para trocar/ }));
    await userEvent.click(within(d).getByRole('button', { name: 'Moradia' })); await userEvent.click(within(d).getByRole('button', { name: 'Cor #B85C38' })); await userEvent.click(within(d).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.expenses.update).toHaveBeenCalledWith('e2', { name: 'Mercado', amountCents: 80000, recurring: false, dueDay: null, installmentCurrent: null, installmentTotal: null, icon: 'home', color: '#B85C38' }));
  });
  it('sem mexer no ícone/cor, eles NÃO são enviados (não troca o emoji antigo em silêncio)', async () => {
    const { api } = mensal(); const d = await openEdit('Mercado'); await userEvent.type(within(d).getByLabelText('Nome'), ' novo'); await userEvent.click(within(d).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.expenses.update).toHaveBeenCalled()); const body = api.expenses.update.mock.calls[0][1]; expect(body).not.toHaveProperty('icon'); expect(body).not.toHaveProperty('color');
  });
  it('emoji antigo aparece como o ícone de linha equivalente', async () => {
    mensal({ state: { incomes: [], expenses: [exp('e9', 'Aluguel', 1, true, 5, { icon: '🏠' })] } }); const d = await openEdit('Aluguel'); expect(within(d).getByRole('button', { name: /Toque para trocar/ })).toHaveTextContent('Moradia');
  });
  it('nova despesa: padrão "Geral" + cor padrão; escolher "Viagem" envia plane', async () => {
    const { api } = mensal(); await userEvent.click(screen.getAllByRole('button', { name: /Nova despesa/ })[0]); const d = await dialog('Nova despesa');
    await userEvent.type(within(d).getByLabelText('Nome'), 'Passagem'); await userEvent.type(within(d).getByLabelText('Valor (R$)'), '500'); await userEvent.click(within(d).getByRole('button', { name: /Toque para trocar/ })); await userEvent.click(within(d).getByRole('button', { name: 'Viagem' }));
    await userEvent.click(within(d).getByRole('button', { name: 'Adicionar' })); await waitFor(() => expect(api.expenses.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Passagem', icon: 'plane', color: '#3B6B8C' })));
  });
  it('mapeamento: chave passa direto, emoji antigo vira ícone, desconhecido vira "Geral"', () => {
    expect(expenseIcon('home')).toBe('home'); expect(expenseIcon('🏠')).toBe('home'); expect(expenseIcon('🥖')).toBe('utensils'); expect(expenseIcon('🧾')).toBe('receipt');
    expect(expenseIcon('🦄')).toBe('receipt'); expect(expenseIcon('')).toBe('receipt'); expect(expenseIcon(null)).toBe('receipt'); expect(expenseIcon('chave-que-nao-existe')).toBe('receipt');
    expect(iconLabel('plane')).toBe('Viagem'); expect(new Set(EXPENSE_ICONS.map((i) => i.id)).size).toBe(EXPENSE_ICONS.length); expect(EXPENSE_ICONS.every((i) => i.id.length <= 24)).toBe(true);
  });
  it('o ícone escolhido aparece na lista da tela Mensal', async () => {
    mensal({ state: { incomes: [], expenses: [exp('e9', 'Internet', 9990, true, 10, { icon: 'wifi', color: '#1F6F54' })] } }); const row = await screen.findByRole('button', { name: 'Editar despesa Internet' });
    expect(row.querySelector('.tile-ico svg')).toBeTruthy(); expect((row.querySelector('.tile-ico') as HTMLElement).style.getPropertyValue('--c')).toBe('#1F6F54');
  });
});

describe('3) Rendas: adicionar, renomear e renda principal', () => {
  const duas = { state: { incomes: [inc('i1', 'Salário', 500000, true, true), inc('i2', 'Freela', 150000, false, false)], expenses: [] } };
  it('a principal aparece primeiro com selo "Principal" e estrela marcada; a outra oferece "tornar principal"', async () => {
    mensal(duas); const reg = await screen.findByRole('region', { name: 'Rendas' }); const rows = within(reg).getAllByRole('listitem'); expect(rows[0]).toHaveTextContent('Salário'); expect(rows[0]).toHaveTextContent('Principal');
    expect(within(rows[0]).getByRole('img', { name: 'Renda principal: Salário' })).toBeInTheDocument(); expect(within(rows[1]).queryByText('Principal')).not.toBeInTheDocument(); expect(within(rows[1]).getByRole('button', { name: 'Tornar Freela a renda principal' })).toBeInTheDocument();
  });
  it('ordem correta mesmo que a lista chegue com a principal no fim', async () => {
    mensal({ state: { incomes: [inc('i2', 'Freela', 1, false, false), inc('i1', 'Salário', 2, true, true)], expenses: [] } }); const reg = await screen.findByRole('region', { name: 'Rendas' }); expect(within(reg).getAllByRole('listitem')[0]).toHaveTextContent('Salário');
  });
  it('tocar na estrela chama a API e avisa; erro da API vira mensagem amigável', async () => {
    const { api } = mensal(duas); await userEvent.click(await screen.findByRole('button', { name: 'Tornar Freela a renda principal' }));
    await waitFor(() => expect(api.incomes.update).toHaveBeenCalledWith('i2', { isPrimary: true })); expect(await screen.findByRole('status')).toHaveTextContent('“Freela” agora é a renda principal.');
  });
  it('erro PRIMARY_REQUIRED aparece em português claro', async () => {
    const api = fakeApi(duas); api.incomes.update.mockRejectedValue(new ApiError(409, 'PRIMARY_REQUIRED', 'texto técnico')); renderApp(<MensalScreen initialYm="2026-10" />, api);
    await userEvent.click(await screen.findByRole('button', { name: 'Tornar Freela a renda principal' })); expect(await screen.findByRole('status')).toHaveTextContent('Para trocar a renda principal, marque outra renda como principal.');
  });
  it('o resumo mostra a renda principal (com o nome) e acompanha a troca', async () => {
    mensal(duas); const pill = await screen.findByTestId('principal-pill'); expect(pill).toHaveTextContent('Salário'); expect(pill).toHaveAttribute('title', 'Renda principal: Salário');
  });
  it('renomear: o nome novo vai para a API e a renda continua principal', async () => {
    const { api } = mensal(duas); await userEvent.click(await screen.findByRole('button', { name: 'Editar renda Salário' })); const d = await dialog('Editar renda');
    const n = within(d).getByLabelText('Nome'); await userEvent.clear(n); await userEvent.type(n, 'Salário CLT'); await userEvent.click(within(d).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.incomes.update).toHaveBeenCalledWith('i1', { name: 'Salário CLT', amountCents: 500000, recurring: true }));       // sem isPrimary: não mexe na principal
  });
  it('formulário: a principal atual fica travada (explica como trocar); outra pode ser promovida', async () => {
    const { api } = mensal(duas); await userEvent.click(await screen.findByRole('button', { name: 'Editar renda Salário' })); let d = await dialog('Editar renda');
    const sw = within(d).getByRole('switch', { name: 'Renda principal' }); expect(sw).toBeChecked(); expect(sw).toBeDisabled(); expect(within(d).getByText(/Para trocar, marque outra renda/)).toBeInTheDocument(); await userEvent.keyboard('{Escape}');
    await userEvent.click(await screen.findByRole('button', { name: 'Editar renda Freela' })); d = await dialog('Editar renda'); const sw2 = within(d).getByRole('switch', { name: 'Renda principal' }); expect(sw2).not.toBeChecked(); expect(sw2).toBeEnabled();
    await userEvent.click(sw2); await userEvent.click(within(d).getByRole('button', { name: 'Salvar' })); await waitFor(() => expect(api.incomes.update).toHaveBeenCalledWith('i2', { name: 'Freela', amountCents: 150000, recurring: false, isPrimary: true }));
  });
  it('adicionar: a 1ª renda do mês já nasce principal (travado, sem enviar o campo); a 2ª pode ser marcada', async () => {
    const vazio = mensal({ state: { incomes: [], expenses: [] } }); await userEvent.click(await screen.findByRole('button', { name: /Nova renda/ })); let d = await dialog('Nova renda');
    expect(within(d).getByRole('switch', { name: 'Renda principal' })).toBeChecked(); expect(within(d).getByText(/primeira renda do mês/)).toBeInTheDocument();
    await userEvent.type(within(d).getByLabelText('Nome'), 'Salário'); await userEvent.type(within(d).getByLabelText('Valor (R$)'), '5000'); await userEvent.click(within(d).getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(vazio.api.incomes.create).toHaveBeenCalledWith({ name: 'Salário', amountCents: 500000, recurring: false, ym: '2026-10' })); vazio.unmount();
    const { api } = mensal(duas); await userEvent.click(await screen.findByRole('button', { name: /Nova renda/ })); d = await dialog('Nova renda'); const sw = within(d).getByRole('switch', { name: 'Renda principal' }); expect(sw).not.toBeChecked();
    await userEvent.click(sw); await userEvent.type(within(d).getByLabelText('Nome'), 'Bônus'); await userEvent.click(within(d).getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(api.incomes.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bônus', isPrimary: true })));
  });
});
