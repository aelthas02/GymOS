import { Injectable } from '@nestjs/common';
import type { DadosDoFuncionario, FiltroDeCargo } from '../domain/funcionario';

export interface Funcionario extends DadosDoFuncionario {
  id: string;
  /** Login do painel (T12). Guardado também com o acesso desligado, para religar o mesmo usuário. */
  usuarioId: string | null;
  ativo: boolean;
}

export type ContadoresDaEquipe = Record<'todos' | FiltroDeCargo, number>;

export interface FiltroDeFuncionarios {
  cargo?: FiltroDeCargo;
  /** Parte do nome (sem diferenciar maiúsculas). */
  busca?: string;
  /** 1 é a primeira página. */
  pagina: number;
  limite: number;
}

export interface PaginaDeFuncionarios {
  itens: Funcionario[];
  /** Quantos funcionários passam pelo filtro (todas as páginas). */
  total: number;
  /** Chips da tela: respeitam a busca, mas não o filtro de cargo. */
  contadores: ContadoresDaEquipe;
}

/** Persistência dos funcionários, sempre no cliente transacional do tenant (RLS). */
export abstract class RepositorioDeFuncionarios {
  abstract listar(filtro: FiltroDeFuncionarios): Promise<PaginaDeFuncionarios>;
  abstract porId(id: string): Promise<Funcionario | null>;
  abstract porEmail(email: string): Promise<Funcionario | null>;
  abstract criar(dados: DadosDoFuncionario & { usuarioId: string | null }): Promise<Funcionario>;
  abstract atualizar(
    id: string,
    dados: Partial<DadosDoFuncionario> & { usuarioId?: string | null; ativo?: boolean },
  ): Promise<Funcionario>;
  abstract excluir(id: string): Promise<void>;
  /** Ativos, do nome A a Z, com um dos cargos (todos, se vazio). */
  abstract ativosPorCargo(cargos: readonly string[]): Promise<Funcionario[]>;
}

/**
 * Um domínio que referencia funcionários (aulas do T28, saúde do T30...) registra aqui como descobrir
 * os vínculos de um funcionário. Quem tem vínculo não pode ser excluído, só inativado.
 */
export interface FonteDeVinculos {
  /** Nome estável do domínio, na mensagem de recusa. */
  readonly nome: string;
  /** Texto do vínculo ("professor de 3 alunos"), ou nulo quando não há. */
  descrever(funcionarioId: string): Promise<string | null>;
}

@Injectable()
export class RegistroDeVinculos {
  private readonly fontes = new Map<string, FonteDeVinculos>();

  registrar(fonte: FonteDeVinculos): void {
    if (this.fontes.has(fonte.nome)) {
      throw new Error(`Fonte de vínculos de funcionário ${fonte.nome} registrada duas vezes.`);
    }
    this.fontes.set(fonte.nome, fonte);
  }

  async descrever(funcionarioId: string): Promise<string[]> {
    const vinculos: string[] = [];
    for (const fonte of this.fontes.values()) {
      const texto = await fonte.descrever(funcionarioId);
      if (texto !== null) {
        vinculos.push(texto);
      }
    }
    return vinculos;
  }
}
