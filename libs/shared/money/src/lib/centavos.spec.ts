import { centavos, pontosBase, somar } from './centavos';

describe('centavos', () => {
  it('aceita inteiros, inclusive negativos e zero', () => {
    expect(centavos(11900)).toBe(11900);
    expect(centavos(-298)).toBe(-298);
    expect(centavos(0)).toBe(0);
  });

  it.each([1.5, 0.1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'recusa %s, que não é inteiro seguro',
    (valor) => {
      expect(() => centavos(valor)).toThrow(RangeError);
    },
  );

  it('explica o erro em português', () => {
    expect(() => centavos(2.5)).toThrow('Centavos precisam ser um inteiro seguro: 2.5');
  });
});

describe('pontosBase', () => {
  it('aceita inteiros (2,5% = 250)', () => {
    expect(pontosBase(250)).toBe(250);
    expect(pontosBase(-80)).toBe(-80);
  });

  it('recusa percentual fracionário', () => {
    expect(() => pontosBase(2.5)).toThrow('Pontos-base precisam ser um inteiro seguro: 2.5');
  });
});

describe('somar', () => {
  it('soma centavos com sinal', () => {
    expect(somar([centavos(11900), centavos(-298), centavos(5)])).toBe(11607);
  });

  it('a soma de nada é zero', () => {
    expect(somar([])).toBe(0);
  });

  it('recusa uma soma que estoura o inteiro seguro', () => {
    const maximo = centavos(Number.MAX_SAFE_INTEGER);

    expect(() => somar([maximo, centavos(1)])).toThrow(RangeError);
  });
});
