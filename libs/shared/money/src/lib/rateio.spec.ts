import { centavos, pontosBase, somar, type Centavos, type PontosBase } from './centavos';
import { ratear, ratearPorPeso } from './rateio';

describe('ratear', () => {
  it('R$ 948,00 em 9 parcelas: 8 × 105,33 e a última 105,36', () => {
    const parcelas = ratear(centavos(94800), 9);

    expect(parcelas).toEqual([...Array<number>(8).fill(10533), 10536]);
    expect(somar(parcelas)).toBe(94800);
  });

  it('uma parcela leva o total', () => {
    expect(ratear(centavos(11900), 1)).toEqual([11900]);
  });

  it('divisão exata não deixa resto', () => {
    expect(ratear(centavos(30000), 3)).toEqual([10000, 10000, 10000]);
  });

  it('total menor que o número de parcelas põe tudo na última', () => {
    expect(ratear(centavos(2), 3)).toEqual([0, 0, 2]);
  });

  it('total negativo (estorno) também põe o resto na última', () => {
    const parcelas = ratear(centavos(-100), 3);

    expect(parcelas).toEqual([-33, -33, -34]);
    expect(somar(parcelas)).toBe(-100);
  });

  it.each([0, -1, 1.5, Number.NaN])('recusa %s parcelas', (quantidade) => {
    expect(() => ratear(centavos(100), quantidade)).toThrow(RangeError);
  });
});

describe('ratearPorPeso', () => {
  it('R$ 119,00 nos pesos 6, 3 e 1', () => {
    expect(ratearPorPeso(centavos(11900), [6, 3, 1])).toEqual([7140, 3570, 1190]);
  });

  it('R$ 100,00 em três partes iguais soma exato pelo maior resto', () => {
    const partes = ratearPorPeso(centavos(10000), [1, 1, 1]);

    expect(partes).toEqual([3334, 3333, 3333]);
    expect(somar(partes)).toBe(10000);
  });

  it('a sobra vai para o maior resto, não para a primeira parte', () => {
    expect(ratearPorPeso(centavos(100), [1, 2])).toEqual([33, 67]);
  });

  it('peso zero recebe zero', () => {
    expect(ratearPorPeso(centavos(100), [0, 1])).toEqual([0, 100]);
  });

  it('é simétrico para total negativo', () => {
    expect(ratearPorPeso(centavos(-100), [1, 2])).toEqual([-33, -67]);
  });

  it('rateia pontos-base para porcentagens que somam 100%', () => {
    const porcentagens: PontosBase[] = ratearPorPeso(pontosBase(10000), [2, 1, 1, 2]);

    expect(porcentagens).toEqual([3333, 1667, 1667, 3333]);
    expect(porcentagens.reduce((soma, parte) => soma + parte, 0)).toBe(10000);
  });

  it('é exato para totais grandes', () => {
    const total = centavos(9_000_000_000_000_001);
    const partes: Centavos[] = ratearPorPeso(total, [1, 2]);

    expect(partes).toEqual([3_000_000_000_000_000, 6_000_000_000_000_001]);
  });

  it('pesos cuja soma passa do inteiro seguro continuam exatos', () => {
    const peso = Number.MAX_SAFE_INTEGER;

    expect(ratearPorPeso(centavos(3), [peso, peso, peso])).toEqual([1, 1, 1]);
  });

  it.each([[[]], [[0, 0]], [[1, -1]], [[1.5, 1]], [[Number.NaN]]])(
    'recusa os pesos %j',
    (pesos) => {
      expect(() => ratearPorPeso(centavos(100), pesos)).toThrow(RangeError);
    },
  );
});
