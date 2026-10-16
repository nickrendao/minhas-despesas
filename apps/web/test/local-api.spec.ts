/** @jest-environment node */
import '../local/zod-jitless';   // como no app: carregar ANTES de @fin/shared
import { todayIn } from '@fin/shared';
import { monthSummary } from '../../api/src/domain/finance';
import { browserStore, LocalBackend, Store } from '../local/local-api';
import { sha256Hex } from '../local/sha256';

class MemStore implements Store { v: string | null = null; fail = false; writes = 0; read() { return this.v; } write(x: string) { if (this.fail) throw new Error('cheio'); this.v = x; this.writes++; } clear() { this.v = null; } }
const OCT = '2026-10', NOV = '2026-11';
function mk(extra: { fetchImpl?: any } = {}, store = new MemStore()) { let t = 1_800_000_000_000; const clock = { advance: (ms: number) => { t += ms; } }; const api = new LocalBackend(store, { now: () => t, ...extra }); return { api, store, clock, reopen: () => new LocalBackend(store, { now: () => t, ...extra }) }; }
const code = (c: string, status?: number) => expect.objectContaining({ code: c, ...(status ? { status } : {}) });

describe('compatível com política de segurança estrita (sem eval)', () => {
  it('validar e usar o servidor local NÃO chama eval nem new Function (o app é publicado sem unsafe-eval)', async () => {
    const real = global.Function; let tentou = 0; (global as any).Function = new Proxy(real, { construct(t, args, nt) { tentou++; return Reflect.construct(t, args, nt); }, apply(t, th, args) { tentou++; return Reflect.apply(t, th, args); } });
    try { const { api } = mk(); await api.incomes.create({ ym: OCT, name: 'Salário', amountCents: 100 }); await api.expenses.create({ ym: OCT, name: 'Luz', amountCents: 5, dueDay: 3 }); await api.cards.create({ name: 'N', limitCents: 1 }); await api.me.updateSettings({ theme: 'dark' }); await api.incomes.create({ ym: OCT, amountCents: -1 }).catch(() => undefined); }
    finally { (global as any).Function = real; }
    expect(tentou).toBe(0);
  });
});

describe('começa do ZERO (nada de dados de exemplo)', () => {
  it('conta nova: sem rendas, despesas, cartões, investimentos nem moedas; tutorial ainda não visto', async () => {
    const { api } = mk(); const me = await api.me.get();
    expect(me.settings).toMatchObject({ displayName: null, theme: 'light', locale: 'pt', monthlyGoalCents: 0, privacyMode: false, hasPin: false, tutorialVersion: 0, onboarded: false });
    expect(me.local.lastBackupAt).toBeNull(); expect(await api.months.open(OCT)).toEqual({ ym: OCT, incomes: [], expenses: [] });
    expect(await api.cards.list()).toEqual([]); expect(await api.investments.list()).toEqual([]); expect(await api.reports.agenda(3)).toEqual([]); expect((await api.expenses.list({})).data).toEqual([]);
    const v = await api.crypto.valuation(); expect(v.items).toEqual([]); expect(v.totals).toMatchObject({ pricedCount: 0, investedCents: 0 });
    expect(await api.reports.summary(OCT)).toMatchObject({ incomeCents: 0, expensesCents: 0, balanceCents: 0, goal: null, distribution: [] });
    const y = await api.reports.yearly(2026); expect(y.months).toHaveLength(12); expect(y.totalYearCents).toBe(0); expect(await api.reports.dues(OCT)).toEqual([]);
  });
  it('ler não grava nada (só a 1ª alteração cria dados no aparelho)', async () => {
    const { api, store } = mk(); await api.me.get(); await api.cards.list(); await api.reports.summary(OCT); await api.crypto.valuation(); expect(store.writes).toBe(0); expect(store.v).toBeNull();
    await api.incomes.create({ ym: OCT, name: 'Salário', amountCents: 100 }); expect(store.writes).toBe(1);
  });
  it('fuso horário inicial = o do aparelho', async () => { const { api } = mk(); expect((await api.me.get()).settings.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone); });
});

