import { aplicarAliquota, centavos, pontosBase } from '@gymos/shared-money';
import { createHash } from 'node:crypto';

// Regras puras das notas fiscais (T20, ADR-008): tipo pela origem do pagamento, ISS em pontos-base,
// competência e lote no calendário de São Paulo, e as transições de situação.

export const TIPOS_DE_NOTA = ['nfse', 'nfce'] as const;
export type TipoDeNota = (typeof TIPOS_DE_NOTA)[number];

export const SITUACOES_DA_NOTA = [
  'pendente',
  'processando',
  'emitida',
  'rejeitada',
  'cancelada',
] as const;
export type SituacaoDaNota = (typeof SITUACOES_DA_NOTA)[number];

/** Origens do pagamento (T19). */
export type OrigemDaNota =
  'mensalidade' | 'plano' | 'aula_avulsa' | 'personal' | 'nutricao' | 'loja';

/** Strategy por origem: serviço sai como NFS-e; venda da Loja, como NFC-e. */
const TIPO_POR_ORIGEM: Readonly<Record<OrigemDaNota, TipoDeNota>> = {
  mensalidade: 'nfse',
  plano: 'nfse',
  aula_avulsa: 'nfse',
  personal: 'nfse',
  nutricao: 'nfse',
  loja: 'nfce',
};

export function ehOrigemDaNota(valor: string): valor is OrigemDaNota {
  return Object.hasOwn(TIPO_POR_ORIGEM, valor);
}

export function tipoDaOrigem(origem: OrigemDaNota): TipoDeNota {
  return TIPO_POR_ORIGEM[origem];
}

const DESCRICAO_POR_ORIGEM: Readonly<Record<OrigemDaNota, string>> = {
  mensalidade: 'Mensalidade',
  plano: 'Plano',
  aula_avulsa: 'Aula avulsa',
  personal: 'Personal trainer',
  nutricao: 'Consulta de nutrição',
  loja: 'Venda da Loja',
};

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

/** "Mensalidade de novembro, plano Mensal"; sem plano, só a origem. */
export function descricaoDaNota(
  origem: OrigemDaNota,
  competencia: Competencia,
  plano: string | null,
): string {
  const base = DESCRICAO_POR_ORIGEM[origem];
  if (origem === 'mensalidade') {
    const mes = MESES[Number(competencia.slice(5, 7)) - 1] ?? '';
    return plano ? `${base} de ${mes}, plano ${plano}` : `${base} de ${mes}`;
  }
  if (origem === 'plano' && plano) {
    return `${base} ${plano}`;
  }
  return base;
}

// ---------- Valores ----------

export interface TotaisDaNota {
  valorCentavos: number;
  aliquotaIssPontosBase: number;
  issCentavos: number;
  retencoesCentavos: number;
  /** Valor da nota menos as retenções. */
  totalCentavos: number;
}

/** ISS de 250 pontos-base sobre R$ 119,00 = R$ 2,98; o total só desconta as retenções. */
export function totaisDaNota(
  valorCentavos: number,
  aliquotaIssPontosBase: number,
  retencoesCentavos = 0,
): TotaisDaNota {
  return {
    valorCentavos,
    aliquotaIssPontosBase,
    issCentavos: aplicarAliquota(centavos(valorCentavos), pontosBase(aliquotaIssPontosBase)),
    retencoesCentavos,
    totalCentavos: valorCentavos - retencoesCentavos,
  };
}

// ---------- Competência e lote ----------

declare const marcaDeCompetencia: unique symbol;
/** Mês de competência `AAAA-MM`. */
export type Competencia = string & { readonly [marcaDeCompetencia]: true };

const FORMATO_DA_COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

export function ehCompetencia(valor: string): valor is Competencia {
  return FORMATO_DA_COMPETENCIA.test(valor);
}

export const FUSO_FISCAL = 'America/Sao_Paulo';

interface PartesNoFuso {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
}

function partesNoFuso(instante: Date, fuso: string): PartesNoFuso {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instante);
  const valor = (tipo: string): number =>
    Number(partes.find((parte) => parte.type === tipo)?.value ?? 0);
  return {
    ano: valor('year'),
    mes: valor('month'),
    dia: valor('day'),
    hora: valor('hour'),
    minuto: valor('minute'),
  };
}

/** Competência do instante no calendário de São Paulo. */
export function competenciaDe(instante: Date, fuso: string = FUSO_FISCAL): Competencia {
  const { ano, mes } = partesNoFuso(instante, fuso);
  return `${ano}-${String(mes).padStart(2, '0')}` as Competencia;
}

/** "11/2026". */
export function competenciaExibida(competencia: Competencia): string {
  return `${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`;
}

const ultimoDiaDoMes = (ano: number, mes: number): number =>
  new Date(Date.UTC(ano, mes, 0)).getUTCDate();

/** Hora do lote: último dia do mês, 22:00 de São Paulo. */
export const HORA_DO_LOTE = 22;

