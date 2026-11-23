declare const marcaCentavos: unique symbol;
declare const marcaPontosBase: unique symbol;

/** Dinheiro em centavos inteiros (R$ 119,00 = 11900). Crie com `centavos()`. */
export type Centavos = number & { readonly [marcaCentavos]: true };

/** Percentual ou alíquota em pontos-base inteiros (2,5% = 250; 100% = 10000). */
export type PontosBase = number & { readonly [marcaPontosBase]: true };

function inteiroSeguro(valor: number, nome: string): number {
  if (!Number.isSafeInteger(valor)) {
    throw new RangeError(`${nome} precisam ser um inteiro seguro: ${valor}`);
  }
  // Normaliza -0, que Object.is distingue de 0.
  return valor + 0;
}

export function centavos(valor: number): Centavos {
  return inteiroSeguro(valor, 'Centavos') as Centavos;
}

export function pontosBase(valor: number): PontosBase {
  return inteiroSeguro(valor, 'Pontos-base') as PontosBase;
}

/** Converte de volta de BigInt, recusando o que não cabe num inteiro seguro. */
export function centavosDeBigInt(valor: bigint): Centavos {
  return centavos(Number(valor));
}

export function somar(valores: readonly Centavos[]): Centavos {
  return centavosDeBigInt(valores.reduce((soma, valor) => soma + BigInt(valor), 0n));
}