describe('persistência no aparelho', () => {
  it('tudo que a pessoa registra volta igual depois de fechar e abrir o app', async () => {
    const { api, reopen } = mk(); const inc = await api.incomes.create({ ym: OCT, name: 'Salário', amountCents: 500000, recurring: true });
    const exp = await api.expenses.create({ ym: OCT, name: 'Aluguel', amountCents: 150000, dueDay: 5, icon: 'home' }); const card = await api.cards.create({ name: 'Nubank', limitCents: 400000 }); await api.cards.addPurchase(card.id, { name: 'TV', amountCents: 90000, installmentCurrent: 2, installmentTotal: 10 });
    await api.investments.create({ name: 'Reserva', type: 'cdb', targetLimitCents: 100000, monthlyAmountCents: 25000 }); await api.crypto.create({ coinId: 'bitcoin', quantity: '0.5', buyPriceCents: 20000000 }); await api.me.updateSettings({ displayName: 'Ana', theme: 'dark', monthlyGoalCents: 300000 });
    const b = reopen(); const snap = await b.months.open(OCT);
    expect(snap.incomes[0]).toMatchObject({ id: inc.id, name: 'Salário', isPrimary: true }); expect(snap.expenses[0]).toMatchObject({ id: exp.id, icon: 'home', dueDay: 5 }); expect((await b.cards.list())[0]).toMatchObject({ name: 'Nubank', usedCents: 90000 });
    expect((await b.investments.list())[0]).toMatchObject({ monthsToTarget: 4 }); expect((await b.crypto.valuation()).items[0]).toMatchObject({ coinId: 'bitcoin', quantity: '0.5' }); expect((await b.me.get()).settings).toMatchObject({ displayName: 'Ana', theme: 'dark', monthlyGoalCents: 300000 });
  });
  it('falha ao gravar (sem espaço): erro claro e NADA fica pela metade na tela', async () => {
    const { api, store } = mk(); await api.incomes.create({ ym: OCT, name: 'Salário', amountCents: 100 }); store.fail = true;
    await expect(api.expenses.create({ ym: OCT, name: 'Luz', amountCents: 5 })).rejects.toEqual(code('STORAGE_ERROR', 500)); expect((await api.months.open(OCT)).expenses).toHaveLength(0);
    expect((await api.months.open(NOV)).incomes).toEqual([]);   // abrir um mês continua funcionando mesmo sem espaço para gravar
    store.fail = false; await api.expenses.create({ ym: OCT, name: 'Luz', amountCents: 5 }); expect((await api.months.open(OCT)).expenses).toHaveLength(1);
  });
  it('dado corrompido no aparelho não derruba o app: começa vazio', async () => { const s = new MemStore(); s.v = '{lixo'; const { api } = mk({}, s); expect((await api.months.open(OCT)).incomes).toEqual([]); s.v = JSON.stringify({ v: 2, months: {} }); expect((await mk({}, s).api.cards.list())).toEqual([]); });
  it('várias alterações seguidas ficam todas gravadas, na ordem', async () => { const { api, reopen } = mk(); for (let i = 1; i <= 5; i++) await api.expenses.create({ ym: OCT, name: `D${i}`, amountCents: i }); expect((await reopen().months.open(OCT)).expenses.map((e) => e.name)).toEqual(['D1', 'D2', 'D3', 'D4', 'D5']); });
});

