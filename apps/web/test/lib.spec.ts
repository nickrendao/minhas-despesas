import { centsToInput, parseMoneyInput } from '../src/lib/money-input';
import { currentYm, monthLabel, shiftYm } from '../src/lib/months';

describe('entrada de dinheiro (reais digitados -> centavos)', () => {
  it.each([
    ['1.234,56', 123456], ['1234,56', 123456], ['1234.56', 123456], ['1234', 123400], ['R$ 10,5', 1050], ['10.5', 1050],
    ['1.234', 123400], ['1.234.567', 123456700], ['0,05', 5], [',5', 50], ['0', 0], ['80,06', 8006], ['0.1', 10],
  ])('"%s" => %i centavos', (input, cents) => expect(parseMoneyInput(input)).toBe(cents));
  it.each(['', 'abc', '-5', '1,2,3', '10,555', '1e5', '12a', '1.5.5,2', '99999999999'])('rejeita "%s"', (input) => expect(parseMoneyInput(input)).toBeNull());
  it('não tem erro de ponto flutuante (0,1 + 0,2)', () => expect(parseMoneyInput('0,1')! + parseMoneyInput('0,2')!).toBe(30));
  it('ida e volta com o campo de texto', () => { expect(centsToInput(150050)).toBe('1500,50'); expect(parseMoneyInput(centsToInput(150050))).toBe(150050); expect(centsToInput(0)).toBe(''); });
});
describe('meses', () => {
  it('navega atravessando o ano', () => { expect(shiftYm('2026-01', -1)).toBe('2025-12'); expect(shiftYm('2026-12', 1)).toBe('2027-01'); expect(shiftYm('2026-10', 0)).toBe('2026-10'); });
  it('rótulo em português', () => expect(monthLabel('2026-03')).toBe('março de 2026'));
  it('mês atual respeita o fuso (virada UTC)', () => {
    expect(currentYm('America/Sao_Paulo', new Date('2026-10-01T02:30:00Z'))).toBe('2026-09');
    expect(currentYm('UTC', new Date('2026-10-01T02:30:00Z'))).toBe('2026-10');
  });
});
