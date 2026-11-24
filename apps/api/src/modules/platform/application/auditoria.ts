import { Injectable } from '@nestjs/common';
import {
  type AtividadeResolvida,
  codificarCursor,
  decodificarCursor,
  ETIQUETA_SENSIVEL,
  limiteDaRetencao,
  type NovaAtividade,
  type PosicaoNaLista,
  resolverAtividade,
  textoDaAcao,
  textoDoModulo,
} from '../domain/atividade';
import { cabecalhoDoCsv, linhaDoCsv } from '../domain/atividade-csv';
import { Relogio } from '../domain/relogio';

/**
 * `todos`: do mais recente ao mais antigo; `destaque` ("Todos, com sensíveis em destaque"): os
 * sensíveis primeiro, cada grupo do mais recente ao mais antigo; `sensiveis`: só os sensíveis.
 */
export const TIPOS_DE_LISTAGEM = ['todos', 'destaque', 'sensiveis'] as const;
export type TipoDeListagem = (typeof TIPOS_DE_LISTAGEM)[number];

export interface FiltroDeAtividades {
  usuarioId?: string;
  modulo?: string;
  /** Início do período, inclusive. */
  de?: Date;
  /** Fim do período, exclusivo. */
  ate?: Date;
  tipo?: TipoDeListagem;
}

export interface AtividadeGuardada extends AtividadeResolvida {
  id: string;
  ocorridoEm: Date;
  ordem: bigint;
}

export interface AutorEncontrado {
  nome: string;
  papel: string;
}

/** Persistência do log. Sempre no cliente transacional do contexto: mesma transação do caso de uso. */
export abstract class RepositorioDeAtividades {
  abstract inserir(atividade: AtividadeResolvida & { ocorridoEm: Date }): Promise<void>;
  /** Até `limite` registros depois da posição, na ordem do filtro. */
  abstract listar(
    filtro: FiltroDeAtividades,
    depoisDe: PosicaoNaLista | null,
    limite: number,
  ): Promise<AtividadeGuardada[]>;
  /** Apaga os registros com `ocorridoEm` anterior ao limite e devolve quantos eram. */
  abstract removerAnterioresA(limite: Date): Promise<number>;
  abstract autorDoUsuario(usuarioId: string): Promise<AutorEncontrado | null>;
}

export interface ItemDoLog {
  id: string;
  quando: Date;
  quem: string;
  quemId: string | null;
  papel: string;
  acao: string;
  acaoTexto: string;
  modulo: string;
  moduloTexto: string;
  detalhe: string;
  sensivel: boolean;
  etiqueta: string | null;
}

export interface PaginaDoLog {
  itens: ItemDoLog[];
  proximoCursor: string | null;
}

export const LIMITE_PADRAO = 50;
export const LIMITE_MAXIMO = 100;
/** A exportação para em 50 mil linhas: o período é filtrável e o Excel não passa muito disso. */
export const LINHAS_MAXIMAS_NO_CSV = 50_000;
const TAMANHO_DA_PAGINA_NO_CSV = 1_000;

/**
 * Auditoria (T13b): `registrarAtividade` grava na transação do caso de uso (rollback some junto);
 * a consulta, a exportação e a retenção rodam no tenant do contexto.
 */
@Injectable()
export class Auditoria {
  constructor(
    private readonly repositorio: RepositorioDeAtividades,
    private readonly relogio: Relogio,
  ) {}

  async registrarAtividade(nova: NovaAtividade): Promise<void> {
    await this.repositorio.inserir({
      ...resolverAtividade(nova),
      ocorridoEm: this.relogio.agora(),
    });
  }

  /** Nome e tipo de acesso atuais de um usuário da equipe, para o caso de uso informar quem agiu. */
  autorDoUsuario(usuarioId: string): Promise<AutorEncontrado | null> {
    return this.repositorio.autorDoUsuario(usuarioId);
  }

  async consultar(
    filtro: FiltroDeAtividades,
    paginacao: { limite?: number; cursor?: string } = {},
  ): Promise<PaginaDoLog> {
    const limite = Math.min(Math.max(paginacao.limite ?? LIMITE_PADRAO, 1), LIMITE_MAXIMO);
    const depoisDe = paginacao.cursor ? decodificarCursor(paginacao.cursor) : null;
    const guardadas = await this.repositorio.listar(filtro, depoisDe, limite + 1);
    const pagina = guardadas.slice(0, limite);
    const ultima = pagina.at(-1);
    return {
      itens: pagina.map(paraItem),
      proximoCursor: guardadas.length > limite && ultima ? codificarCursor(ultima) : null,
    };
  }

  /** CSV com os mesmos filtros e a ordem da listagem; até `LINHAS_MAXIMAS_NO_CSV` linhas. */
  async exportarCsv(filtro: FiltroDeAtividades): Promise<string> {
    const linhas = [cabecalhoDoCsv()];
    let posicao: PosicaoNaLista | null = null;
    while (linhas.length - 1 < LINHAS_MAXIMAS_NO_CSV) {
      const guardadas = await this.repositorio.listar(filtro, posicao, TAMANHO_DA_PAGINA_NO_CSV);
      linhas.push(...guardadas.map((g) => linhaDoCsv({ ...g, quem: g.quem.nome })));
      const ultima = guardadas.at(-1);
      if (!ultima || guardadas.length < TAMANHO_DA_PAGINA_NO_CSV) {
        break;
      }
      posicao = ultima;
    }
    return linhas.join('\r\n');
  }

  /** Retenção de 12 meses: remove o que passou do limite, no tenant do contexto. */
  removerExpiradas(): Promise<number> {
    return this.repositorio.removerAnterioresA(limiteDaRetencao(this.relogio.agora()));
  }
}

function paraItem(guardada: AtividadeGuardada): ItemDoLog {
  return {
    id: guardada.id,
    quando: guardada.ocorridoEm,
    quem: guardada.quem.nome,
    quemId: guardada.quem.id,
    papel: guardada.papel,
    acao: guardada.acao,
    acaoTexto: textoDaAcao(guardada.acao),
    modulo: guardada.modulo,
    moduloTexto: textoDoModulo(guardada.modulo),
    detalhe: guardada.detalhe,
    sensivel: guardada.sensivel,
    etiqueta: guardada.sensivel ? ETIQUETA_SENSIVEL : null,
  };
}