describe('armazenamento duplo (localStorage + SharedPreferences do Android)', () => {
  const setup = (ls: string | null, an: string | null) => {
    const mem: Record<string, string> = ls === null ? {} : { 'md.local.v1': ls }; let android = an; const calls = { save: 0 };
    (globalThis as any).localStorage = { getItem: (k: string) => (k in mem ? mem[k] : null), setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } };
    (globalThis as any).window = { AndroidApp: { loadData: () => android ?? '', saveData: (v: string) => { calls.save++; android = v; return true; } } }; return { mem, calls, get android() { return android; } };
  };
  afterAll(() => { delete (globalThis as any).localStorage; delete (globalThis as any).window; });
  const doc = (savedAt: number, tag: string) => JSON.stringify({ v: 1, savedAt, tag });
  it('vale o MAIS NOVO dos dois (se o WebView ficou para trás, o Android recupera)', () => { setup(doc(100, 'ls'), doc(200, 'an')); expect(JSON.parse(browserStore().read()!).tag).toBe('an'); setup(doc(300, 'ls'), doc(200, 'an')); expect(JSON.parse(browserStore().read()!).tag).toBe('ls'); });
  it('só um dos dois existe / o outro está corrompido', () => { setup(null, doc(5, 'an')); expect(JSON.parse(browserStore().read()!).tag).toBe('an'); setup(doc(5, 'ls'), null); expect(JSON.parse(browserStore().read()!).tag).toBe('ls'); setup('{lixo', doc(5, 'an')); expect(JSON.parse(browserStore().read()!).tag).toBe('an'); setup('{lixo', '{lixo'); expect(browserStore().read()).toBeNull(); });
  it('grava nos dois lugares; se um falhar o app continua; se os dois falharem, avisa', () => {
    const s = setup(null, null); browserStore().write(doc(1, 'x')); expect(s.mem['md.local.v1']).toBe(doc(1, 'x')); expect(s.android).toBe(doc(1, 'x'));
    (globalThis as any).localStorage.setItem = () => { throw new Error('cheio'); }; expect(() => browserStore().write(doc(2, 'y'))).not.toThrow(); expect(s.android).toBe(doc(2, 'y'));
    (globalThis as any).window.AndroidApp.saveData = () => false; expect(() => browserStore().write(doc(3, 'z'))).toThrow('storage');
  });
  it('sem a ponte do Android (navegador comum) usa só o localStorage', () => { setup(doc(1, 'ls'), null); delete (globalThis as any).window.AndroidApp; expect(JSON.parse(browserStore().read()!).tag).toBe('ls'); expect(() => browserStore().write(doc(2, 'n'))).not.toThrow(); });
  it('clear apaga os dois', () => { const s = setup(doc(1, 'ls'), doc(1, 'an')); browserStore().clear(); expect(s.mem['md.local.v1']).toBeUndefined(); expect(s.android).toBe(''); });
});

describe('rendas — mesmas regras do servidor', () => {
  const inc = (api: LocalBackend, name: string, extra: any = {}, ym = OCT) => api.incomes.create({ ym, name, amountCents: 1000, ...extra });
  const prim = async (api: LocalBackend, ym = OCT) => (await api.months.open(ym)).incomes.filter((i: any) => i.isPrimary).map((i: any) => i.name);
  it('a 1ª renda do mês vira principal; criar como principal troca; lista com a principal primeiro', async () => { const { api } = mk(); await inc(api, 'Salário'); const f = await inc(api, 'Freela'); expect(f.isPrimary).toBe(false); await inc(api, 'Bônus', { isPrimary: true }); expect(await prim(api)).toEqual(['Bônus']); expect((await api.months.open(OCT)).incomes[0].name).toBe('Bônus'); });
  it('estrela troca; "desmarcar" a principal é 409 PRIMARY_REQUIRED; renomear não mexe na principal', async () => {
    const { api } = mk(); const a = await inc(api, 'Salário'); const b = await inc(api, 'Freela'); await api.incomes.update(b.id, { isPrimary: true }); expect(await prim(api)).toEqual(['Freela']);
    await expect(api.incomes.update(b.id, { isPrimary: false })).rejects.toEqual(code('PRIMARY_REQUIRED', 409)); await api.incomes.update(a.id, { isPrimary: false }); await api.incomes.update(b.id, { name: 'Consultoria', amountCents: 5 }); expect(await prim(api)).toEqual(['Consultoria']);
  });
  it('apagar a principal promove a mais antiga; limite de 3 por mês; meses independentes', async () => {
    const { api } = mk(); const a = await inc(api, 'A'); await inc(api, 'B'); await inc(api, 'C'); await expect(inc(api, 'D')).rejects.toEqual(code('LIMIT_REACHED', 409)); await api.incomes.remove(a.id); expect(await prim(api)).toEqual(['B']);
    await inc(api, 'D'); expect((await inc(api, 'Outro mês', {}, NOV)).isPrimary).toBe(true); expect(await prim(api)).toHaveLength(1);
  });
  it('validação igual à do servidor: nome vazio/enorme, valor negativo ou fracionado, mês inválido', async () => {
    const { api } = mk(); await expect(api.incomes.create({ ym: OCT, name: 'x'.repeat(25), amountCents: 1 })).rejects.toEqual(code('VALIDATION_ERROR', 400)); await expect(api.incomes.create({ ym: OCT, amountCents: -1 })).rejects.toEqual(code('VALIDATION_ERROR'));
    await expect(api.incomes.create({ ym: OCT, amountCents: 1.5 })).rejects.toEqual(code('VALIDATION_ERROR')); await expect(api.incomes.create({ ym: '2026-13', amountCents: 1 })).rejects.toEqual(code('VALIDATION_ERROR'));
    const e = await api.incomes.create({ ym: OCT, amountCents: 5 }).catch((x) => x); expect(e.name).toBe('Renda'); const err = await api.incomes.create({ ym: OCT, amountCents: -1 }).catch((x) => x); expect(err.details[0].path).toBe('amountCents');
  });
});

