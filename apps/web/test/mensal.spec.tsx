import { ApiError } from '@fin/api-client';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MensalScreen } from '@/components/MensalScreen';
import { fakeApi, inc, exp, push, renderApp, replace } from './helpers';

jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: require('./helpers').replace, push: require('./helpers').push }), usePathname: () => '/mensal' }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...r }: any) => require('react').createElement('a', { href, ...r }, children) }));
const open = () => screen.findByTestId('balance');
const dialog = (name: string | RegExp) => screen.findByRole('dialog', { name });

describe('Mensal — painel', () => {
  it('resumo vindo da API, listas Fixas/Variáveis, vencimentos e ferramentas', async () => {
    renderApp(<MensalScreen initialYm="2026-10" />);
    expect((await open()).textContent).toMatch(/2\.700,00/); expect(screen.getByText(/Sobra em outubro/)).toBeInTheDocument();
    expect(screen.getByTestId('income').textContent).toMatch(/5\.000,00/); expect(screen.getByTestId('expenses').textContent).toMatch(/2\.300,00/);
    expect(screen.getByText(/46% da renda comprometida/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Renda comprometida' })).toHaveAttribute('aria-valuenow', '46');
    const fixas = screen.getByRole('region', { name: 'Fixas' }); expect(within(fixas).getByText('Aluguel')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Variáveis' })).getByText('Mercado')).toBeInTheDocument();
    expect(await screen.findByText('amanhã', { selector: '.dtag' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar despesas' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Ocultar valores' })).toBeInTheDocument();
  });
  it('saldo negativo => "Faltou em" e barra nunca passa de 100%', async () => {
    renderApp(<MensalScreen initialYm="2026-10" />, fakeApi({ summary: { balanceCents: -50000, committedPercent: 120 } }));
    await open(); expect(screen.getByText(/Faltou em outubro/)).toBeInTheDocument(); expect(screen.getByTestId('balance')).toHaveClass('neg');
    expect(screen.getByRole('progressbar', { name: 'Renda comprometida' })).toHaveAttribute('aria-valuenow', '100');
  });
  it('estados: carregando, erro com "Tentar novamente", vazio nas listas', async () => {
    const api = fakeApi({ state: { incomes: [], expenses: [] } }); let fail = true; const real = api.months.open.getMockImplementation()!;
    api.months.open.mockImplementation(async (ym: string) => { if (fail) throw new ApiError(502, 'API_UNAVAILABLE', 'x'); return real(ym); });
    renderApp(<MensalScreen initialYm="2026-10" />, api);
    expect(await screen.findByRole('alert')).toHaveTextContent('Serviço indisponível');
    fail = false; await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await open(); expect(screen.getByText('Nenhuma despesa fixa')).toBeInTheDocument(); expect(screen.getByText('Nenhuma renda neste mês')).toBeInTheDocument();
  });
  it('navegar de mês abre o mês seguinte (atravessando o ano)', async () => {
    const api = fakeApi(); renderApp(<MensalScreen initialYm="2026-12" />, api); await open();
    await userEvent.click(screen.getByRole('button', { name: 'Próximo mês' })); await waitFor(() => expect(api.months.open).toHaveBeenCalledWith('2027-01'));
    expect(await screen.findByRole('heading', { level: 1, name: /Janeiro de 2027/i })).toBeInTheDocument();
  });
});

describe('Mensal — despesas (janela de edição)', () => {
  it('editar: valor "1.234,56" vira 123456 centavos e a janela fecha', async () => {
    const { api } = renderApp(<MensalScreen initialYm="2026-10" />); await open();
    await userEvent.click(screen.getByRole('button', { name: 'Editar despesa Mercado' }));
    const d = await dialog('Editar despesa'); const v = within(d).getByLabelText('Valor (R$)'); await userEvent.clear(v); await userEvent.type(v, '1.234,56');
    await userEvent.click(within(d).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.expenses.update).toHaveBeenCalledWith('e2', { name: 'Mercado', amountCents: 123456, recurring: false, dueDay: null, installmentCurrent: null, installmentTotal: null }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('validações: valor inválido, vencimento fora de 1–31, parcela maior que o total, parcela incompleta', async () => {
    const { api } = renderApp(<MensalScreen initialYm="2026-10" />); await open();
    await userEvent.click(screen.getByRole('button', { name: 'Editar despesa Mercado' })); const d = await dialog('Editar despesa'); const save = () => userEvent.click(within(d).getByRole('button', { name: 'Salvar' }));
    const v = within(d).getByLabelText('Valor (R$)'); await userEvent.clear(v); await userEvent.type(v, '1.5.5,2'); await save();
    expect(await within(d).findByText(/Valor inválido/)).toBeInTheDocument(); await userEvent.clear(v); await userEvent.type(v, '10');
    await userEvent.type(within(d).getByLabelText('Vence no dia'), '45'); await save(); expect(within(d).getByText('Use um dia de 1 a 31.')).toBeInTheDocument();
    await userEvent.clear(within(d).getByLabelText('Vence no dia'));
    await userEvent.type(within(d).getByLabelText('Parcela atual'), '5'); await userEvent.type(within(d).getByLabelText('Total de parcelas'), '3'); await save(); expect(within(d).getByText(/não pode passar do total/)).toBeInTheDocument();
    await userEvent.clear(within(d).getByLabelText('Total de parcelas')); await save(); expect(within(d).getByText('Preencha a parcela atual e o total.')).toBeInTheDocument();
    expect(api.expenses.update).not.toHaveBeenCalled();
  });
  it('tipo Fixa e vencimento são enviados; erro da API aparece amigável dentro da janela', async () => {
    const api = fakeApi(); api.expenses.update.mockRejectedValueOnce(new ApiError(409, 'LIMIT_REACHED', 'texto técnico'));
    renderApp(<MensalScreen initialYm="2026-10" />, api); await open();
    await userEvent.click(screen.getByRole('button', { name: 'Editar despesa Mercado' })); const d = await dialog('Editar despesa');
    await userEvent.click(within(d).getByRole('button', { name: /Fixa/ })); await userEvent.type(within(d).getByLabelText('Vence no dia'), '15'); await userEvent.click(within(d).getByRole('button', { name: 'Salvar' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Você atingiu o limite permitido.'); expect(within(d).queryByText(/texto técnico/)).not.toBeInTheDocument();
    expect(api.expenses.update).toHaveBeenCalledWith('e2', expect.objectContaining({ recurring: true, dueDay: 15 }));
  });
  it('excluir exige confirmar (2 passos)', async () => {
    const { api } = renderApp(<MensalScreen initialYm="2026-10" />); await open();
    await userEvent.click(screen.getByRole('button', { name: 'Editar despesa Mercado' })); const d = await dialog('Editar despesa');
    await userEvent.click(within(d).getByRole('button', { name: 'Excluir' })); expect(api.expenses.remove).not.toHaveBeenCalled();
    await userEvent.click(within(d).getByRole('button', { name: 'Confirmar exclusão' })); await waitFor(() => expect(api.expenses.remove).toHaveBeenCalledWith('e2'));
  });
  it('nova despesa: abre o mês, cria com ym e fecha; Esc fecha sem criar', async () => {
    const { api } = renderApp(<MensalScreen initialYm="2026-10" />); await open();
    await userEvent.click(screen.getAllByRole('button', { name: /Nova despesa/ })[0]); let d = await dialog('Nova despesa'); await userEvent.keyboard('{Escape}'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /Nova despesa/ })[0]); d = await dialog('Nova despesa');
    await userEvent.type(within(d).getByLabelText('Nome'), 'Curso'); await userEvent.type(within(d).getByLabelText('Valor (R$)'), '149,90'); await userEvent.type(within(d).getByLabelText('Parcela atual'), '1'); await userEvent.type(within(d).getByLabelText('Total de parcelas'), '12');
    await userEvent.click(within(d).getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(api.expenses.create).toHaveBeenCalledWith({ name: 'Curso', amountCents: 14990, recurring: false, ym: '2026-10', icon: 'receipt', color: '#3B6B8C', installmentCurrent: 1, installmentTotal: 12 }));
    expect(api.months.open.mock.invocationCallOrder[1]).toBeLessThan(api.expenses.create.mock.invocationCallOrder[0]);   // abre o mês ANTES de criar
    expect(await screen.findByRole('status')).toHaveTextContent('Despesa adicionada.');
  });
  it('nome vazio não cria', async () => {
    const { api } = renderApp(<MensalScreen initialYm="2026-10" />); await open();
    await userEvent.click(screen.getAllByRole('button', { name: /Nova despesa/ })[0]); const d = await dialog('Nova despesa'); await userEvent.click(within(d).getByRole('button', { name: 'Adicionar' }));
    expect(await within(d).findByText('Informe um nome.')).toBeInTheDocument(); expect(api.expenses.create).not.toHaveBeenCalled();
  });
});

describe('Mensal — rendas, meta e ações do mês', () => {
  it('renda: criar, editar (repetir todo mês) e limite de 3', async () => {
    const { api } = renderApp(<MensalScreen initialYm="2026-10" />); await open();
    await userEvent.click(screen.getByRole('button', { name: /Nova renda/ })); let d = await dialog('Nova renda');
    await userEvent.type(within(d).getByLabelText('Nome'), 'Freela'); await userEvent.type(within(d).getByLabelText('Valor (R$)'), '1.500'); await userEvent.click(within(d).getByRole('switch', { name: 'Repetir todo mês' })); await userEvent.click(within(d).getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(api.incomes.create).toHaveBeenCalledWith({ name: 'Freela', amountCents: 150000, recurring: true, ym: '2026-10' }));
    await userEvent.click(screen.getByRole('button', { name: 'Editar renda Salário' })); d = await dialog('Editar renda'); await userEvent.click(within(d).getByRole('switch', { name: 'Repetir todo mês' })); await userEvent.click(within(d).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.incomes.update).toHaveBeenCalledWith('i1', { name: 'Salário', amountCents: 500000, recurring: false }));
  });
  it('3 rendas: botão "Nova renda" desabilitado', async () => {
    renderApp(<MensalScreen initialYm="2026-10" />, fakeApi({ state: { incomes: [inc('a', 'A', 1), inc('b', 'B', 1), inc('c', 'C', 1)], expenses: [] } })); await open();
    expect(screen.getByText('3/3')).toBeInTheDocument(); expect(screen.getByRole('button', { name: /Nova renda/ })).toBeDisabled();
  });
  it('meta: definir salva em centavos; ultrapassada mostra aviso', async () => {
    const { api } = renderApp(<MensalScreen initialYm="2026-10" />); await open();
    await userEvent.click(screen.getByRole('button', { name: /Definir/ })); const d = await dialog('Meta de gastos do mês'); await userEvent.type(within(d).getByLabelText('Meta (R$)'), '3.000'); await userEvent.click(within(d).getByRole('button', { name: 'Salvar meta' }));
    await waitFor(() => expect(api.me.updateSettings).toHaveBeenCalledWith({ monthlyGoalCents: 300000 }));
  });
  it('meta ultrapassada e dentro da meta', async () => {
    const { unmount } = renderApp(<MensalScreen initialYm="2026-10" />, fakeApi({ summary: { goal: { goalCents: 200000, usedPercent: 100, exceeded: true, differenceCents: 30000 } } })); await open();
    expect(screen.getByText(/Meta ultrapassada em/)).toBeInTheDocument(); unmount();
    renderApp(<MensalScreen initialYm="2026-10" />, fakeApi({ summary: { goal: { goalCents: 400000, usedPercent: 57.5, exceeded: false, differenceCents: 170000 } } })); await open();
    expect(screen.getByText(/Faltam/)).toBeInTheDocument(); expect(screen.getByRole('progressbar', { name: 'Meta de gastos usada' })).toHaveAttribute('aria-valuenow', '58');
  });
  it('copiar para o próximo mês; se já tem dados pede confirmação para substituir', async () => {
    const api = fakeApi(); api.months.copy.mockRejectedValueOnce(new ApiError(409, 'MONTH_NOT_EMPTY', 'x'));
    renderApp(<MensalScreen initialYm="2026-10" />, api); await open();
    await userEvent.click(screen.getByRole('button', { name: /Copiar p\/ novembro/ })); expect(api.months.copy).toHaveBeenCalledWith('2026-10', '2026-11', false);
    const d = await dialog('Substituir dados?'); await userEvent.click(within(d).getByRole('button', { name: 'Substituir' })); await waitFor(() => expect(api.months.copy).toHaveBeenLastCalledWith('2026-10', '2026-11', true));
    expect(await screen.findByRole('status')).toHaveTextContent('Copiado para novembro.');
  });
});

describe('Casca do app: botão +, busca, menu Mais', () => {
  it('botão "+" central abre Nova despesa de qualquer tela', async () => {
    renderApp(<MensalScreen initialYm="2026-10" />); await open(); const btns = screen.getAllByRole('button', { name: 'Nova despesa' }); await userEvent.click(btns[btns.length - 1]); expect(await dialog('Nova despesa')).toBeInTheDocument();   // o último é o "+" central
  });
  it('busca em todos os meses; clicar no resultado leva ao mês', async () => {
    const found = [exp('x1', 'Aluguel antigo', 140000, true, 5, { ym: '2026-03' })]; const { api } = renderApp(<MensalScreen initialYm="2026-10" />, fakeApi({ found })); await open();
    await userEvent.click(screen.getByRole('button', { name: 'Buscar despesas' })); const d = await dialog('Buscar despesas'); await userEvent.type(within(d).getByLabelText('Buscar despesas por nome'), 'alug');
    await waitFor(() => expect(api.expenses.list).toHaveBeenCalledWith({ q: 'alug', limit: 20 })); await userEvent.click(await within(d).findByText('Aluguel antigo'));
    expect(push).toHaveBeenCalledWith('/mensal'); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('busca sem resultado mostra estado vazio; "/" abre a busca', async () => {
    renderApp(<MensalScreen initialYm="2026-10" />); await open(); await userEvent.keyboard('/'); const d = await dialog('Buscar despesas');
    await userEvent.type(within(d).getByLabelText('Buscar despesas por nome'), 'zzz'); expect(await within(d).findByText('Nada encontrado')).toBeInTheDocument();
  });
  it('menu Mais: links, ações rápidas e sair', async () => {
    const onLogout = jest.fn(async () => undefined); renderApp(<MensalScreen initialYm="2026-10" />, fakeApi(), { onLogout }); await open();
    await userEvent.click(screen.getByRole('button', { name: 'Mais opções' })); const d = await dialog('Mais');
    for (const n of ['Agenda', 'Investimentos', 'Cripto', 'Configurações', 'Apoie o projeto']) expect(within(d).getByRole('link', { name: new RegExp(n) })).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: /Ocultar valores/ })).toBeInTheDocument();
    replace.mockClear(); await userEvent.click(within(d).getByRole('button', { name: /Sair da conta/ })); await waitFor(() => expect(onLogout).toHaveBeenCalled()); expect(replace).toHaveBeenCalledWith('/login');
  });
  it('navegação: item da página atual marcado com aria-current', async () => {
    renderApp(<MensalScreen initialYm="2026-10" />); await open();
    expect(screen.getAllByRole('link', { name: /Mensal|Mês/ }).some((a) => a.getAttribute('aria-current') === 'page')).toBe(true);
  });
});
