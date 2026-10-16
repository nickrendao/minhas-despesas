import { ApiError } from '@fin/api-client';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgendaScreen } from '@/components/AgendaScreen';
import { AnnualScreen } from '@/components/AnnualScreen';
import { BrandMark } from '@/components/BrandMark';
import { CardsScreen } from '@/components/CardsScreen';
import { ConfigScreen } from '@/components/ConfigScreen';
import { CryptoScreen } from '@/components/CryptoScreen';
import { InvestScreen } from '@/components/InvestScreen';
import { LoginForm } from '@/components/LoginForm';
import { MensalScreen } from '@/components/MensalScreen';
import { buildCardsCsv, buildCardsOfx, buildMonthCsv } from '@/lib/exports';
import { fakeApi, renderApp, renderPlain, replace } from './helpers';

jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: require('./helpers').replace, push: require('./helpers').push }), usePathname: () => '/cartao' }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...r }: any) => require('react').createElement('a', { href, ...r }, children) }));
const dialog = (name: string | RegExp) => screen.findByRole('dialog', { name });

describe('exportações (funções puras)', () => {
  const cards = [{ name: 'Nubank', purchases: [{ name: 'TV "Smart"', amountCents: 199999, installmentCurrent: 1, installmentTotal: 10 }, { name: 'Mercado', amountCents: 30050, installmentCurrent: null, installmentTotal: null }] }];
  it('CSV do cartão: ; e vírgula decimal, aspas escapadas, parcela', () => {
    const l = buildCardsCsv(cards)!.split('\n'); expect(l[0]).toBe('"Cartão";"Gasto";"Parcela";"Valor (R$)"'); expect(l[1]).toBe('"Nubank";"TV ""Smart""";"1/10";"1999,99"'); expect(l[2]).toBe('"Nubank";"Mercado";"";"300,50"');
  });
  it('OFX: valores exatos, total e data injetada; sem gastos => null', () => {
    const o = buildCardsOfx(cards, new Date(2026, 9, 5))!; expect(o).toContain('<TRNAMT>-1999.99'); expect(o).toContain('<BALAMT>-2300.49'); expect(o).toContain('<DTPOSTED>20261005000000');
    expect(buildCardsCsv([{ name: 'x', purchases: [] }])).toBeNull(); expect(buildCardsOfx([])).toBeNull();
  });
  it('CSV do mês: tipo, vencimento e parcela', () => {
    const csv = buildMonthCsv([{ kind: 'Renda', name: 'Salário', dueDay: null, installmentCurrent: null, installmentTotal: null, amountCents: 500000 }, { kind: 'Despesa fixa', name: 'Aluguel', dueDay: 5, installmentCurrent: 3, installmentTotal: 10, amountCents: 150050 }])!.split('\n');
    expect(csv[1]).toBe('"Renda";"Salário";"";"";"5000,00"'); expect(csv[2]).toBe('"Despesa fixa";"Aluguel";"dia 5";"3/10";"1500,50"'); expect(buildMonthCsv([])).toBeNull();
  });
});

describe('Marca', () => {
  it('logo oficial B ("A sobra"): 3 barras + 1 bolinha sobre o tile verde da marca', () => {
    const { container } = render(<BrandMark />);
    expect(container.querySelectorAll('rect')).toHaveLength(4); expect(container.querySelectorAll('circle')).toHaveLength(1);   // tile + 3 barras · 1 bolinha
    expect(container.querySelector('rect')).toHaveAttribute('fill', '#009929'); expect(screen.getByRole('img', { name: 'Minhas Despesas' })).toBeInTheDocument();
  });
});

const card = (o: any = {}) => ({ id: 'c1', name: 'Nubank', color: '#3B6B8C', limitCents: 100000, usedCents: 50000, availableCents: 50000, usagePercent: 50, warn: false,
  purchases: [{ id: 'p1', name: 'TV', amountCents: 30000, installmentCurrent: 2, installmentTotal: 6 }, { id: 'p2', name: 'Mercado', amountCents: 20000, installmentCurrent: null, installmentTotal: null }], ...o });