/**
 * Regra "em lote no fim do mês": a nota pendente de uma competência sai às 22:00 (São Paulo) do último
 * dia do mês, ou depois disso (um lote que não rodou na hora sai no próximo). Às 21:59 de 30/11 nada sai;
 * às 22:00 de 30/11 (01/12 em UTC) saem as de 11/2026.
 */
export function noLote(competencia: Competencia, agora: Date, fuso: string = FUSO_FISCAL): boolean {
  const atual = competenciaDe(agora, fuso);
  if (competencia < atual) {
    return true;
  }
  if (competencia > atual) {
    return false;
  }
  const { ano, mes, dia, hora } = partesNoFuso(agora, fuso);
  return dia === ultimoDiaDoMes(ano, mes) && hora >= HORA_DO_LOTE;
}

// ---------- Quando emitir ----------

export interface RegraDeEmissao {
  emitirNfseAoConfirmar: boolean;
  emitirNfceNaVenda: boolean;
  emitirEmLote: boolean;
}

export type MomentoDaEmissao = 'agora' | 'lote' | 'manual';

/** NFC-e sai no momento da venda; o lote vale só para NFS-e (mensalidades e serviços). */
export function momentoDaEmissao(regra: RegraDeEmissao, tipo: TipoDeNota): MomentoDaEmissao {
  if (tipo === 'nfce') {
    return regra.emitirNfceNaVenda ? 'agora' : 'manual';
  }
  if (regra.emitirEmLote) {
    return 'lote';
  }
  return regra.emitirNfseAoConfirmar ? 'agora' : 'manual';
}

// ---------- Situações ----------

export class OperacaoDaNotaInvalidaError extends Error {
  constructor(
    readonly codigo:
      'ja_cancelada' | 'nao_emitida' | 'em_processamento' | 'nao_corrigivel' | 'ja_emitida',
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'OperacaoDaNotaInvalidaError';
  }
}

/** Situações em que a nota ainda pode ir ao emissor. */
export const SITUACOES_A_EMITIR: readonly SituacaoDaNota[] = ['pendente', 'processando'];

/** Reenviar: só pendente, processando ou rejeitada (corrigida ou não). */
export function conferirReenvio(situacao: SituacaoDaNota): void {
  if (situacao === 'emitida') {
    throw new OperacaoDaNotaInvalidaError('ja_emitida', 'A nota já foi emitida.');
  }
  if (situacao === 'cancelada') {
    throw new OperacaoDaNotaInvalidaError('ja_cancelada', 'A nota foi cancelada.');
  }
}

export function conferirCorrecao(situacao: SituacaoDaNota): void {
  if (situacao !== 'rejeitada' && situacao !== 'pendente') {
    throw new OperacaoDaNotaInvalidaError(
      'nao_corrigivel',
      'Só a nota rejeitada ou pendente pode ser corrigida.',
    );
  }
}

/**
 * Cancelamento: a emitida cancela no emissor; a que nunca saiu (pendente ou rejeitada) só localmente.
 * A cancelada recusa novo cancelamento; a em processamento espera a resposta do emissor.
 */
export function cancelamento(situacao: SituacaoDaNota): 'no-emissor' | 'local' {
  switch (situacao) {
    case 'cancelada':
      throw new OperacaoDaNotaInvalidaError('ja_cancelada', 'A nota já está cancelada.');
    case 'processando':
      throw new OperacaoDaNotaInvalidaError(
        'em_processamento',
        'A nota ainda está em processamento no emissor.',
      );
    case 'emitida':
      return 'no-emissor';
    default:
      return 'local';
  }
}

// ---------- Identidade e exibição ----------

/**
 * Id da nota de um pagamento, derivado do tenant, do pagamento e do tipo (formato de UUID v4). É a
 * chave de idempotência no emissor: a reentrega de um evento cuja transação caiu depois de o emissor
 * aceitar a nota usa a mesma chave, e a consulta encontra a nota em vez de emitir outra.
 */
export function idDaNotaDoPagamento(
  tenantId: string,
  pagamentoId: string,
  tipo: TipoDeNota,
): string {
  const hex = createHash('sha256').update(`nota:${tenantId}:${pagamentoId}:${tipo}`).digest('hex');
  const variante = ((Number.parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variante}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

/** "1.287" na NFS-e e "NFC 0412" na NFC-e; sem número, nada. */
export function rotuloDoNumero(tipo: TipoDeNota, numero: string | null): string | null {
  if (!numero) {
    return null;
  }
  if (tipo === 'nfce') {
    return `NFC ${numero.padStart(4, '0')}`;
  }
  return /^\d+$/.test(numero) ? Number(numero).toLocaleString('pt-BR') : numero;
}

export const NOME_DO_TIPO: Readonly<Record<TipoDeNota, string>> = {
  nfse: 'NFS-e',
  nfce: 'NFC-e',
};
