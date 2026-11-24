import { cssVar } from '../../../styles/tokens';

/** Ponto de um gráfico de uma série: o rótulo do eixo e o valor numérico. */
export interface PontoGrafico {
  rotulo: string;
  valor: number;
}

/** Formata um valor para exibir; as telas injetam aqui os pipes de moeda e número (T08). */
export type FormatarValor = (valor: number) => string;

const numeroBR = new Intl.NumberFormat('pt-BR');

/** Valor que não é número (dado faltando) aparece como traço, não como "NaN". */
export const formatarSeguro =
  (formatar: FormatarValor): FormatarValor =>
  (valor) =>
    Number.isFinite(valor) ? formatar(valor) : '—';

/** Formato de reserva quando a tela não passa `formatar`: número no padrão brasileiro. */
export const formatarPadrao: FormatarValor = (valor) => numeroBR.format(valor);

const seguro = (valor: number): number => (Number.isFinite(valor) && valor > 0 ? valor : 0);

/** Alturas proporcionais ao maior valor; negativo e inválido valem 0. */
export function alturas(valores: readonly number[], alturaMax: number): number[] {
  const maior = Math.max(0, ...valores.map(seguro));
  return valores.map((valor) => (maior === 0 ? 0 : (seguro(valor) / maior) * alturaMax));
}

/** Índice do maior valor (o primeiro, no empate); -1 quando nenhum valor é positivo. */
export function indiceDestaque(valores: readonly number[]): number {
  let indice = -1;
  let maior = 0;
  valores.forEach((valor, i) => {
    if (seguro(valor) > maior) {
      maior = valor;
      indice = i;
    }
  });
  return indice;
}

export interface FatiaDonut {
  valor: number;
  /** Parte do total, de 0 a 1. */
  fracao: number;
  /** Abertura da fatia em graus. */
  angulo: number;
  /** Onde a fatia começa, em graus a partir do topo. */
  inicio: number;
}

/** Fatias de um donut; as aberturas somam 360° (0° para valor zero ou total zero). */
export function fatiasDonut(valores: readonly number[]): FatiaDonut[] {
  const total = valores.reduce((soma, valor) => soma + seguro(valor), 0);
  let inicio = 0;
  return valores.map((valor) => {
    const fracao = total === 0 ? 0 : seguro(valor) / total;
    const angulo = fracao * 360;
    const fatia = { valor, fracao, angulo, inicio };
    inicio += angulo;
    return fatia;
  });
}

/** De quantos em quantos pontos mostrar o rótulo do eixo para ele caber na largura. */
export function passoDeRotulos(quantidade: number, maximo = 12): number {
  return Math.max(1, Math.ceil(quantidade / maximo));
}

export interface OpcoesDaLinha {
  largura: number;
  altura: number;
  /** Folga em volta da área de desenho. */
  margem?: number;
  /** A escala começa em zero (padrão); com `false` vai do mínimo ao máximo da série. */
  baseZero?: boolean;
}

/** Coordenadas de uma série, com o maior valor no topo. Um ponto só fica no centro. */
export function pontosDaLinha(
  valores: readonly number[],
  { largura, altura, margem = 0, baseZero = true }: OpcoesDaLinha,
): { x: number; y: number }[] {
  const limpos = valores.map((valor) => (Number.isFinite(valor) ? valor : 0));
  const maximo = Math.max(...limpos);
  const minimo = baseZero ? Math.min(0, ...limpos) : Math.min(...limpos);
  const faixa = maximo - minimo;
  const util = altura - 2 * margem;
  const passo = limpos.length > 1 ? (largura - 2 * margem) / (limpos.length - 1) : 0;

  return limpos.map((valor, i) => ({
    x: limpos.length > 1 ? margem + i * passo : largura / 2,
    y: faixa === 0 ? altura - margem : margem + util * (1 - (valor - minimo) / faixa),
  }));
}

/** Razão entre o valor e o máximo, presa entre 0 e 1. */
export function intensidade(valor: number, maximo: number): number {
  if (maximo <= 0) return 0;
  return Math.min(1, seguro(valor) / maximo);
}

const cores = ['accent', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const;

/** Cor da série `indice` por token: o acento da academia primeiro, depois a paleta de apoio. */
export function corDaSerie(indice: number): string {
  return cssVar(cores[indice % cores.length]);
}

/** Texto de leitor de tela para um gráfico de uma série: o resumo da tela mais o pico. */
export function resumoDaSerie(
  titulo: string | undefined,
  nome: string,
  dados: readonly PontoGrafico[],
  formatar: FormatarValor,
): string {
  const indice = indiceDestaque(dados.map((p) => p.valor));
  const pico =
    indice >= 0 ? `; maior valor ${formatar(dados[indice].valor)} em ${dados[indice].rotulo}` : '';
  return `${titulo ?? nome}. ${dados.length} pontos${pico}.`;
}
