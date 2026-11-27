import type { Schemas } from '@gymos/api-contracts';

export type FinanceiroGeral = Schemas['FinanceiroGeralDto'];
export type VisaoFinanceira = Schemas['VisaoFinanceiraDto'];
export type PeriodoApurado = Schemas['PeriodoApuradoDto'];
export type PontoDaSerie = Schemas['PontoDaSerieDto'];
export type Indicador = Schemas['IndicadorDto'];
export type ColunaDaTabela = Schemas['ColunaDaTabelaDto'];
export type LinhaDaTabela = Schemas['LinhaDaTabelaDto'];
export type OpcoesDosFiltros = Schemas['OpcoesDosFiltrosDto'];
export type Lancamento = Schemas['LancamentoDto'];
export type NovoLancamento = Schemas['NovoLancamentoDto'];
export type ChaveDePeriodo = PeriodoApurado['chave'];
export type ChaveDaVisao = VisaoFinanceira['visao'];

/** Filtros da visão geral e das visões (o que a tela manda à API). */
export interface FiltrosDoFinanceiro {
  periodo: ChaveDePeriodo;
  de: string;
  ate: string;
  unidadeId: string;
  planoId: string;
  modalidade: string;
  forma: string;
  tipo: 'todos' | 'receitas' | 'despesas';
  categoria: string;
  comparar: boolean;
}

export const FILTROS_PADRAO: FiltrosDoFinanceiro = {
  periodo: 'este-mes',
  de: '',
  ate: '',
  unidadeId: '',
  planoId: '',
  modalidade: '',
  forma: '',
  tipo: 'todos',
  categoria: '',
  comparar: true,
};

export type EstadoDaTela = 'carregando' | 'pronto' | 'erro';
