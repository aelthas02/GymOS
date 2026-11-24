// Acessos offline (T23a/T24a): o agente da catraca guarda o que aconteceu sem internet e envia depois,
// possivelmente fora de ordem e com repetições (reenvio após falha). Esta função devolve cada acesso
// uma vez, na ordem em que aconteceu na origem.

export interface AcessoDeOrigem {
  /** Id gerado na origem (UUID); é a chave da deduplicação. */
  idDeOrigem: string;
  registradoEm: Date;
}

/**
 * Remove repetidos (vale o primeiro recebido de cada `idDeOrigem`) e ordena por horário de origem; o
 * desempate pelo id mantém a ordem estável e igual em qualquer reenvio.
 */
export function consolidarAcessosOffline<T extends AcessoDeOrigem>(registros: readonly T[]): T[] {
  const vistos = new Map<string, T>();
  for (const registro of registros) {
    if (!vistos.has(registro.idDeOrigem)) {
      vistos.set(registro.idDeOrigem, registro);
    }
  }
  return [...vistos.values()].sort(
    (a, b) =>
      a.registradoEm.getTime() - b.registradoEm.getTime() ||
      (a.idDeOrigem < b.idDeOrigem ? -1 : a.idDeOrigem > b.idDeOrigem ? 1 : 0),
  );
}
