import { Injectable } from '@nestjs/common';
import { estimarTokens, limparTexto, removerDadosPessoais } from '../domain/ia';
import {
  type PedidoAoProvedorDeIA,
  ProvedorDeIA,
  RepositorioDeUsoDeIA,
  type ResultadoGerado,
  type TipoDeCampoGerado,
} from './portas';

export interface PedidoDeGeracao {
  /** Quem pede, em chave estável do domínio (`treinos.sugerir-ficha`): vai para o registro de uso. */
  finalidade: string;
  instrucao: string;
  /** Contexto da geração. Dado pessoal é removido antes de sair, mesmo que o domínio o inclua. */
  dados?: Record<string, unknown>;
  /** Campos da resposta: `texto` (string) ou `lista` (lista de strings). */
  formato: Record<string, TipoDeCampoGerado>;
}

/**
 * Porta genérica de geração de texto estruturado (T13d), usada por Treinos (T25) e Marketing
 * (T31a). A plataforma garante, para qualquer provedor: nome, CPF, telefone e e-mail nunca saem
 * (chaves removidas e padrões trocados nos textos) e cada chamada fica registrada por tenant.
 */
@Injectable()
export class GeradorIA {
  constructor(
    private readonly provedor: ProvedorDeIA,
    private readonly uso: RepositorioDeUsoDeIA,
  ) {}

  async gerar(pedido: PedidoDeGeracao): Promise<ResultadoGerado> {
    const seguro: PedidoAoProvedorDeIA = {
      instrucao: limparTexto(pedido.instrucao),
      dados: (removerDadosPessoais(pedido.dados ?? {}) ?? {}) as Record<string, unknown>,
      formato: pedido.formato,
    };
    const resultado = await this.provedor.gerar(seguro);
    await this.uso.registrar({
      finalidade: pedido.finalidade,
      provedor: this.provedor.nome,
      tokensEntrada: estimarTokens(JSON.stringify(seguro)),
      tokensSaida: estimarTokens(JSON.stringify(resultado)),
    });
    return resultado;
  }
}