describe('despesas, recorrência e cópia de mês', () => {
  it('padrões: ícone "receipt", cor por rotação, vencimento e parcelas opcionais; validações', async () => {
    const { api } = mk(); const a = await api.expenses.create({ ym: OCT, name: 'A', amountCents: 1 }); const b = await api.expenses.create({ ym: OCT, name: 'B', amountCents: 1 });
    expect(a).toMatchObject({ icon: 'receipt', dueDay: null, installmentCurrent: null, recurring: false }); expect(a.color).not.toBe(b.color);
    for (const bad of [{ dueDay: 0 }, { dueDay: 32 }, { installmentCurrent: 5, installmentTotal: 3 }, { name: '' }, { icon: 'x'.repeat(25) }, { color: 'azul' }]) await expect(api.expenses.create({ ym: OCT, name: 'X', amountCents: 1, ...bad })).rejects.toEqual(code('VALIDATION_ERROR'));
  });
  it('editar ícone/cor/vencimento (inclusive limpar com null) e excluir', async () => {
    const { api } = mk(); const e = await api.expenses.create({ ym: OCT, name: 'Net', amountCents: 9990, dueDay: 10 }); const u = await api.expenses.update(e.id, { icon: 'wifi', color: '#3B6B8C', dueDay: null });
    expect(u).toMatchObject({ icon: 'wifi', color: '#3B6B8C', dueDay: null }); await expect(api.expenses.update(e.id, { installmentCurrent: 4, installmentTotal: 2 })).rejects.toEqual(code('VALIDATION_ERROR')); expect((await api.months.open(OCT)).expenses[0].installmentCurrent).toBeNull();
    await api.expenses.remove(e.id); expect((await api.months.open(OCT)).expenses).toEqual([]); await expect(api.expenses.remove(e.id)).rejects.toEqual(code('NOT_FOUND', 404));
  });
  it('busca em todos os meses, por tipo e com paginação (como o servidor)', async () => {
    const { api } = mk(); await api.expenses.create({ ym: '2026-03', name: 'Aluguel antigo', amountCents: 1, recurring: true }); await api.expenses.create({ ym: OCT, name: 'Aluguel', amountCents: 2, recurring: true }); await api.expenses.create({ ym: OCT, name: 'Mercado', amountCents: 3 });
    const r = await api.expenses.list({ q: 'alug' }); expect(r.data.map((e: any) => e.ym)).toEqual([OCT, '2026-03']); expect(r.meta).toMatchObject({ total: 2, page: 1, totalPages: 1 });
    expect((await api.expenses.list({ ym: OCT, type: 'variable' })).data.map((e: any) => e.name)).toEqual(['Mercado']); const p = await api.expenses.list({ limit: 2, page: 2 }); expect(p.data).toHaveLength(1); expect(p.meta.totalPages).toBe(2);
  });
  it('abrir o mês copia as RECORRENTES do mês anterior uma só vez (apagar e reabrir não ressuscita)', async () => {
    const { api } = mk(); await api.incomes.create({ ym: OCT, name: 'Salário', amountCents: 500000, recurring: true }); await api.incomes.create({ ym: OCT, name: 'Avulsa', amountCents: 1 });
    await api.expenses.create({ ym: OCT, name: 'Plano', amountCents: 99, recurring: true, icon: 'wifi', color: '#3B6B8C', dueDay: 7, installmentCurrent: 2, installmentTotal: 6 }); await api.expenses.create({ ym: OCT, name: 'Mercado', amountCents: 5 });
    const nov = await api.months.open(NOV); expect(nov.incomes.map((i: any) => i.name)).toEqual(['Salário']); expect(nov.expenses).toHaveLength(1); expect(nov.expenses[0]).toMatchObject({ name: 'Plano', icon: 'wifi', color: '#3B6B8C', dueDay: 7, installmentCurrent: 2 });
    await api.expenses.remove(nov.expenses[0].id); expect((await api.months.open(NOV)).expenses).toEqual([]); expect((await api.months.open('2027-05')).incomes).toEqual([]);
  });
  it('a recorrência leva a principal; se a principal não era recorrente, a mais antiga assume', async () => {
    const { api } = mk(); await api.incomes.create({ ym: OCT, name: 'Avulsa principal', amountCents: 1 }); await api.incomes.create({ ym: OCT, name: 'Fixa', amountCents: 2, recurring: true }); const n = await api.months.open(NOV); expect(n.incomes).toHaveLength(1); expect(n.incomes[0]).toMatchObject({ name: 'Fixa', isPrimary: true });
  });
  it('copiar mês: tudo vai; SAME_MONTH; MONTH_NOT_EMPTY sem overwrite; com overwrite substitui e mantém uma só principal', async () => {
    const { api } = mk(); await api.incomes.create({ ym: OCT, name: 'Salário', amountCents: 1 }); const f = await api.incomes.create({ ym: OCT, name: 'Freela', amountCents: 2 }); await api.incomes.update(f.id, { isPrimary: true }); await api.expenses.create({ ym: OCT, name: 'Mercado', amountCents: 3 });
    await expect(api.months.copy(OCT, OCT)).rejects.toEqual(code('SAME_MONTH', 400)); expect(await api.months.copy(OCT, '2026-12')).toEqual({ copiedIncomes: 2, copiedExpenses: 1 });
    const dst = await api.months.open('2026-12'); expect(dst.incomes.filter((i: any) => i.isPrimary).map((i: any) => i.name)).toEqual(['Freela']); await expect(api.months.copy(OCT, '2026-12')).rejects.toEqual(code('MONTH_NOT_EMPTY', 409));
    await api.expenses.create({ ym: OCT, name: 'Novo', amountCents: 1 }); await api.months.copy(OCT, '2026-12', true); expect((await api.months.open('2026-12')).expenses).toHaveLength(2);
  });
});