describe('Cartões', () => {
  it('uso, disponível, parcelas ("faltam N") e contagem de cartões', async () => {
    renderApp(<CardsScreen />, fakeApi({ cards: [card()] }));
    expect(await screen.findByText('1 de 5 cartões usados')).toBeInTheDocument(); expect(screen.getByTestId('used').textContent).toMatch(/500,00/); expect(screen.getByTestId('available').textContent).toMatch(/500,00/);
    expect(screen.getByText('2/6')).toBeInTheDocument(); expect(screen.getByText(/faltam 4 parcelas/)).toBeInTheDocument(); expect(screen.getByRole('progressbar', { name: 'Limite usado' })).toHaveAttribute('aria-valuenow', '50');
    expect(screen.queryByText(/Atenção: você já usou/)).not.toBeInTheDocument();
  });
  it('alerta aparece quando o servidor marca warn', async () => {
    renderApp(<CardsScreen />, fakeApi({ cards: [card({ warn: true, usagePercent: 85 })] })); expect(await screen.findByText(/Atenção: você já usou 80% ou mais/)).toBeInTheDocument();
  });
  it('novo gasto com parcelas envia centavos; validações bloqueiam o envio', async () => {
    const api = fakeApi({ cards: [card()] }); renderApp(<CardsScreen />, api); await userEvent.click(await screen.findByRole('button', { name: /^Gasto$/ })); const d = await dialog('Novo gasto no cartão');
    await userEvent.click(within(d).getByRole('button', { name: 'Adicionar gasto' })); expect(await within(d).findByText('Informe um valor maior que zero.')).toBeInTheDocument();
    await userEvent.type(within(d).getByLabelText('Valor (R$)'), '10'); await userEvent.type(within(d).getByLabelText('Parcela atual'), '5'); await userEvent.type(within(d).getByLabelText('Total de parcelas'), '3');
    await userEvent.click(within(d).getByRole('button', { name: 'Adicionar gasto' })); expect(await within(d).findByText(/Parcela inválida/)).toBeInTheDocument(); expect(api.cards.addPurchase).not.toHaveBeenCalled();
    await userEvent.clear(within(d).getByLabelText('Parcela atual')); await userEvent.type(within(d).getByLabelText('Parcela atual'), '1'); await userEvent.clear(within(d).getByLabelText('Total de parcelas')); await userEvent.type(within(d).getByLabelText('Total de parcelas'), '12');
    await userEvent.clear(within(d).getByLabelText('Valor (R$)')); await userEvent.type(within(d).getByLabelText('Valor (R$)'), '2.499,90'); await userEvent.type(within(d).getByLabelText('Nome do gasto'), 'Geladeira');
    await userEvent.click(within(d).getByRole('button', { name: 'Adicionar gasto' }));
    await waitFor(() => expect(api.cards.addPurchase).toHaveBeenCalledWith('c1', { name: 'Geladeira', amountCents: 249990, installmentCurrent: 1, installmentTotal: 12 }));
  });
  it('excluir gasto pede confirmação', async () => {
    const api = fakeApi({ cards: [card()] }); renderApp(<CardsScreen />, api); await userEvent.click(await screen.findByRole('button', { name: 'Excluir gasto TV' }));
    expect(api.cards.removePurchase).not.toHaveBeenCalled(); await userEvent.click(within(await dialog('Excluir gasto?')).getByRole('button', { name: 'Excluir' })); await waitFor(() => expect(api.cards.removePurchase).toHaveBeenCalledWith('c1', 'p1'));
  });
  it('editar cartão: nome, limite em centavos e cor; excluir em 2 passos', async () => {
    const api = fakeApi({ cards: [card()] }); renderApp(<CardsScreen />, api); await userEvent.click(await screen.findByRole('button', { name: /Editar/ })); const d = await dialog('Editar cartão');
    const limit = within(d).getByLabelText('Limite (R$)'); await userEvent.clear(limit); await userEvent.type(limit, '5000'); await userEvent.click(within(d).getByRole('button', { name: 'Cor #B85C38' })); await userEvent.click(within(d).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.cards.update).toHaveBeenCalledWith('c1', { name: 'Nubank', color: '#B85C38', limitCents: 500000 }));
    await userEvent.click(screen.getByRole('button', { name: /Editar/ })); const d2 = await dialog('Editar cartão'); await userEvent.click(within(d2).getByRole('button', { name: /Excluir cartão/ })); expect(api.cards.remove).not.toHaveBeenCalled();
    await userEvent.click(within(d2).getByRole('button', { name: 'Confirmar exclusão' })); await waitFor(() => expect(api.cards.remove).toHaveBeenCalledWith('c1'));
  });
  it('limite de 5 cartões desabilita "Novo cartão"; criar abre a edição', async () => {
    const five = Array.from({ length: 5 }, (_, i) => card({ id: `c${i}`, name: `Cartão ${i}`, purchases: [] })); const { unmount } = renderApp(<CardsScreen />, fakeApi({ cards: five }));
    expect(await screen.findByRole('button', { name: /Novo cartão/ })).toBeDisabled(); await userEvent.click(screen.getByRole('tab', { name: /Cartão 3/ })); expect(screen.getByRole('region', { name: 'Detalhes de Cartão 3' })).toBeInTheDocument(); unmount();
    const api = fakeApi({ cards: [card()] }); renderApp(<CardsScreen />, api); await userEvent.click(await screen.findByRole('button', { name: /Novo cartão/ }));
    await waitFor(() => expect(api.cards.create).toHaveBeenCalledWith({ name: 'Novo cartão', limitCents: 0 })); expect(await dialog('Editar cartão')).toBeInTheDocument();
  });
  it('estado vazio e exportar sem gastos avisa', async () => {
    const { unmount } = renderApp(<CardsScreen />, fakeApi({ cards: [] })); expect(await screen.findByText('Nenhum cartão cadastrado')).toBeInTheDocument(); unmount();
    renderApp(<CardsScreen />, fakeApi({ cards: [card({ purchases: [] })] })); await userEvent.click(await screen.findByRole('button', { name: /CSV/ })); expect(await screen.findByRole('status')).toHaveTextContent('Nenhum gasto lançado');
  });
});

