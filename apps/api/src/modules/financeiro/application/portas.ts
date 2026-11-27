import type { DataCivil } from '../../platform/domain/relogio';
import type { Presenca, Setor } from '../domain/financeiro';

// Portas do Financeiro (T21). Os adapters (infra) leem os dados de cobrança, alunos, acesso e equipe;
// o caso de uso só calcula.

export const TIPOS_DE_LANCAMENTO = ['despesa', 'receita'] as const;
export type TipoDeLancamento = (typeof TIPOS_DE_LANCAMENTO)[number];

export const CATEGORIAS_DE_LANCAMENTO = ['aluguel', 'contas', 'outros'] as const;
export type CategoriaDeLancamento = (typeof CATEGORIAS_DE_LANCAMENTO)[number];

export interface Lancamento {
  id: string;
  tipo: TipoDeLancamento;
  categoria: CategoriaDeLancamento;
  setor: Setor | null;
  valorCentavos: number;
  data: DataCivil;
  unidadeId: string;
  descricao: string | null;
  criadoEm: Date;
}

export type NovoLancamento = Omit<Lancamento, 'id' | 'criadoEm'> & { criadoPor: string | null };

/** Filtros da tela. Todos opcionais; vazio é "todos". */
export interface FiltroDoFinanceiro {
  unidadeId?: string;
  planoId?: string;
  modalidade?: string;
  forma?: string;
  /** `receitas` esconde as despesas; `despesas`, as receitas. */
  tipo?: 'todos' | 'receitas' | 'despesas';
  categoria?: CategoriaDeLancamento | 'folha';
}

/** Janela de instantes: início inclusivo e fim exclusivo (00:00 de São Paulo). */
export interface JanelaDeInstantes {
  inicio: Date;
  fim: Date;
}

/** Pagamentos do período agrupados; `brutoCentavos` já desconta o estornado. */
export interface TotalDePagamentos {
  alunoId: string | null;
  contratoId: string | null;
  origem: string;
  forma: string;
  brutoCentavos: number;
  taxasCentavos: number;
  quantidade: number;
}

export interface PlanoDoContrato {
  planoId: string;
  planoNome: string;
  modalidades: string[];
}

export type SituacaoDeVencimento = 'em_dia' | 'a_vencer' | 'em_atraso';

/** Contrato que dá acesso hoje (ativo ou em tolerância), com o que a cobrança sabe dele. */
export interface ContratoVigente {
  contratoId: string;
  alunoId: string;
  alunoNome: string;
  planoId: string;
  planoNome: string;
  vencimentoEmAtraso: DataCivil | null;
  proximoVencimento: DataCivil | null;
  /** Valor da parcela que espera pagamento (a mais antiga); nulo sem parcela a receber. */
  parcelaCentavos: number | null;
}

export interface AdesoesDoPeriodo {
  novas: number;
  cancelamentos: number;
}

export interface UnidadeDaAcademia {
  id: string;
  nome: string;
}

export interface PlanoParaFiltro {
  id: string;
  nome: string;
  modalidades: string[];
}

export abstract class RepositorioDeLancamentos {
  abstract criar(lancamento: NovoLancamento): Promise<Lancamento>;
  abstract doPeriodo(
    de: DataCivil,
    ate: DataCivil,
    filtro: Pick<FiltroDoFinanceiro, 'unidadeId' | 'categoria' | 'tipo'>,
  ): Promise<Lancamento[]>;
  abstract unidadePadrao(): Promise<string>;
  abstract unidadeExiste(id: string): Promise<boolean>;
}

/** Leitura agregada dos dados que outros domínios guardam (pagamentos, contratos, parcelas, planos). */
export abstract class LeituraFinanceira {
  abstract pagamentos(
    janela: JanelaDeInstantes,
    filtro: FiltroDoFinanceiro,
  ): Promise<TotalDePagamentos[]>;
  abstract planosDosContratos(
    contratoIds: readonly string[],
  ): Promise<Map<string, PlanoDoContrato>>;
  /** Contratos vigentes e alunos ativos hoje, filtrados por unidade e plano. */
  abstract contratosVigentes(filtro: FiltroDoFinanceiro): Promise<ContratoVigente[]>;
  abstract adesoes(
    de: DataCivil,
    ate: DataCivil,
    filtro: FiltroDoFinanceiro,
  ): Promise<AdesoesDoPeriodo>;
  /** Contratos ativos ao fim de cada dia pedido (série das adesões). */
  abstract adesoesAtivasEm(
    dias: readonly DataCivil[],
    filtro: FiltroDoFinanceiro,
  ): Promise<number[]>;
  /** Saldo das parcelas atrasadas (a receber em atraso). */
  abstract saldoEmAtraso(filtro: FiltroDoFinanceiro): Promise<number>;
  abstract unidades(): Promise<UnidadeDaAcademia[]>;
  abstract planos(): Promise<PlanoParaFiltro[]>;
}

export interface EquipeDoFinanceiro {
  itens: {
    funcionarioId: string;
    nome: string;
    cargo: string;
    cargoDescricao: string | null;
    custoMensalCentavos: number;
  }[];
  totalCentavos: number;
}

/** Custo mensal da equipe (T26a), a folha do Financeiro. */
export abstract class EquipeParaOFinanceiro {
  abstract equipe(): Promise<EquipeDoFinanceiro>;
}

export interface PresencasDoMesParaORateio {
  /** Dias com check-in no mês, por aluno (cada um conta como presença de musculação). */
  checkins: Map<string, number>;
  /** Presenças em aula por aluno: setor, aula e professor. Vazio até o módulo Aulas (T28). */
  emAulas: Map<string, Presenca[]>;
}

/** Presenças do mês: check-ins vêm do Acesso (T23a); aulas, do módulo Aulas (T28). */
export abstract class PresencasParaORateio {
  abstract doMes(mes: string): Promise<PresencasDoMesParaORateio>;
}

/** Ocupação das aulas no período (T28). Sem o módulo Aulas, nenhuma aula. */
export interface OcupacaoDeAula {
  aulaId: string;
  nome: string;
  tipo: 'coletiva' | 'luta';
  /** Pontos-base das vagas ocupadas; nulo sem dado. */
  ocupacaoPontosBase: number | null;
}

export abstract class OcupacaoDasAulas {
  abstract doPeriodo(de: DataCivil, ate: DataCivil): Promise<OcupacaoDeAula[]>;
}
