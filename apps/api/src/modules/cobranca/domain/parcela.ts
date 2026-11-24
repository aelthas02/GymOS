import { centavos, ratear } from '@gymos/shared-money';
import { diasEntre, somarDias } from '../../alunos/domain/datas';
import type { DataCivil } from '../../platform/domain/relogio';

// Parcela do contrato (T19, ADR-018). O cronograma sai do rateio do valor do contrato, com vencimento
// mensal no dia do início; o atraso conta em dias corridos no calendário de São Paulo.

export const SITUACOES_DA_PARCELA = [
  'em_aberto',
  'paga',
  'atrasada',
  'cancelada',
  'suspensa',
] as const;
export type SituacaoDaParcela = (typeof SITUACOES_DA_PARCELA)[number];

/** Situações em que a parcela ainda espera pagamento (e conta atraso). */
export const SITUACOES_A_RECEBER: readonly SituacaoDaParcela[] = ['em_aberto', 'atrasada'];

export interface Parcela {
  id: string;
  contratoId: string;
  /** Nulo depois da exclusão do titular (LGPD). */
  alunoId: string | null;
  /** Início do período do contrato a que a parcela pertence (adesão ou renovação). */
  periodo: DataCivil;
  numero: number;
  totalDeParcelas: number;
  valorCentavos: number;
  pagoCentavos: number;
  vencimento: DataCivil;
  vencimentoOriginal: DataCivil;
  situacao: SituacaoDaParcela;
  suspensaDesde: DataCivil | null;
}

export class OperacaoDeParcelaInvalidaError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'OperacaoDeParcelaInvalidaError';
  }
}

/**
 * Dias corridos entre o vencimento e hoje, ambos no calendário de São Paulo (ADR-018): vencimento
 * 13/11 e hoje 19/11 → 6; no dia do vencimento → 0. Função única do atraso: os outros domínios a
 * importam daqui.
 */
export function diasDeAtraso(vencimento: DataCivil | null, hoje: DataCivil): number {
  return vencimento === null ? 0 : Math.max(0, diasEntre(vencimento, hoje));
}

/** Atraso da parcela: só a que ainda espera pagamento atrasa (paga, cancelada e suspensa não). */
export function diasDeAtrasoDaParcela(
  parcela: Pick<Parcela, 'situacao' | 'vencimento'>,
  hoje: DataCivil,
): number {
  return SITUACOES_A_RECEBER.includes(parcela.situacao)
    ? diasDeAtraso(parcela.vencimento, hoje)
    : 0;
}

export function saldo(parcela: Pick<Parcela, 'valorCentavos' | 'pagoCentavos'>): number {
  return Math.max(0, parcela.valorCentavos - parcela.pagoCentavos);
}

function partes(dia: DataCivil): [number, number, number] {
  const [ano = 0, mes = 0, d = 0] = dia.split('-').map(Number);
  return [ano, mes, d];
}

const doisDigitos = (valor: number): string => String(valor).padStart(2, '0');

/**
 * O mesmo dia `meses` depois; dia inexistente no mês vai para o último dia (31/01 + 1 → 28/02, ou
 * 29/02 em ano bissexto). Sempre a partir do dia original, para 31/03 não virar 28/03.
 */
export function somarMeses(dia: DataCivil, meses: number): DataCivil {
  const [ano, mes, d] = partes(dia);
  const indice = mes - 1 + meses;
  const anoFinal = ano + Math.floor(indice / 12);
  const mesFinal = (((indice % 12) + 12) % 12) + 1;
  const ultimo = new Date(Date.UTC(anoFinal, mesFinal, 0)).getUTCDate();
  return `${anoFinal}-${doisDigitos(mesFinal)}-${doisDigitos(Math.min(d, ultimo))}` as DataCivil;
}

export interface NovaParcela {
  numero: number;
  totalDeParcelas: number;
  valorCentavos: number;
  vencimento: DataCivil;
}

/**
 * Cronograma de um período do contrato: `ratear` (a última leva o resto, R$ 948,00 em 9x → 8 de
 * R$ 105,33 e a última de R$ 105,36) e vencimento mensal no dia do início.
 */
export function cronograma(
  inicio: DataCivil,
  valorTotalCentavos: number,
  parcelas: number,
): NovaParcela[] {
  return ratear(centavos(valorTotalCentavos), parcelas).map((valor, indice) => ({
    numero: indice + 1,
    totalDeParcelas: parcelas,
    valorCentavos: valor,
    vencimento: somarMeses(inicio, indice),
  }));
}