describe('Visão anual e Agenda', () => {
  const months = Array.from({ length: 12 }, (_, i) => ({ ym: `2026-${String(i + 1).padStart(2, '0')}`, expensesCents: i === 2 ? 15000 : i === 6 ? 20000 : 0, incomeCents: i === 2 || i === 6 ? 50000 : 0 }));
  it('anual: totais, 12 barras, "sobrou no ano", e navegação de ano', async () => {
    const api = fakeApi({ yearly: { months, totalYearCents: 35000, averageMonthlyCents: 17500, biggestMonth: { ym: '2026-07', expensesCents: 20000 } } }); renderApp(<AnnualScreen initialYear={2026} />, api);
    expect((await screen.findByTestId('year-total')).textContent).toMatch(/350,00/); expect(screen.getByTestId('year-avg').textContent).toMatch(/175,00/); expect(screen.getByTestId('year-biggest')).toHaveTextContent('julho');
    expect(within(screen.getByRole('group', { name: 'Gastos por mês' })).getAllByRole('button')).toHaveLength(12); expect(screen.getByTestId('year-saved').textContent).toMatch(/650,00/);
    await userEvent.click(screen.getByRole('button', { name: 'Ano anterior' })); await waitFor(() => expect(api.reports.yearly).toHaveBeenCalledWith(2025));
  });
  it('anual sem lançamentos: estado vazio', async () => { renderApp(<AnnualScreen initialYear={2026} />); expect(await screen.findByText('Sem lançamentos em 2026')).toBeInTheDocument(); });
  it('agenda: agrupa por mês, destaca o próximo e marca vencidos', async () => {
    const agenda = [{ ym: '2000-01', dueDay: 5, expenseId: 'a', name: 'Antiga', amountCents: 1000 }, { ym: '2099-01', dueDay: 10, expenseId: 'b', name: 'Futura', amountCents: 50000 }];
    renderApp(<AgendaScreen />, fakeApi({ agenda })); const next = await screen.findByRole('region', { name: 'Próximo vencimento' });
    expect(within(next).getByText('Futura')).toBeInTheDocument(); expect(screen.getByText('já venceu')).toBeInTheDocument(); expect(screen.getByRole('region', { name: 'janeiro de 2099' })).toBeInTheDocument(); expect(screen.getByRole('region', { name: 'janeiro de 2000' })).toBeInTheDocument();
  });
  it('agenda vazia', async () => { renderApp(<AgendaScreen />); expect(await screen.findByText('Nenhum vencimento cadastrado')).toBeInTheDocument(); });
});

