import {
  alturas,
  corDaSerie,
  fatiasDonut,
  indiceDestaque,
  intensidade,
  passoDeRotulos,
  pontosDaLinha,
} from './escala';

describe('alturas', () => {
  it('[0, 56, 112] geram alturas proporcionais ao maior', () => {
    expect(alturas([0, 56, 112], 100)).toEqual([0, 50, 100]);
  });

  it('todos zero (ou lista vazia) não divide por zero', () => {
    expect(alturas([0, 0], 100)).toEqual([0, 0]);
    expect(alturas([], 100)).toEqual([]);
  });

  it('valor negativo ou inválido vira altura zero', () => {
    expect(alturas([-5, Number.NaN, 10], 100)).toEqual([0, 0, 100]);
  });
});

describe('indiceDestaque', () => {
  it('aponta o maior valor; no empate fica o primeiro', () => {
    expect(indiceDestaque([0, 56, 112])).toBe(2);
    expect(indiceDestaque([7, 9, 9])).toBe(1);
  });

  it('sem valor positivo não há destaque', () => {
    expect(indiceDestaque([0, 0])).toBe(-1);
    expect(indiceDestaque([])).toBe(-1);
  });
});

describe('fatiasDonut', () => {
  it('as fatias somam 360°', () => {
    const fatias = fatiasDonut([50, 30, 20]);
    expect(fatias.reduce((s, f) => s + f.angulo, 0)).toBeCloseTo(360, 10);
    expect(fatias.map((f) => f.angulo)).toEqual([180, 108, 72]);
  });

  it('cada fatia começa onde a anterior termina', () => {
    const fatias = fatiasDonut([1, 1, 2]);
    expect(fatias.map((f) => f.inicio)).toEqual([0, 90, 180]);
  });

  it('com um valor zero, a fatia tem 0° e as outras ainda somam 360°', () => {
    const fatias = fatiasDonut([60, 0, 40]);
    expect(fatias[1]!.angulo).toBe(0);
    expect(fatias.reduce((s, f) => s + f.angulo, 0)).toBeCloseTo(360, 10);
    expect(fatias[2]!.inicio).toBeCloseTo(216, 10);
  });

  it('total zero ou lista vazia devolve fatias de 0°', () => {
    expect(fatiasDonut([0, 0]).map((f) => f.angulo)).toEqual([0, 0]);
    expect(fatiasDonut([])).toEqual([]);
  });
});

describe('passoDeRotulos', () => {
  it('mostra todos até o limite e salta acima dele', () => {
    expect(passoDeRotulos(7)).toBe(1);
    expect(passoDeRotulos(12)).toBe(1);
    expect(passoDeRotulos(24)).toBe(2);
    expect(passoDeRotulos(0)).toBe(1);
  });
});

describe('pontosDaLinha', () => {
  it('distribui no eixo x e inverte o y (maior valor no topo)', () => {
    const pontos = pontosDaLinha([0, 50, 100], { largura: 100, altura: 40, margem: 0 });
    expect(pontos).toEqual([
      { x: 0, y: 40 },
      { x: 50, y: 20 },
      { x: 100, y: 0 },
    ]);
  });

  it('um único ponto fica no centro', () => {
    expect(pontosDaLinha([5], { largura: 100, altura: 40, margem: 0 })).toEqual([{ x: 50, y: 0 }]);
  });

  it('série constante fica na base, sem NaN', () => {
    const pontos = pontosDaLinha([3, 3], { largura: 10, altura: 10, margem: 0, baseZero: false });
    expect(pontos.every((p) => Number.isFinite(p.y))).toBe(true);
  });

  it('sem baseZero a escala vai do mínimo ao máximo', () => {
    const pontos = pontosDaLinha([40, 60], { largura: 10, altura: 10, margem: 0, baseZero: false });
    expect(pontos.map((p) => p.y)).toEqual([10, 0]);
  });
});

describe('intensidade', () => {
  it('é a razão com o máximo, entre 0 e 1', () => {
    expect(intensidade(5, 10)).toBe(0.5);
    expect(intensidade(20, 10)).toBe(1);
    expect(intensidade(3, 0)).toBe(0);
    expect(intensidade(-1, 10)).toBe(0);
  });
});

describe('corDaSerie', () => {
  it('a primeira série é o acento e as demais voltam ao ciclo', () => {
    expect(corDaSerie(0)).toBe('var(--accent)');
    expect(corDaSerie(1)).toBe('var(--chart-2)');
    expect(corDaSerie(5)).toBe('var(--accent)');
  });
});
