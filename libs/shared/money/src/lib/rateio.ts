import type { Centavos, PontosBase } from './centavos';

/** Divide o total em parcelas iguais; o resto da divisão fica na última (94800 / 9 → 8 × 10533 + 10536). */
export function ratear(total: Centavos, parcelas: number): Centavos[] {
  if (!Number.isSafeInteger(parcelas) || parcelas < 1) {
    throw new RangeError(`O número de parcelas precisa ser um inteiro positivo: ${parcelas}`);
  }
  const base = BigInt(total) / BigInt(parcelas);
  const ultima = BigInt(total) - base * BigInt(parcelas - 1);
  return [
    ...Array<Centavos>(parcelas - 1).fill(Number(base) as Centavos),
    Number(ultima) as Centavos,
  ];
}

function validarPesos(pesos: readonly number[]): bigint {
  const validos = pesos.every((peso) => Number.isSafeInteger(peso) && peso >= 0);
  const soma = pesos.reduce((acumulado, peso) => acumulado + peso, 0);
  if (!validos || soma <= 0) {
    throw new RangeError(
      `Os pesos precisam ser inteiros não negativos com soma positiva: ${JSON.stringify(pesos)}`,
    );
  }
  return BigInt(soma);
}

/**
 * Rateia o total proporcionalmente aos pesos pelo método do maior resto: cada parte recebe o piso
 * da sua cota e a sobra vai, um a um, para os maiores restos (empate: a parte que vem antes). A soma
 * das partes é sempre o total. Serve para centavos (rateio de receita) e para pontos-base
 * (porcentagens exibidas que precisam somar 100%).
 */
export function ratearPorPeso<T extends Centavos | PontosBase>(
  total: T,
  pesos: readonly number[],
): T[] {
  const somaDosPesos = validarPesos(pesos);
  const sinal = total < 0 ? -1n : 1n;
  const absoluto = BigInt(total) * sinal;

  const cotas = pesos.map((peso, indice) => {
    const produto = absoluto * BigInt(peso);
    return { indice, parte: produto / somaDosPesos, resto: produto % somaDosPesos };
  });

  const distribuido = cotas.reduce((soma, cota) => soma + cota.parte, 0n);
  const porMaiorResto = [...cotas].sort(
    (a, b) => Math.sign(Number(b.resto - a.resto)) || a.indice - b.indice,
  );
  porMaiorResto.slice(0, Number(absoluto - distribuido)).forEach((cota) => {
    cota.parte += 1n;
  });

  return cotas.map((cota) => Number(cota.parte * sinal) as T);
}
