import type { ChaveDePeriodo } from '../domain/financeiro';

// Formato das respostas do Financeiro: números em centavos, pontos-base e contagens, e o texto de apoio
// já em português. O front só formata e desenha (sem regra de negócio no componente).

export interface PeriodoApurado {
  chave: ChaveDePeriodo;
  de: string;
  ate: string;
  /** `Novembro 2026` (mês civil) ou `19/11/2026 a 25/11/2026`. */
  rotulo: string;
  anterior: { de: string; ate: string; rotulo: string };
}

export interface PontoDaSerie {
  /** `2026-11`. */
  mes: string;
  rotulo: string;
  brutaCentavos: number;
  taxasCentavos: number;
  despesasCentavos: number;
  liquidaCentavos: number;
  adesoesAtivas: number;
  novasAdesoes: number;
}

export interface FinanceiroGeral {
  periodo: PeriodoApurado;
  receitaLiquida: {
    centavos: number;
    /** Receita líquida do período anterior; nula sem comparação. */
    anteriorCentavos: number | null;
    /** Variação em pontos-base sobre o anterior; nula sem base. */
    variacaoPontosBase: number | null;
  };
  brutaCentavos: number;
  taxasCentavos: number;
  despesasCentavos: number;
  adesoesAtivas: number;
  novasAdesoes: number;
  cancelamentos: number;
  inadimplencia: { emAtraso: number; ativos: number; pontosBase: number };
  porForma: { forma: string; centavos: number; percentual: number }[];
  despesasPorCategoria: { categoria: string; rotulo: string; centavos: number }[];
  /** Últimos 6 meses até o mês do fim do período, em ordem. */
  serieMensal: PontoDaSerie[];
}

export type FormatoDoIndicador = 'brl' | 'inteiro' | 'percentual' | 'texto';

export interface Indicador {
  rotulo: string;
  formato: FormatoDoIndicador;
  /** Centavos, contagem ou pontos-base, conforme o formato; 0 em `texto`. */
  valor: number;
  /** Valor em texto quando o formato é `texto` (ex.: o nome do maior setor). */
  texto: string | null;
  legenda: string;
  /** Realça o valor em verde (maior crescimento). */
  positivo: boolean;
}

export type TipoDeColuna = 'texto' | 'brl' | 'inteiro' | 'percentual' | 'situacao';

export interface ColunaDaTabela {
  chave: string;
  rotulo: string;
  tipo: TipoDeColuna;
  /** Texto quando a célula é nula (ex.: "sem dado"). */
  vazio: string | null;
}

export interface LinhaDaTabela {
  id: string;
  celulas: Record<string, string | number | null>;
  /** Tom da situação (coluna `situacao`). */
  situacao: 'em_dia' | 'em_atraso' | 'a_vencer' | null;
  /** Caminho do botão "Ver" da linha. */
  link: string | null;
}

export interface BarraDoGrafico {
  rotulo: string;
  valorCentavos: number;
}

export type ChaveDaVisao =
  'setores' | 'funcionarios' | 'alunos' | 'aulas' | 'planos' | 'formas-de-pagamento';

export interface VisaoFinanceira {
  visao: ChaveDaVisao;
  periodo: PeriodoApurado;
  indicadores: Indicador[];
  grafico: { titulo: string; subtitulo: string; barras: BarraDoGrafico[] };
  tabela: {
    titulo: string;
    subtitulo: string;
    colunas: ColunaDaTabela[];
    linhas: LinhaDaTabela[];
    total: number;
    proximoCursor: string | null;
  };
}

export interface OpcoesDosFiltros {
  unidades: { id: string; nome: string }[];
  planos: { id: string; nome: string }[];
  modalidades: string[];
  formas: { chave: string; rotulo: string }[];
  categorias: { chave: string; rotulo: string }[];
}