export interface ResultadoDoPagamento {
  pagoCentavos: number;
  situacao: SituacaoDaParcela;
  /** Pagou menos que o saldo: "pago parcial", a parcela continua a receber pelo resto. */
  parcial: boolean;
}

/** Aplica um pagamento; a parcela só fica paga quando o saldo zera. */
export function aplicarPagamento(parcela: Parcela, valorCentavos: number): ResultadoDoPagamento {
  if (!SITUACOES_A_RECEBER.includes(parcela.situacao) || saldo(parcela) === 0) {
    throw new OperacaoDeParcelaInvalidaError('A parcela não está em aberto.');
  }
  if (!Number.isSafeInteger(valorCentavos) || valorCentavos < 1) {
    throw new OperacaoDeParcelaInvalidaError('O valor do pagamento precisa ser positivo.');
  }
  const pagoCentavos = Math.min(parcela.valorCentavos, parcela.pagoCentavos + valorCentavos);
  const quitada = pagoCentavos >= parcela.valorCentavos;
  return {
    pagoCentavos,
    situacao: quitada ? 'paga' : parcela.situacao,
    parcial: !quitada,
  };
}

/**
 * Estorno de um pagamento da parcela: devolve o valor ao saldo e a reabre. Volta em aberto mesmo
 * vencida: a rotina diária a marca como atrasada e publica o PagamentoAtrasado.
 */
export function estornarNaParcela(
  parcela: Parcela,
  valorCentavos: number,
): Pick<Parcela, 'pagoCentavos' | 'situacao'> {
  const pagoCentavos = Math.max(0, parcela.pagoCentavos - valorCentavos);
  if (parcela.situacao === 'cancelada' || parcela.situacao === 'suspensa') {
    return { pagoCentavos, situacao: parcela.situacao };
  }
  if (pagoCentavos >= parcela.valorCentavos) {
    return { pagoCentavos, situacao: 'paga' };
  }
  return { pagoCentavos, situacao: parcela.situacao === 'atrasada' ? 'atrasada' : 'em_aberto' };
}

/** Rotina diária: parcela em aberto com o vencimento já passado passa a atrasada. */
export function venceu(
  parcela: Pick<Parcela, 'situacao' | 'vencimento'>,
  hoje: DataCivil,
): boolean {
  return parcela.situacao === 'em_aberto' && parcela.vencimento < hoje;
}

/** Combinar nova data: adia o vencimento para hoje ou depois e zera o atraso. */
export function combinarNovaData(
  parcela: Parcela,
  novoVencimento: DataCivil,
  hoje: DataCivil,
): Pick<Parcela, 'vencimento' | 'situacao'> {
  if (!SITUACOES_A_RECEBER.includes(parcela.situacao)) {
    throw new OperacaoDeParcelaInvalidaError('Só parcela em aberto ou atrasada muda de data.');
  }
  if (novoVencimento < hoje) {
    throw new OperacaoDeParcelaInvalidaError('A nova data não pode ser anterior a hoje.');
  }
  if (novoVencimento <= parcela.vencimento && parcela.vencimento >= hoje) {
    throw new OperacaoDeParcelaInvalidaError('A nova data precisa ser depois do vencimento atual.');
  }
  return { vencimento: novoVencimento, situacao: 'em_aberto' };
}

/** Contrato trancado: parcelas a receber que vencem a partir do início do trancamento ficam suspensas. */
export function deveSuspender(parcela: Parcela, desde: DataCivil): boolean {
  return SITUACOES_A_RECEBER.includes(parcela.situacao) && parcela.vencimento >= desde;
}

/**
 * Contrato destrancado: a parcela suspensa volta a receber, com o vencimento adiado pelos dias em que
 * o contrato ficou trancado.
 */
export function reprogramar(
  parcela: Parcela,
  destrancadoEm: DataCivil,
): Pick<Parcela, 'vencimento' | 'situacao' | 'suspensaDesde'> {
  const dias = parcela.suspensaDesde
    ? Math.max(0, diasEntre(parcela.suspensaDesde, destrancadoEm))
    : 0;
  return {
    vencimento: somarDias(parcela.vencimento, dias),
    situacao: 'em_aberto',
    suspensaDesde: null,
  };
}
