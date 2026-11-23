import { aplicarAliquota } from './aliquota';
import { centavos, pontosBase, somar } from './centavos';
import { ratear, ratearPorPeso } from './rateio';
import { formatarBrl, interpretarBrl } from './texto';

/** Gerador determinístico (mulberry32) para as propriedades serem reproduzíveis. */
function gerador(semente: number): () => number {
  let estado = semente;
  return () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALEATORIO = gerador(20261123);
const inteiroAte = (limite: number): number => Math.floor(ALEATORIO() * limite);

const TOTAIS_FIXOS = [
  0,
  1,
  -1,
  2,
  -2,
  99,
  -99,
  94800,
  -94800,
  100_000_000_00,
  -100_000_000_00,
  Number.MAX_SAFE_INTEGER,
  -Number.MAX_SAFE_INTEGER,
];

function totais(): number[] {
  const sorteados = Array.from({ length: 200 }, () => {
    const magnitude = 10 ** inteiroAte(16);
    return (inteiroAte(2) ? 1 : -1) * inteiroAte(magnitude) + 0;
  });
  return [...TOTAIS_FIXOS, ...sorteados];
}

function pesosAleatorios(): number[] {
  const quantidade = 1 + inteiroAte(12);
  const pesos = Array.from({ length: quantidade }, () =>
    inteiroAte(3) === 0 ? 0 : inteiroAte(10 ** (1 + inteiroAte(9))),
  );
  return pesos.some((peso) => peso > 0) ? pesos : [...pesos, 1];
}

describe('propriedades do rateio', () => {
  it('somar(ratear(t, n)) === t para totais negativos, grandes e muitas quantidades', () => {
    for (const total of totais()) {
      for (const parcelas of [1, 2, 3, 7, 12, 13, 100, 997]) {
        const partes = ratear(centavos(total), parcelas);

        expect(partes).toHaveLength(parcelas);
        expect(somar(partes)).toBe(total);
      }
    }
  });

  it('as parcelas iguais de ratear diferem da última em menos de n centavos', () => {
    for (const total of totais()) {
      const parcelas = 1 + inteiroAte(50);
      const partes = ratear(centavos(total), parcelas);
      const base = partes[0];

      expect(partes.slice(0, -1).every((parte) => parte === base)).toBe(true);
      expect(Math.abs((partes[parcelas - 1] ?? 0) - (base ?? 0))).toBeLessThan(parcelas);
    }
  });

  it('somar(ratearPorPeso(t, pesos)) === t, inclusive com pesos zero e totais negativos', () => {
    for (const total of totais()) {
      for (let rodada = 0; rodada < 5; rodada++) {
        const pesos = pesosAleatorios();

        expect(somar(ratearPorPeso(centavos(total), pesos))).toBe(total);
      }
    }
  });

  it('cada parte de ratearPorPeso fica a menos de 1 centavo da cota exata', () => {
    for (const total of totais()) {
      const pesos = pesosAleatorios();
      const soma = pesos.reduce((acumulado, peso) => acumulado + BigInt(peso), 0n);
      const partes = ratearPorPeso(centavos(total), pesos);

      partes.forEach((parte, indice) => {
        const exatoVezesSoma = BigInt(total) * BigInt(pesos[indice] ?? 0);
        const desvio = BigInt(parte) * soma - exatoVezesSoma;

        expect(desvio < 0n ? -desvio : desvio).toBeLessThan(soma);
      });
    }
  });

  it('peso zero nunca recebe nada e as partes têm o sinal do total', () => {
    for (const total of totais()) {
      const pesos = pesosAleatorios();
      const partes = ratearPorPeso(centavos(total), pesos);

      partes.forEach((parte, indice) => {
        if (pesos[indice] === 0) {
          expect(parte).toBe(0);
        }
        expect(total < 0 ? parte <= 0 : parte >= 0).toBe(true);
      });
    }
  });
});

describe('ida e volta de formatarBrl e interpretarBrl', () => {
  it('interpretarBrl(formatarBrl(x)) === x para valores de borda e sorteados', () => {
    const valores = [
      ...TOTAIS_FIXOS,
      ...Array.from(
        { length: 500 },
        () => inteiroAte(10 ** inteiroAte(16)) * (inteiroAte(2) ? 1 : -1) + 0,
      ),
    ];

    for (const valor of valores) {
      expect(interpretarBrl(formatarBrl(centavos(valor)))).toBe(valor);
    }
  });

  it('formatarBrl sempre tem dois decimais e milhares de três em três', () => {
    for (const valor of [5, 50, 500, 100_000, 123_456_789]) {
      expect(formatarBrl(centavos(valor))).toMatch(/^R\$ \d{1,3}(\.\d{3})*,\d{2}$/);
    }
  });
});

describe('aplicarAliquota contra a conta de referência em BigInt', () => {
  /** Referência independente: arredonda |v·a / 10000| ao inteiro mais próximo, meio para longe do zero. */
  function referencia(valor: number, aliquota: number): bigint {
    const produto = BigInt(valor) * BigInt(aliquota);
    const absoluto = produto < 0n ? -produto : produto;
    const arredondado = (2n * absoluto + 10_000n) / 20_000n;
    return produto < 0n ? -arredondado : arredondado;
  }

  it('bate com a referência para valores e alíquotas variados', () => {
    const aliquotas = [0, 1, 50, 250, 280, 500, 4999, 5000, 5001, 9999, 10_000, 15_000, 123_456];
    const valoresBase = [0, 1, 2, 3, 19, 20, 5125, 11900, 99_999, 1_000_000_00, 90_071_992_547_409];
    const valores = [
      ...valoresBase,
      ...valoresBase.map((v) => -v),
      ...Array.from({ length: 300 }, () => inteiroAte(10 ** 9) - 5 * 10 ** 8),
    ];

    for (const valor of valores) {
      for (const aliquota of aliquotas) {
        expect(BigInt(aplicarAliquota(centavos(valor), pontosBase(aliquota)))).toBe(
          referencia(valor, aliquota),
        );
      }
    }
  });

  it('100% devolve o próprio valor e 0% devolve zero', () => {
    for (const valor of totais()) {
      expect(aplicarAliquota(centavos(valor), pontosBase(10_000))).toBe(valor);
      expect(aplicarAliquota(centavos(valor), pontosBase(0))).toBe(0);
    }
  });

  it('a aliquota sobre o valor negativo é o oposto da aliquota sobre o positivo', () => {
    for (let i = 0; i < 300; i++) {
      const valor = inteiroAte(10 ** 12);
      const aliquota = inteiroAte(20_000);

      expect(aplicarAliquota(centavos(-valor), pontosBase(aliquota))).toBe(
        -aplicarAliquota(centavos(valor), pontosBase(aliquota)) + 0,
      );
    }
  });
});
