import { centavos, pontosBase, type Centavos } from './centavos';
import { formatarBrl, formatarPercentual, interpretarBrl } from './texto';

describe('formatarBrl', () => {
  it.each([
    [4832000, 'R$ 48.320,00'],
    [-298, '-R$ 2,98'],
    [0, 'R$ 0,00'],
    [5, 'R$ 0,05'],
    [99, 'R$ 0,99'],
    [11900, 'R$ 119,00'],
    [100000000, 'R$ 1.000.000,00'],
    [-123456789, '-R$ 1.234.567,89'],
  ])('%i centavos → %s', (valor, texto) => {
    expect(formatarBrl(centavos(valor))).toBe(texto);
  });

  it('recusa um valor fracionário forçado por cast', () => {
    expect(() => formatarBrl(1.5 as Centavos)).toThrow(RangeError);
  });
});

describe('interpretarBrl', () => {
  it.each([
    ['R$ 48.320,00', 4832000],
    ['-R$ 2,98', -298],
    ['R$ -2,98', -298],
    ['R$ 1.234,56', 123456],
    ['1.234.567,89', 123456789],
    ['119', 11900],
    ['119,5', 11950],
    ['0,05', 5],
    ['  R$ 119,00  ', 11900],
    ['R$119,00', 11900],
    ['-0,00', 0],
  ])('%j → %i centavos', (texto, valor) => {
    expect(interpretarBrl(texto)).toBe(valor);
  });

  it.each(['', '   ', 'R$', 'abc', '1,234', '12.34', '1.2345', '1..234', '--1', '1-', '1,', ',50'])(
    '%j não é valor em reais',
    (texto) => {
      expect(interpretarBrl(texto)).toBeNull();
    },
  );

  it('valor acima do inteiro seguro não é aceito', () => {
    expect(interpretarBrl('90.071.992.547.409,92')).toBeNull();
  });
});

describe('formatarPercentual', () => {
  it.each([
    [250, '2,5%'],
    [4200, '42%'],
    [10000, '100%'],
    [0, '0%'],
    [-80, '-0,8%'],
    [380, '3,8%'],
  ])('%i pontos-base → %s', (valor, texto) => {
    expect(formatarPercentual(pontosBase(valor))).toBe(texto);
  });

  it('com uma casa, o meio vai para o par: 385 (3,85%) é exibido 3,8%', () => {
    expect(formatarPercentual(pontosBase(385))).toBe('3,8%');
    expect(formatarPercentual(pontosBase(375))).toBe('3,8%');
    expect(formatarPercentual(pontosBase(15))).toBe('0,2%');
  });

  it('fora do meio arredonda para o mais próximo', () => {
    expect(formatarPercentual(pontosBase(386))).toBe('3,9%');
    expect(formatarPercentual(pontosBase(384))).toBe('3,8%');
    expect(formatarPercentual(pontosBase(-386))).toBe('-3,9%');
  });

  it('com duas casas é exato; com zero casas arredonda para inteiro', () => {
    expect(formatarPercentual(pontosBase(385), 2)).toBe('3,85%');
    expect(formatarPercentual(pontosBase(1230), 2)).toBe('12,3%');
    expect(formatarPercentual(pontosBase(250), 0)).toBe('2%');
    expect(formatarPercentual(pontosBase(350), 0)).toBe('4%');
    expect(formatarPercentual(pontosBase(4260), 0)).toBe('43%');
  });

  it('um negativo que arredonda para zero não mostra o sinal', () => {
    expect(formatarPercentual(pontosBase(-4))).toBe('0%');
  });

  it('agrupa milhares', () => {
    expect(formatarPercentual(pontosBase(1234500))).toBe('12.345%');
  });
});
