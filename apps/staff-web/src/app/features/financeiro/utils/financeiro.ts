import { centavos, formatarBrl, pontosBase } from '@gymos/shared-money';
import { formatarPercentual } from '@gymos/shared-money';
import type { ConfiguracaoDeTutorial, TabItem } from '@gymos/ui';
import type {
  ChaveDePeriodo,
  ColunaDaTabela,
  FiltrosDoFinanceiro,
  Indicador,
  LinhaDaTabela,
} from '../models/financeiro';

/** "Visualizar por" do Financeiro. */
export const VISOES_DO_FINANCEIRO: readonly TabItem[] = [
  { label: 'Geral', link: '/financeiro' },
  { label: 'Setores', link: '/financeiro/setores' },
  { label: 'Funcionários', link: '/financeiro/funcionarios' },
  { label: 'Alunos', link: '/financeiro/alunos' },
  { label: 'Aulas', link: '/financeiro/aulas' },
  { label: 'Planos', link: '/financeiro/planos' },
  { label: 'Forma de pagamento', link: '/financeiro/formas-de-pagamento' },
  { label: 'Notas fiscais', link: '/financeiro/notas-fiscais' },
];

export const PERIODOS_DO_FINANCEIRO: readonly { chave: ChaveDePeriodo; rotulo: string }[] = [
  { chave: 'hoje', rotulo: 'Hoje' },
  { chave: '7-dias', rotulo: '7 dias' },
  { chave: 'este-mes', rotulo: 'Este mês' },
  { chave: 'trimestre', rotulo: 'Trimestre' },
  { chave: 'ano', rotulo: 'Ano' },
  { chave: 'personalizado', rotulo: 'Personalizado' },
];

/** Reais inteiros, como nos KPIs das telas: "R$ 54.900". */
export function reaisInteiros(valorCentavos: number): string {
  return formatarBrl(centavos(Math.round(valorCentavos / 100) * 100)).replace(/,00$/, '');
}

/** Valor de um gráfico em reais inteiros, sem o símbolo da moeda ("2400"), como as barras das telas. */
export const numeroDeReais = (valorCentavos: number): number => Math.round(valorCentavos / 100);

export const percentual = (valorPontosBase: number, casas: 0 | 1 | 2 = 1): string =>
  formatarPercentual(pontosBase(valorPontosBase), casas);

/** Texto do valor de um indicador conforme o formato. */
export function valorDoIndicador(indicador: Indicador): string {
  switch (indicador.formato) {
    case 'brl':
      return reaisInteiros(indicador.valor);
    case 'percentual':
      return `${indicador.valor}%`;
    case 'texto':
      return indicador.texto ?? '—';
    default:
      return String(indicador.valor);
  }
}

/** Texto de uma célula da tabela conforme o tipo da coluna. */
export function textoDaCelula(coluna: ColunaDaTabela, linha: LinhaDaTabela): string {
  const valor = linha.celulas[coluna.chave];
  if (valor === null || valor === undefined) {
    return coluna.vazio ?? '—';
  }
  switch (coluna.tipo) {
    case 'brl':
      return reaisInteirosOuCentavos(Number(valor));
    case 'percentual':
      return `${valor}%`;
    default:
      return String(valor);
  }
}

/** Valores de R$ 1.000 para cima aparecem sem centavos; abaixo disso, com (R$ 105,33). */
function reaisInteirosOuCentavos(valorCentavos: number): string {
  return valorCentavos % 100 === 0
    ? reaisInteiros(valorCentavos)
    : formatarBrl(centavos(valorCentavos));
}

/** Parâmetros de consulta da API a partir dos filtros (vazio não é enviado). */
export function consultaDosFiltros(filtros: FiltrosDoFinanceiro): Record<string, string | boolean> {
  const consulta: Record<string, string | boolean> = { periodo: filtros.periodo };
  if (filtros.periodo === 'personalizado') {
    consulta['de'] = filtros.de;
    consulta['ate'] = filtros.ate;
  }
  for (const campo of ['unidadeId', 'planoId', 'modalidade', 'forma', 'categoria'] as const) {
    if (filtros[campo]) {
      consulta[campo] = filtros[campo];
    }
  }
  if (filtros.tipo !== 'todos') {
    consulta['tipo'] = filtros.tipo;
  }
  consulta['comparar'] = filtros.comparar;
  return consulta;
}

