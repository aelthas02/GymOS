import { type ModuloDeSeed, ORDEM_DOS_DOMINIOS } from './modulo-de-seed';

/**
 * Ordena os módulos por dependência (os que dependem de outros vêm depois). Desempata pela
 * `ORDEM_DOS_DOMINIOS` e, fora dela, pela ordem de registro. Falha com mensagem clara se um nome se
 * repete, se uma dependência não está registrada ou se há ciclo.
 */
export function ordenarModulosDeSeed(modulos: readonly ModuloDeSeed[]): ModuloDeSeed[] {
  const porNome = new Map<string, ModuloDeSeed>();
  for (const modulo of modulos) {
    if (porNome.has(modulo.nome)) {
      throw new Error(`Módulo de seed "${modulo.nome}" registrado mais de uma vez.`);
    }
    porNome.set(modulo.nome, modulo);
  }
  for (const modulo of modulos) {
    for (const dependencia of modulo.dependeDe) {
      if (!porNome.has(dependencia)) {
        throw new Error(
          `O módulo de seed "${modulo.nome}" depende de "${dependencia}", que não está registrado ` +
            '(registre-o em apps/api/src/seed/modulos.ts).',
        );
      }
    }
  }

  const prioridade = (nome: string): number => {
    const indice = (ORDEM_DOS_DOMINIOS as readonly string[]).indexOf(nome);
    return indice === -1 ? ORDEM_DOS_DOMINIOS.length : indice;
  };
  const registro = new Map(modulos.map((modulo, indice) => [modulo.nome, indice]));
  const ordenados: ModuloDeSeed[] = [];
  const feitos = new Set<string>();
  let pendentes = [...modulos];
  while (pendentes.length > 0) {
    const prontos = pendentes
      .filter((modulo) => modulo.dependeDe.every((dependencia) => feitos.has(dependencia)))
      .sort(
        (a, b) =>
          prioridade(a.nome) - prioridade(b.nome) ||
          (registro.get(a.nome) ?? 0) - (registro.get(b.nome) ?? 0),
      );
    const proximo = prontos[0];
    if (!proximo) {
      const nomes = pendentes.map((modulo) => modulo.nome).join(', ');
      throw new Error(`Dependência circular entre módulos de seed: ${nomes}.`);
    }
    ordenados.push(proximo);
    feitos.add(proximo.nome);
    pendentes = pendentes.filter((modulo) => modulo !== proximo);
  }
  return ordenados;
}