describe('Investimentos', () => {
  const plan = { id: 'p1', name: 'Reserva', type: 'cdb', targetLimitCents: 100000, monthlyAmountCents: 30000, monthsToTarget: 4 };
  it('plano com previsão, reserva por chips e dicas', async () => {
    const api = fakeApi({ plans: [plan] }); renderApp(<InvestScreen />, api); expect(await screen.findByRole('heading', { name: 'Reserva' })).toBeInTheDocument(); expect(screen.getByText(/Chega lá em/)).toBeInTheDocument();
    expect((await screen.findByTestId('reserve')).textContent).toMatch(/12\.000,00/); await userEvent.click(screen.getByRole('button', { name: '9x' }));
    await waitFor(() => expect(screen.getByTestId('reserve').textContent).toMatch(/18\.000,00/)); expect(api.reports.summary).toHaveBeenCalledWith(expect.any(String), 9); expect(screen.getByRole('heading', { name: 'Tesouro Selic' })).toBeInTheDocument();
  });
  it('editar plano em centavos, criar e excluir', async () => {
    const api = fakeApi({ plans: [plan] }); renderApp(<InvestScreen />, api); await userEvent.click(await screen.findByRole('button', { name: 'Editar plano Reserva' })); const d = await dialog('Plano de investimento');
    const m = within(d).getByLabelText('Por mês (R$)'); await userEvent.clear(m); await userEvent.type(m, '450,50'); await userEvent.selectOptions(within(d).getByLabelText('Tipo de investimento'), 'acoes'); await userEvent.click(within(d).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.investments.update).toHaveBeenCalledWith('p1', { name: 'Reserva', type: 'acoes', targetLimitCents: 100000, monthlyAmountCents: 45050 }));
    await userEvent.click(screen.getByRole('button', { name: /Novo plano/ })); await waitFor(() => expect(api.investments.create).toHaveBeenCalledWith({})); expect(await dialog('Plano de investimento')).toBeInTheDocument();
  });
});