describe('cartões, investimentos e relatórios', () => {
  it('até 5 cartões; compras (valor > 0, parcelas coerentes); uso, disponível e alerta em 80%', async () => {
    const { api } = mk(); const c = await api.cards.create({ name: 'Nubank', limitCents: 100000 }); await expect(api.cards.addPurchase(c.id, { name: 'x', amountCents: 0 })).rejects.toEqual(code('VALIDATION_ERROR')); await expect(api.cards.addPurchase(c.id, { amountCents: 5, installmentCurrent: 5, installmentTotal: 2 })).rejects.toEqual(code('VALIDATION_ERROR'));
    await api.cards.addPurchase(c.id, { name: 'TV', amountCents: 79999 }); let v = (await api.cards.list())[0]; expect(v).toMatchObject({ usedCents: 79999, availableCents: 20001, warn: false }); await api.cards.addPurchase(c.id, { amountCents: 1 }); v = (await api.cards.list())[0]; expect(v.warn).toBe(true); expect(v.purchases[1].name).toBe('Gasto');
    for (let i = 0; i < 4; i++) await api.cards.create({}); await expect(api.cards.create({})).rejects.toEqual(code('LIMIT_REACHED', 409)); await api.cards.removePurchase(c.id, v.purchases[0].id); await api.cards.remove(c.id); expect(await api.cards.list()).toHaveLength(4); await expect(api.cards.remove(c.id)).rejects.toEqual(code('NOT_FOUND'));
  });
  it('investimentos: padrões, meses até a meta e edição', async () => { const { api } = mk(); const i = await api.investments.create({}); expect(i).toMatchObject({ name: 'Meu investimento', type: 'tesouro_selic', monthsToTarget: 0 }); const u = await api.investments.update(i.id, { targetLimitCents: 100000, monthlyAmountCents: 30000 }); expect(u.monthsToTarget).toBe(4); await expect(api.investments.update(i.id, { type: 'bitcoinzao' })).rejects.toEqual(code('VALIDATION_ERROR')); });
  it('resumo = as MESMAS contas do servidor (função compartilhada); meta; ano', async () => {
    const { api } = mk(); await api.incomes.create({ ym: OCT, name: 'Salário', amountCents: 500000 }); const e1 = await api.expenses.create({ ym: OCT, name: 'Aluguel', amountCents: 150000, color: '#3B6B8C', recurring: true }); const e2 = await api.expenses.create({ ym: OCT, name: 'Mercado', amountCents: 80000, color: '#B85C38' }); await api.me.updateSettings({ monthlyGoalCents: 200000 });
    const direct = monthSummary({ incomeCents: [500000], goalCents: 200000, reserveMonths: 9, expenses: [{ id: e1.id, name: 'Aluguel', color: '#3B6B8C', amountCents: 150000, recurring: true }, { id: e2.id, name: 'Mercado', color: '#B85C38', amountCents: 80000, recurring: false }] });
    expect(await api.reports.summary(OCT, 9)).toEqual({ ym: OCT, ...direct }); expect((await api.reports.summary(OCT)).goal).toMatchObject({ goalCents: 200000, exceeded: true }); await expect(api.reports.summary(OCT, 2)).rejects.toEqual(code('VALIDATION_ERROR'));
    const y = await api.reports.yearly(2026); expect(y.totalYearCents).toBe(230000); expect(y.biggestMonth).toMatchObject({ ym: OCT, expensesCents: 230000 });
  });
  it('vencimentos: mês atual esconde o que já passou; mês futuro mostra todos; agenda só dos meses guardados, em ordem', async () => {
    const { api } = mk(); const today = todayIn((await api.me.get()).settings.timezone); await api.expenses.create({ ym: today.ym, name: 'Hoje', amountCents: 1, dueDay: today.day }); await api.expenses.create({ ym: '2099-01', name: 'Futura', amountCents: 2, dueDay: 28 });
    const d = await api.reports.dues(today.ym); expect(d[0]).toMatchObject({ name: 'Hoje', daysUntil: 0, urgent: true }); expect((await api.reports.dues('2099-01'))[0]).toMatchObject({ name: 'Futura', daysUntil: null });
    expect((await api.reports.agenda(3)).map((x) => x.name)).toEqual(['Hoje']);
  });
});

