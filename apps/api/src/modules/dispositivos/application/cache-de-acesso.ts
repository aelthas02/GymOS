import { Injectable } from '@nestjs/common';
import {
  type ConfiguracaoDeAcesso,
  type MotivoDeNegacao,
  type ResultadoDeAcesso,
  type SituacaoDoContratoParaAcesso,
  avaliarAcesso,
  regraDeAtraso,
  regraDoContrato,
} from '@gymos/shared-acesso';
import { ConfiguracoesDoAcesso } from '../../acesso/application/configuracoes';
import { AlunosParaAcesso } from '../../acesso/application/portas';
import { Relogio } from '../../platform/domain/relogio';
import { RepositorioDoCacheDeAcesso } from './portas';

export const LIMITE_PADRAO_DA_SINCRONIZACAO = 200;
export const LIMITE_MAXIMO_DA_SINCRONIZACAO = 500;

export interface AlunoAutorizado {
  alunoId: string;
  /** `true` quando o aluno deixou de existir (exclusão do titular): o agente o apaga do cache. */
  removido: boolean;
  nome: string | null;
  contrato: SituacaoDoContratoParaAcesso;
  diasDeAtraso: number;
  planoNome: string | null;
  modalidadesDoPlano: readonly string[];
  acessosPorSemana: number | null;
  /** Decisão pelas regras de contrato e atraso (as que dependem do instante o agente aplica). */
  situacao: { resultado: ResultadoDeAcesso; motivo: MotivoDeNegacao | null };
}

export interface PaginaDoCache {
  /** O agente guarda esta versão e a envia como `desde` na próxima chamada. */
  versao: number;
  maisPaginas: boolean;
  regras: ConfiguracaoDeAcesso;
  alunos: AlunoAutorizado[];
}

/**
 * Cache de autorização do agente (T23b): os alunos que podem passar e as regras, com versão. Cada
 * mudança relevante (contrato, pagamento, regra) dá uma versão nova ao aluno afetado; o agente pede
 * só o que passou da versão que já tem. Sem `desde`, é a carga completa.
 */
@Injectable()
export class CacheDeAutorizacao {
  constructor(
    private readonly repositorio: RepositorioDoCacheDeAcesso,
    private readonly alunos: AlunosParaAcesso,
    private readonly regras: ConfiguracoesDoAcesso,
    private readonly relogio: Relogio,
  ) {}

  alunoMudou(alunoId: string): Promise<void> {
    return this.repositorio.alterar(alunoId, this.relogio.agora());
  }

  regrasMudaram(): Promise<void> {
    return this.repositorio.alterar(null, this.relogio.agora());
  }

  versaoAtual(): Promise<number> {
    return this.repositorio.versaoAtual();
  }

  async obter(desde: number | undefined, limite: number): Promise<PaginaDoCache> {
    const agora = this.relogio.agora();
    const base = desde ?? 0;
    if (base === 0) {
      await this.repositorio.semear(await this.alunos.todosOsIds(), agora);
    }
    const regras = await this.regras.obter();
    const mudancas = await this.repositorio.desde(base, limite + 1);
    const pagina = mudancas.slice(0, limite);
    const alunos: AlunoAutorizado[] = [];
    for (const mudanca of pagina) {
      if (mudanca.alunoId !== null) {
        alunos.push(await this.montar(mudanca.alunoId, regras, agora));
      }
    }
    return {
      versao: pagina.at(-1)?.versao ?? Math.max(base, await this.repositorio.versaoAtual()),
      maisPaginas: mudancas.length > limite,
      regras,
      alunos,
    };
  }

  private async montar(
    alunoId: string,
    regras: ConfiguracaoDeAcesso,
    agora: Date,
  ): Promise<AlunoAutorizado> {
    const contexto = await this.alunos.contexto(alunoId);
    if (!contexto) {
      return {
        alunoId,
        removido: true,
        nome: null,
        contrato: null,
        diasDeAtraso: 0,
        planoNome: null,
        modalidadesDoPlano: [],
        acessosPorSemana: null,
        situacao: { resultado: 'negado', motivo: 'aluno_nao_encontrado' },
      };
    }
    const decisao = avaliarAcesso(
      {
        direcao: 'entrada',
        instante: agora,
        modalidade: null,
        contrato: contexto.contrato,
        diasDeAtraso: contexto.diasDeAtraso,
        modalidadesDoPlano: contexto.modalidadesDoPlano,
        acessosPorSemana: contexto.acessosPorSemana,
        passagens: [],
        configuracao: regras,
      },
      [regraDoContrato, regraDeAtraso],
    );
    return {
      alunoId,
      removido: false,
      nome: contexto.nome,
      contrato: contexto.contrato,
      diasDeAtraso: contexto.diasDeAtraso,
      planoNome: contexto.planoNome,
      modalidadesDoPlano: contexto.modalidadesDoPlano,
      acessosPorSemana: contexto.acessosPorSemana,
      situacao: {
        resultado: decisao.resultado,
        motivo: decisao.resultado === 'negado' ? decisao.motivo : null,
      },
    };
  }
}