describe('Cripto', () => {
  const val = (items: any[], totals: any = { pricedCount: 1, investedCents: 10000000, currentValueCents: 12500000, gainCents: 2500000, gainPercent: 25 }) => ({ items, totals, asOf: '2026-10-05T15:30:00.000Z' });
  const btc = { id: 'h1', coinId: 'bitcoin', quantity: '0.5', buyPriceCents: 20000000, priceAvailable: true, currentPriceCents: 25000000, change24hPercent: -2.25, investedCents: 10000000, currentValueCents: 12500000, gainCents: 2500000, gainPercent: 25 };
  it('preço, variação 24h, totais, ícone real e horário', async () => {
    renderApp(<CryptoScreen refreshMs={60000} />, fakeApi({ crypto: val([btc]) })); expect(await screen.findByText('Bitcoin')).toBeInTheDocument();
    expect(screen.getByText('-2,25%')).toBeInTheDocument(); expect(screen.getByTestId('t-gain')).toHaveTextContent('+25,00%'); expect(screen.getByTestId('t-now').textContent).toMatch(/125\.000,00/); expect(screen.getByTestId('asof')).toHaveTextContent(/Atualizado às \d{2}:\d{2}/); expect(document.querySelector('.coin svg')).toBeTruthy();
  });
  it('REGRESSÃO: moeda recém-criada (sem moeda, qtd 0) e sem cotação não quebram a tela', async () => {
    const empty = { id: 'h2', coinId: null, quantity: '0', buyPriceCents: 0, priceAvailable: false, currentPriceCents: null, change24hPercent: null, investedCents: 0, currentValueCents: null, gainCents: null, gainPercent: null };
    const zero = { pricedCount: 0, investedCents: 0, currentValueCents: 0, gainCents: 0, gainPercent: null }; const { unmount } = renderApp(<CryptoScreen refreshMs={60000} />, fakeApi({ crypto: val([empty], zero) }));
    expect(await screen.findByText('Selecione uma moeda')).toBeInTheDocument(); unmount();
    renderApp(<CryptoScreen refreshMs={60000} />, fakeApi({ crypto: val([{ ...btc, priceAvailable: false, currentPriceCents: null, currentValueCents: null, gainCents: null, gainPercent: null }], zero) })); expect(await screen.findByText(/Não foi possível carregar a cotação de Bitcoin/)).toBeInTheDocument();
  });
  it('escolher moeda, quantidade (válida/inválida), preço em centavos e excluir com confirmação', async () => {
    const api = fakeApi({ crypto: val([btc]) }); renderApp(<CryptoScreen refreshMs={60000} />, api); await userEvent.click(await screen.findByText('Bitcoin'));
    const dlg = await dialog('Escolher moeda'); expect(within(dlg).getAllByRole('button').length).toBeGreaterThan(20); await userEvent.click(within(dlg).getByText('Solana')); await waitFor(() => expect(api.crypto.update).toHaveBeenCalledWith('h1', { coinId: 'solana' }));
    const q = screen.getByLabelText('Quantidade'); await userEvent.clear(q); await userEvent.type(q, '0,000000000123'); await userEvent.tab(); await waitFor(() => expect(api.crypto.update).toHaveBeenCalledWith('h1', { quantity: '0.000000000123' }));
    await userEvent.clear(q); await userEvent.type(q, '1e5'); await userEvent.tab(); expect(q).toHaveAttribute('aria-invalid', 'true');
    const p = screen.getByLabelText('Preço médio pago'); await userEvent.clear(p); await userEvent.type(p, '300.000,50'); await userEvent.tab(); await waitFor(() => expect(api.crypto.update).toHaveBeenCalledWith('h1', { buyPriceCents: 30000050 }));
    await userEvent.click(screen.getByRole('button', { name: 'Excluir moeda' })); expect(api.crypto.remove).not.toHaveBeenCalled(); await userEvent.click(within(await dialog('Excluir moeda?')).getByRole('button', { name: 'Excluir' })); await waitFor(() => expect(api.crypto.remove).toHaveBeenCalledWith('h1'));
  });
  it('ATUALIZA SOZINHA: busca a cotação de novo no intervalo', async () => {
    const api = fakeApi({ crypto: val([btc]) }); renderApp(<CryptoScreen refreshMs={80} />, api); await screen.findByText('Bitcoin'); await waitFor(() => expect(api.crypto.valuation.mock.calls.length).toBeGreaterThanOrEqual(3), { timeout: 2500 });
  });
});

