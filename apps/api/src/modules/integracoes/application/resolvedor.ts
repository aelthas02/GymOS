import { Injectable } from '@nestjs/common';
import {
  type ContextoDeMensagem,
  type VariavelDeMensagem,
  validarModelo,
} from '@gymos/shared-templates';
import type { ProvedorDeVariavel } from './portas';

/** Donos dos dados de cada variável: cada domínio registra os seus no `onModuleInit`. */
@Injectable()
export class RegistroDeVariaveis {
  private readonly provedores = new Map<VariavelDeMensagem, ProvedorDeVariavel>();

  registrar(provedor: ProvedorDeVariavel): void {
    this.provedores.set(provedor.variavel, provedor);
  }

  provedor(variavel: VariavelDeMensagem): ProvedorDeVariavel | undefined {
    return this.provedores.get(variavel);
  }
}

export class ModeloInvalidoError extends Error {
  constructor(readonly erros: readonly string[]) {
    super(erros.join(' '));
    this.name = 'ModeloInvalidoError';
  }
}

/**
 * Troca as `{variáveis}` de um modelo (parser do T08) pelos dados do aluno. Os valores que quem
 * envia já tem têm prioridade; o resto vem dos provedores registrados pelos donos. Variável sem
 * dado vira texto vazio: a mensagem sai, só sem o trecho.
 */
@Injectable()
export class ResolvedorDeVariaveis {
  constructor(private readonly registro: RegistroDeVariaveis) {}

  async resolver(
    modelo: string,
    contexto: ContextoDeMensagem,
    alunoId: string,
    conhecidas: Partial<Record<VariavelDeMensagem, string>> = {},
  ): Promise<string> {
    const validacao = validarModelo(modelo, contexto);
    if (!validacao.valido) {
      throw new ModeloInvalidoError(validacao.erros.map((erro) => erro.mensagem));
    }
    const valores = new Map<VariavelDeMensagem, string>();
    for (const variavel of validacao.variaveis) {
      const conhecida = conhecidas[variavel];
      valores.set(
        variavel,
        conhecida ?? (await this.registro.provedor(variavel)?.valor(alunoId)) ?? '',
      );
    }
    return validacao.partes
      .map((parte) =>
        parte.tipo === 'texto'
          ? parte.texto
          : (valores.get(parte.nome as VariavelDeMensagem) ?? ''),
      )
      .join('');
  }
}