/** Texto do aviso "Receita líquida" da visão geral: "4,8% acima de outubro (R$ 46.100)". */
export function comparacaoDaReceita(
  variacaoPontosBase: number | null,
  anteriorCentavos: number | null,
  rotuloAnterior: string,
): string | null {
  if (variacaoPontosBase === null || anteriorCentavos === null) {
    return null;
  }
  const mes = rotuloAnterior.split(' ')[0]?.toLowerCase() ?? rotuloAnterior;
  const direcao = variacaoPontosBase >= 0 ? 'acima' : 'abaixo';
  return `${percentual(Math.abs(variacaoPontosBase))} ${direcao} de ${mes} (${reaisInteiros(anteriorCentavos)})`;
}

/** `TutFinanceiro.html`: cinco blocos da visão geral. */
export const TUTORIAL_FINANCEIRO: ConfiguracaoDeTutorial = {
  passos: [
    {
      alvo: 'receita-liquida',
      numero: 1,
      texto: 'Receita líquida do período, já sem taxas e despesas',
    },
    { alvo: 'filtros', numero: 2, texto: 'Filtre período, unidade, plano e pagamento' },
    { alvo: 'abas', numero: 3, texto: 'Veja os mesmos números por outro ângulo' },
    { alvo: 'indicadores', numero: 4, texto: 'Indicadores com a evolução de cada um' },
    { alvo: 'graficos', numero: 5, texto: 'Gráficos por forma de pagamento e categoria' },
  ],
};

// --- exportação ------------------------------------------------------------------------------

export interface TabelaParaExportar {
  nome: string;
  cabecalho: readonly string[];
  linhas: readonly (readonly (string | number)[])[];
}

const escaparCsv = (valor: string | number): string => {
  const texto = String(valor);
  return /[";\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
};

/** CSV do Brasil: `;` como separador e UTF-8 com BOM, para abrir certo no Excel. */
export function paraCsv(tabela: TabelaParaExportar): Blob {
  const linhas = [tabela.cabecalho, ...tabela.linhas].map((linha) =>
    linha.map(escaparCsv).join(';'),
  );
  return new Blob(['﻿', linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
}

/** XLSX pela mesma biblioteca da importação de alunos (carregada só ao exportar). */
export async function paraXlsx(tabela: TabelaParaExportar): Promise<Blob> {
  const { default: escrever } = await import('write-excel-file/browser');
  const dados = [
    tabela.cabecalho.map((valor) => ({ value: valor, fontWeight: 'bold' as const })),
    ...tabela.linhas.map((linha) => linha.map((valor) => ({ value: valor }))),
  ];
  return escrever(dados, { columns: tabela.cabecalho.map(() => ({ width: 22 })) }).toBlob();
}

/** Linhas da exportação: a tabela da visão com os valores brutos (reais com centavos, sem R$). */
export function tabelaDaVisao(
  nome: string,
  colunas: readonly ColunaDaTabela[],
  linhas: readonly LinhaDaTabela[],
): TabelaParaExportar {
  return {
    nome,
    cabecalho: colunas.map((coluna) => coluna.rotulo),
    linhas: linhas.map((linha) =>
      colunas.map((coluna) => {
        const valor = linha.celulas[coluna.chave];
        if (valor === null || valor === undefined) {
          return coluna.vazio ?? '';
        }
        return coluna.tipo === 'brl' ? Number(valor) / 100 : valor;
      }),
    ),
  };
}

export function baixarArquivo(conteudo: Blob, nome: string, documento: Document): void {
  const url = URL.createObjectURL(conteudo);
  const link = documento.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}