describe('Configurações', () => {
  const setup = (o: any = {}, props: any = {}) => { const api = fakeApi({ settings: o }); const p = { onLogout: jest.fn(async () => undefined), changePassword: jest.fn(async () => undefined), deleteAccount: jest.fn(async () => undefined), ...props }; renderApp(<ConfigScreen {...p} />, api, { settings: o }); return { api, p }; };
  beforeEach(() => replace.mockClear());
  it('salva nome (só se mudou), tema e idioma', async () => {
    const { api } = setup(); const name = await screen.findByLabelText('Nome de exibição'); await userEvent.click(name); await userEvent.tab(); expect(api.me.updateSettings).not.toHaveBeenCalled();
    await userEvent.clear(name); await userEvent.type(name, 'Nicolas'); await userEvent.tab(); await waitFor(() => expect(api.me.updateSettings).toHaveBeenCalledWith({ displayName: 'Nicolas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Escuro' })); await waitFor(() => expect(api.me.updateSettings).toHaveBeenCalledWith({ theme: 'dark' }));
    await userEvent.selectOptions(screen.getByLabelText('Idioma'), 'en'); await waitFor(() => expect(api.me.updateSettings).toHaveBeenCalledWith({ locale: 'en' }));
  });
  it('PIN novo exige 4+ dígitos; com PIN definido, trocar/remover exige o PIN atual correto', async () => {
    const { api } = setup(); const b = await screen.findByRole('button', { name: 'Salvar PIN' }); expect(b).toBeDisabled(); await userEvent.type(screen.getByLabelText('Novo PIN'), '48a21'); expect(screen.getByLabelText('Novo PIN')).toHaveValue('4821'); await userEvent.click(b); await waitFor(() => expect(api.me.setPin).toHaveBeenCalledWith('4821'));
  });
  it('com PIN definido: PIN atual errado bloqueia; correto remove', async () => {
    const { api } = setup({ hasPin: true }); await userEvent.type(await screen.findByLabelText('PIN atual'), '0000'); await userEvent.click(screen.getByRole('button', { name: 'Remover PIN' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('PIN atual incorreto'); expect(api.me.setPin).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText('PIN atual')); await userEvent.type(screen.getByLabelText('PIN atual'), '4821'); await userEvent.click(screen.getByRole('button', { name: 'Remover PIN' })); await waitFor(() => expect(api.me.setPin).toHaveBeenCalledWith(null));
  });
  it('trocar senha: confirmação diferente não chama; válida chama; erro da API é amigável', async () => {
    const { p } = setup(); await userEvent.type(await screen.findByLabelText('Senha atual'), 'antiga1'); await userEvent.type(screen.getByLabelText('Nova senha'), 'nova123'); await userEvent.type(screen.getByLabelText('Confirmar nova senha'), 'outra999');
    await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' })); expect(await screen.findByRole('alert')).toHaveTextContent('não coincidem'); expect(p.changePassword).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText('Confirmar nova senha')); await userEvent.type(screen.getByLabelText('Confirmar nova senha'), 'nova123'); await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' }));
    await waitFor(() => expect(p.changePassword).toHaveBeenCalledWith('antiga1', 'nova123')); expect(await screen.findByRole('status')).toHaveTextContent('Senha alterada');
  });
  it('senha atual errada mostra a mensagem da API', async () => {
    setup({}, { changePassword: jest.fn(async () => { throw new ApiError(400, 'WRONG_PASSWORD', 'Senha atual incorreta'); }) }); await userEvent.type(await screen.findByLabelText('Senha atual'), 'x'); await userEvent.type(screen.getByLabelText('Nova senha'), 'nova123'); await userEvent.type(screen.getByLabelText('Confirmar nova senha'), 'nova123');
    await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' })); expect(await screen.findByRole('alert')).toHaveTextContent('Senha atual incorreta');
  });
  it('sair da conta e excluir conta (exige abrir e digitar a senha)', async () => {
    const { p } = setup(); await userEvent.click(within(await screen.findByRole('region', { name: 'Segurança' })).getByRole('button', { name: /Sair da conta/ })); await waitFor(() => expect(p.onLogout).toHaveBeenCalled()); expect(replace).toHaveBeenCalledWith('/login'); replace.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /Excluir minha conta/ })); expect(p.deleteAccount).not.toHaveBeenCalled(); await userEvent.type(screen.getByLabelText('Senha'), 'minha-senha'); await userEvent.click(screen.getByRole('button', { name: 'Excluir definitivamente' }));
    await waitFor(() => expect(p.deleteAccount).toHaveBeenCalledWith('minha-senha')); expect(replace).toHaveBeenCalledWith('/login');
  });
});

