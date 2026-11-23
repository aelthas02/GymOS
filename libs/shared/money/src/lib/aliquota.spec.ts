import { aplicarAliquota } from './aliquota';
import { centavos, pontosBase } from './centavos';

describe('aplicarAliquota', () => {
  it('ISS de 2,5% sobre R$ 119,00 é R$ 2,98', () => {
    expect(aplicarAliquota(centavos(11900), pontosBase(250))).toBe(298);
  });

  it('arredonda o meio para cima com conta inteira (143,5 → 144; com float daria 143)', () => {
    expect(aplicarAliquota(centavos(5125), pontosBase(280))).toBe(144);
  });

  it('é simétrico para negativos (−2,975 → −2,98)', () => {
    expect(aplicarAliquota(centavos(-11900), pontosBase(250))).toBe(-298);
  });

  it('abaixo do meio arredonda para baixo, também nos negativos', () => {
    expect(aplicarAliquota(centavos(1), pontosBase(4999))).toBe(0);
    expect(aplicarAliquota(centavos(-1), pontosBase(4999))).toBe(0);
  });

  it('o meio exato vai para longe do zero', () => {
    expect(aplicarAliquota(centavos(1), pontosBase(5000))).toBe(1);
    expect(aplicarAliquota(centavos(-1), pontosBase(5000))).toBe(-1);
  });

  it('alíquota negativa dá desconto', () => {
    expect(aplicarAliquota(centavos(12900), pontosBase(-1000))).toBe(-1290);
  });

  it('alíquota ou valor zero dá zero', () => {
    expect(aplicarAliquota(centavos(0), pontosBase(250))).toBe(0);
    expect(aplicarAliquota(centavos(11900), pontosBase(0))).toBe(0);
  });

  it('é exata para valores cujo produto passa do inteiro seguro', () => {
    expect(aplicarAliquota(centavos(9_000_000_000_000_001), pontosBase(10000))).toBe(
      9_000_000_000_000_001,
    );
    expect(aplicarAliquota(centavos(9_000_000_000_000_000), pontosBase(250))).toBe(
      225_000_000_000_000,
    );
  });

  it('recusa um resultado que não cabe em centavos', () => {
    expect(() => aplicarAliquota(centavos(Number.MAX_SAFE_INTEGER), pontosBase(20000))).toThrow(
      RangeError,
    );
  });
});