describe('cripto (CoinGecko direto do aparelho)', () => {
  const ok = (body: any) => jest.fn(async () => ({ ok: true, status: 200, json: async () => body }));
  it('busca só as moedas que a pessoa tem; cacheia 30 s; recalcula rendimento', async () => {
    const f = ok({ bitcoin: { brl: 300000, brl_24h_change: 2.5 } }); const { api, clock } = mk({ fetchImpl: f }); await api.crypto.create({ coinId: 'bitcoin', quantity: '0.5', buyPriceCents: 20000000 }); await api.crypto.create({ coinId: null });
    const v = await api.crypto.valuation(); expect(f).toHaveBeenCalledTimes(1); expect((f.mock.calls[0] as any[])[0]).toContain('ids=bitcoin&vs_currencies=brl&include_24hr_change=true');
    expect(v.items[0]).toMatchObject({ priceAvailable: true, currentPriceCents: 30000000, change24hPercent: 2.5, currentValueCents: 15000000, gainCents: 5000000 }); expect(v.items[1].priceAvailable).toBe(false); expect(v.totals.pricedCount).toBe(1);
    await api.crypto.valuation(); await api.crypto.valuation(); expect(f).toHaveBeenCalledTimes(1); clock.advance(31_000); await api.crypto.valuation(); expect(f).toHaveBeenCalledTimes(2);
  });
  it('sem internet: usa o ÚLTIMO preço conhecido (com o horário antigo); sem nenhum preço, avisa sem quebrar', async () => {
    let up = true; const f = jest.fn(async () => { if (!up) throw new Error('offline'); return { ok: true, json: async () => ({ ethereum: { brl: 18000 } }) }; }); const { api, clock, reopen } = mk({ fetchImpl: f }); await api.crypto.create({ coinId: 'ethereum', quantity: '2', buyPriceCents: 1000000 });
    const a = await api.crypto.valuation(); up = false; clock.advance(60_000); const b = await api.crypto.valuation(); expect(b.items[0]).toMatchObject({ priceAvailable: true, currentPriceCents: 1800000 }); expect(b.asOf).toBe(a.asOf);
    const c = await reopen().crypto.valuation(); expect(c.items[0].priceAvailable).toBe(true);       // o último preço sobrevive a fechar o app
    const sem = mk({ fetchImpl: jest.fn(async () => { throw new Error('offline'); }) }); await sem.api.crypto.create({ coinId: 'solana', quantity: '1' }); expect((await sem.api.crypto.valuation()).items[0]).toMatchObject({ priceAvailable: false, currentPriceCents: null, currentValueCents: null });
  });
  it('resposta ruim da CoinGecko (429, JSON estranho, preço inválido) não quebra', async () => {
    for (const f of [jest.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })), ok({ bitcoin: { brl: 'x' } }), ok({}), ok(null as any)]) { const { api } = mk({ fetchImpl: f }); await api.crypto.create({ coinId: 'bitcoin', quantity: '1' }); expect((await api.crypto.valuation()).items[0].priceAvailable).toBe(false); }
  });
  it('várias telas pedindo ao mesmo tempo geram UMA só consulta; validações (quantidade "1e5", moeda desconhecida, excluir)', async () => {
    const f = ok({ bitcoin: { brl: 1 } }); const { api } = mk({ fetchImpl: f }); const h = await api.crypto.create({ coinId: 'bitcoin', quantity: '1' }); await Promise.all([api.crypto.valuation(), api.crypto.valuation(), api.crypto.valuation()]); expect(f).toHaveBeenCalledTimes(1);
    await expect(api.crypto.update(h.id, { quantity: '1e5' })).rejects.toEqual(code('VALIDATION_ERROR')); await expect(api.crypto.update(h.id, { coinId: 'dogecoinzao' })).rejects.toEqual(code('VALIDATION_ERROR')); await api.crypto.update(h.id, { quantity: '0.000000000123' }); await api.crypto.remove(h.id); await expect(api.crypto.remove(h.id)).rejects.toEqual(code('NOT_FOUND'));
  });
});