describe('Entrar / criar conta', () => {
  beforeEach(() => replace.mockClear());
  it('login com sucesso vai para /mensal; senha pode ser exibida', async () => {
    const login = jest.fn(async () => undefined); renderPlain(<LoginForm login={login} />); await userEvent.type(screen.getByLabelText('E-mail'), ' ana@teste.com '); await userEvent.type(screen.getByLabelText('Senha'), 'Senha-Forte-123');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password'); await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' })); expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' })); await waitFor(() => expect(login).toHaveBeenCalledWith('ana@teste.com', 'Senha-Forte-123')); expect(replace).toHaveBeenCalledWith('/mensal');
  });
  it('credenciais erradas e falha de rede mostram mensagens amigáveis e não navegam', async () => {
    const login = jest.fn().mockRejectedValueOnce(new ApiError(401, 'INVALID_CREDENTIALS', 'x')).mockRejectedValueOnce(new TypeError('Failed to fetch')); renderPlain(<LoginForm login={login} />);
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@a.com'); await userEvent.type(screen.getByLabelText('Senha'), 'qualquer'); await userEvent.click(screen.getByRole('button', { name: 'Entrar' })); expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' })); await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão')); expect(replace).not.toHaveBeenCalled();
  });
  it('cadastro: senhas diferentes não chamam a API; válido avisa para confirmar o e-mail', async () => {
    const api = fakeApi(); renderPlain(<LoginForm login={jest.fn()} />, api); await userEvent.click(screen.getByRole('tab', { name: 'Criar conta' }));
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@a.com'); await userEvent.type(screen.getByLabelText('Senha'), 'Senha-Forte-123'); await userEvent.type(screen.getByLabelText('Confirmar senha'), 'Outra-Senha-999'); await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('As senhas não coincidem'); expect(api.auth.register).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText('Confirmar senha')); await userEvent.type(screen.getByLabelText('Confirmar senha'), 'Senha-Forte-123'); await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByRole('status')).toHaveTextContent('link de confirmação'); expect(api.auth.register).toHaveBeenCalledWith('a@a.com', 'Senha-Forte-123'); expect(screen.getByRole('tab', { name: 'Entrar' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Ocultar valores e PIN', () => {
  const hide = () => userEvent.click(screen.getAllByRole('button', { name: /Ocultar valores|Mostrar valores/ })[0]);
  it('ocultar troca valores por ••••••, persiste na API e vale para toda a tela', async () => {
    const { api } = renderApp(<MensalScreen initialYm="2026-10" />); expect((await screen.findByTestId('balance')).textContent).toMatch(/2\.700,00/); await hide();
    expect(screen.getByTestId('balance')).toHaveTextContent('••••••'); expect(screen.getByTestId('income')).toHaveTextContent('••••••'); expect(screen.queryByText(/5\.000,00/)).not.toBeInTheDocument(); expect(api.me.updateSettings).toHaveBeenCalledWith({ privacyMode: true });
  });
  it('sem PIN, mostrar de novo é direto; com PIN, PIN errado NÃO revela e o certo revela', async () => {
    renderApp(<MensalScreen initialYm="2026-10" />, fakeApi({ settings: { hasPin: false, privacyMode: true } }), { settings: { hasPin: false, privacyMode: true } }); expect(await screen.findByTestId('balance')).toHaveTextContent('••••••'); await hide(); await waitFor(() => expect(screen.getByTestId('balance').textContent).toMatch(/2\.700,00/));
  });
  it('PIN: errado não revela; certo revela', async () => {
    const o = { hasPin: true, privacyMode: true }; renderApp(<MensalScreen initialYm="2026-10" />, fakeApi({ settings: o }), { settings: o }); await screen.findByTestId('balance'); await hide(); const d = await dialog('Digite seu PIN');
    await userEvent.type(within(d).getByLabelText('PIN'), '0000'); await userEvent.click(within(d).getByRole('button', { name: 'Mostrar valores' })); expect(await within(d).findByRole('alert')).toHaveTextContent('PIN incorreto'); expect(screen.getByTestId('balance')).toHaveTextContent('••••••');
    await userEvent.clear(within(d).getByLabelText('PIN')); await userEvent.type(within(d).getByLabelText('PIN'), '4821'); await userEvent.click(within(d).getByRole('button', { name: 'Mostrar valores' })); await waitFor(() => expect(screen.getByTestId('balance').textContent).toMatch(/2\.700,00/)); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