describe('PIN (trava de tela, nunca em texto puro)', () => {
  it('SHA-256 correto (vetores oficiais)', () => { expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'); expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'); expect(sha256Hex('a'.repeat(1000))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3'); });
  it('definir, conferir, trocar e remover; o PIN não aparece no que fica gravado', async () => {
    const { api, store } = mk(); await api.me.setPin('4821'); expect((await api.me.get()).settings.hasPin).toBe(true); expect(await api.me.verifyPin('4821')).toEqual({ valid: true }); expect(await api.me.verifyPin('0000')).toEqual({ valid: false });
    expect(store.v).not.toContain('4821'); expect(JSON.parse(store.v!).pin).toEqual({ salt: expect.any(String), hash: expect.stringMatching(/^[0-9a-f]{64}$/) }); await api.me.setPin('123456'); expect((await api.me.verifyPin('4821')).valid).toBe(false); await expect(api.me.setPin('12')).rejects.toEqual(code('VALIDATION_ERROR')); await api.me.setPin(null); expect((await api.me.get()).settings.hasPin).toBe(false);
  });
});

describe('backup e restauração', () => {
  async function filled() { const m = mk(); const { api } = m; await api.incomes.create({ ym: OCT, name: 'Salário', amountCents: 500000, recurring: true }); await api.incomes.create({ ym: OCT, name: 'Freela', amountCents: 80000 }); await api.expenses.create({ ym: OCT, name: 'Aluguel', amountCents: 150000, icon: 'home', color: '#B85C38', dueDay: 5, recurring: true });
    const c = await api.cards.create({ name: 'Nubank', limitCents: 400000 }); await api.cards.addPurchase(c.id, { name: 'TV', amountCents: 90000, installmentCurrent: 2, installmentTotal: 10 }); await api.investments.create({ name: 'Reserva', type: 'cdb', targetLimitCents: 100000, monthlyAmountCents: 25000 }); await api.crypto.create({ coinId: 'bitcoin', quantity: '0.5', buyPriceCents: 1 });
    await api.me.updateSettings({ displayName: 'Ana', theme: 'dark', tutorialVersion: 1 }); await api.months.open(NOV); await api.me.setPin('4821'); return m; }
  const state = async (api: LocalBackend) => ({ oct: await api.months.open(OCT), nov: await api.months.open(NOV), cards: await api.cards.list(), inv: await api.investments.list(), settings: (await api.me.get()).settings });
  it('o backup traz tudo, sem o PIN e sem cotações, e registra a data do último backup', async () => { const { api, clock } = await filled(); clock.advance(5); const b = await api.me.export(); expect(b).toMatchObject({ app: 'minhas-despesas-local', version: 1 }); expect(JSON.stringify(b)).not.toMatch(/4821|"pin"|"hash"|prices/); expect(Object.keys(b.data.months)).toEqual(expect.arrayContaining([OCT, NOV])); expect((await api.me.get()).local.lastBackupAt).not.toBeNull(); });
  it('IDA E VOLTA: restaurar num aparelho novo reproduz tudo (e o JSON pode vir como texto)', async () => { const a = await filled(); const file = JSON.stringify(await a.api.me.export()); const fresh = mk(); await fresh.api.me.importBackup(file); const x = await state(a.api), y = await state(fresh.api); expect({ ...y, settings: { ...y.settings, hasPin: false } }).toEqual({ ...x, settings: { ...x.settings, hasPin: false } }); expect((await fresh.reopen().months.open(OCT)).incomes[0].name).toBe('Salário'); });
  it('restaurar SUBSTITUI os dados atuais e mantém o PIN e o último backup deste aparelho', async () => { const a = await filled(); const file = await a.api.me.export(); const other = mk(); await other.api.me.setPin('9999'); await other.api.expenses.create({ ym: OCT, name: 'Vai sumir', amountCents: 1 }); await other.api.me.importBackup(file); expect((await other.api.months.open(OCT)).expenses.map((e: any) => e.name)).toEqual(['Aluguel']); expect((await other.api.me.verifyPin('9999')).valid).toBe(true); });
  it('REJEITA backups inválidos e, se rejeitar, não mexe nos dados atuais', async () => {
    const a = await filled(); const good: any = JSON.parse(JSON.stringify(await a.api.me.export())); const before = await state(a.api); const tweak = (f: (b: any) => void) => { const b = JSON.parse(JSON.stringify(good)); f(b); return b; };
    const bads: [string, any][] = [['texto que não é JSON', '{lixo'], ['outro app', tweak((b) => { b.app = 'outro'; })], ['versão futura', tweak((b) => { b.version = 2; })], ['4 rendas no mês', tweak((b) => { b.data.months[OCT].incomes.push(...[1, 2, 3].map((i) => ({ id: `x${i}`, name: 'N', amountCents: 1, recurring: false, isPrimary: false }))); })],
      ['valor negativo', tweak((b) => { b.data.months[OCT].expenses[0].amountCents = -5; })], ['valor com centavos quebrados', tweak((b) => { b.data.months[OCT].expenses[0].amountCents = 1.5; })], ['mês inválido', tweak((b) => { b.data.months['2026-13'] = { incomes: [], expenses: [] }; })], ['cor inválida', tweak((b) => { b.data.cards[0].color = 'azul'; })],
      ['6 cartões', tweak((b) => { b.data.cards = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, name: 'C', color: '#112233', limitCents: 0, purchases: [] })); })], ['quantidade de cripto inválida', tweak((b) => { b.data.holdings[0].quantity = '1e5'; })], ['tema inválido', tweak((b) => { b.data.settings.theme = 'roxo'; })], ['vazio', null], ['número', 42]];
    for (const [nome, bad] of bads) await expect(a.api.me.importBackup(bad)).rejects.toEqual(expect.objectContaining({ code: 'INVALID_BACKUP', status: 400 })).catch((e) => { throw new Error(`"${nome}" não foi rejeitado: ${e.message}`); });
    expect(await state(a.api)).toEqual(before);
  });
  it('arruma a regra da renda principal vinda de um backup (duas principais → uma; nenhuma → a primeira)', async () => {
    const a = await filled(); const b: any = JSON.parse(JSON.stringify(await a.api.me.export())); b.data.months[OCT].incomes.forEach((i: any) => { i.isPrimary = true; }); const x = mk(); await x.api.me.importBackup(b); expect((await x.api.months.open(OCT)).incomes.filter((i: any) => i.isPrimary)).toHaveLength(1);
    b.data.months[OCT].incomes.forEach((i: any) => { i.isPrimary = false; }); await x.api.me.importBackup(b); expect((await x.api.months.open(OCT)).incomes.filter((i: any) => i.isPrimary)).toHaveLength(1);
  });
  it('depois de restaurar, o app continua funcionando (novos registros não repetem identificadores)', async () => { const a = await filled(); const x = mk(); await x.api.me.importBackup(await a.api.me.export()); const e = await x.api.expenses.create({ ym: OCT, name: 'Novo', amountCents: 1 }); const all = (await x.api.months.open(OCT)).expenses; expect(new Set(all.map((z: any) => z.id)).size).toBe(all.length); expect(all[all.length - 1].id).toBe(e.id); });
  it('APAGAR TUDO volta ao zero e limpa o armazenamento; o app aberto de novo começa vazio', async () => { const { api, store, reopen } = await filled(); await api.me.resetAll(); expect(store.v).toBeNull(); expect(await api.months.open(OCT)).toEqual({ ym: OCT, incomes: [], expenses: [] }); expect((await api.me.get()).settings).toMatchObject({ displayName: null, tutorialVersion: 0, hasPin: false }); expect(await reopen().cards.list()).toEqual([]); });
});
