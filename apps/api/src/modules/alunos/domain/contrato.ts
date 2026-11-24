import type { DataCivil } from '../../platform/domain/relogio';
import { diasEntre, fimDaVigencia, somarDias } from './datas';

// Contrato do aluno (ADR-018, bloco "Contratos e atraso" de Configurações). O estado sai do atraso
// informado pela cobrança (T19) e da configuração do tenant:
//   diasDeAtraso 0 → Ativo; 1 a T−1 → Tolerância ("encerra em T − dias"); ≥ T → Encerrado.
// Pagamento até R dias (inclusive) depois do encerramento reativa o mesmo contrato, sem nova adesão.

export const ESTADOS_DO_CONTRATO = ['ativo', 'tolerancia', 'encerrado', 'trancado'] as const;
export type EstadoDoContrato = (typeof ESTADOS_DO_CONTRATO)[number];

export const MOTIVOS_DE_ENCERRAMENTO = ['atraso', 'vigencia'] as const;
export type MotivoDoEncerramento = (typeof MOTIVOS_DE_ENCERRAMENTO)[number];

export const SITUACOES_DE_VENCIMENTO = ['em_dia', 'a_vencer', 'em_atraso'] as const;
export type SituacaoDeVencimento = (typeof SITUACOES_DE_VENCIMENTO)[number];

/** Janela de "A vencer": próxima parcela em até 7 dias, inclusive (hoje também conta). */
export const JANELA_A_VENCER_DIAS = 7;

export interface ConfiguracaoDeContrato {
  /** T: dias de atraso que encerram o contrato. */
  toleranciaDias: number;
  /** R: até quantos dias depois do encerramento o pagamento reativa o mesmo contrato. */
  reativacaoDias: number;
  trancamentoMaximoDias: number;
}

export const CONFIGURACAO_PADRAO: ConfiguracaoDeContrato = {
  toleranciaDias: 7,
  reativacaoDias: 30,
  trancamentoMaximoDias: 90,
};

export class ConfiguracaoDeContratoInvalidaError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'ConfiguracaoDeContratoInvalidaError';
  }
}

export function validarConfiguracao(config: ConfiguracaoDeContrato): void {
  const entre = (valor: number, minimo: number, maximo: number): boolean =>
    Number.isSafeInteger(valor) && valor >= minimo && valor <= maximo;
  if (!entre(config.toleranciaDias, 1, 90)) {
    throw new ConfiguracaoDeContratoInvalidaError('A tolerância vai de 1 a 90 dias.');
  }
  if (!entre(config.reativacaoDias, 0, 365)) {
    throw new ConfiguracaoDeContratoInvalidaError('A reativação vai de 0 a 365 dias.');
  }
  if (!entre(config.trancamentoMaximoDias, 1, 365)) {
    throw new ConfiguracaoDeContratoInvalidaError('O trancamento máximo vai de 1 a 365 dias.');
  }
}

/** O que o contrato guarda e as regras leem. */
export interface EstadoGuardado {
  estado: EstadoDoContrato;
  inicio: DataCivil;
  fim: DataCivil;
  /** Vencimento da parcela em aberto mais antiga, quando há atraso (T19). */
  vencimentoEmAtraso: DataCivil | null;
  proximoVencimento: DataCivil | null;
  encerradoEm: DataCivil | null;
  motivoDoEncerramento: MotivoDoEncerramento | null;
  trancadoDesde: DataCivil | null;
  trancadoAte: DataCivil | null;
}

/**
 * Dias corridos entre o vencimento e hoje no calendário de São Paulo (ADR-018: 13/11 → 19/11 = 6).
 * A regra é a do domínio de Cobrança; até o T19 existir, ela mora aqui e o T19 a reaproveita.
 */
export function diasDeAtraso(vencimento: DataCivil | null, hoje: DataCivil): number {
  return vencimento === null ? 0 : Math.max(0, diasEntre(vencimento, hoje));
}

export interface AvaliacaoDoContrato {
  estado: EstadoDoContrato;
  diasDeAtraso: number;
  /** Só em Tolerância: `T − diasDeAtraso` ("Contrato encerra em 1 dia"). */
  encerraEmDias: number | null;
  encerradoEm: DataCivil | null;
  motivoDoEncerramento: MotivoDoEncerramento | null;
}

/**
 * Estado do contrato em `hoje`. Encerrado continua encerrado até um pagamento reativá-lo; trancado
 * não entra em Tolerância (o atraso fica parado); o trancamento termina sozinho em `trancadoAte`.
 */
export function avaliarContrato(
  contrato: EstadoGuardado,
  hoje: DataCivil,
  config: ConfiguracaoDeContrato,
): AvaliacaoDoContrato {
  const atraso = diasDeAtraso(contrato.vencimentoEmAtraso, hoje);
  if (contrato.estado === 'encerrado') {
    return {
      estado: 'encerrado',
      diasDeAtraso: atraso,
      encerraEmDias: null,
      encerradoEm: contrato.encerradoEm,
      motivoDoEncerramento: contrato.motivoDoEncerramento,
    };
  }
  const base = { encerraEmDias: null, encerradoEm: null, motivoDoEncerramento: null };
  if (
    contrato.estado === 'trancado' &&
    contrato.trancadoAte !== null &&
    hoje < contrato.trancadoAte
  ) {
    return { ...base, estado: 'trancado', diasDeAtraso: atraso };
  }
  if (contrato.vencimentoEmAtraso !== null && atraso >= config.toleranciaDias) {
    return {
      estado: 'encerrado',
      diasDeAtraso: atraso,
      encerraEmDias: null,
      encerradoEm: somarDias(contrato.vencimentoEmAtraso, config.toleranciaDias),
      motivoDoEncerramento: 'atraso',
    };
  }
  if (hoje > contrato.fim) {
    return {
      estado: 'encerrado',
      diasDeAtraso: atraso,
      encerraEmDias: null,
      encerradoEm: somarDias(contrato.fim, 1),
      motivoDoEncerramento: 'vigencia',
    };
  }
  if (atraso > 0) {
    return {
      ...base,
      estado: 'tolerancia',
      diasDeAtraso: atraso,
      encerraEmDias: config.toleranciaDias - atraso,
    };
  }
  return { ...base, estado: 'ativo', diasDeAtraso: 0 };
}

/** Em dia, a vencer (próxima parcela em até 7 dias, inclusive) ou em atraso. */
export function situacaoDeVencimento(
  contrato: Pick<EstadoGuardado, 'vencimentoEmAtraso' | 'proximoVencimento'> | null,
  hoje: DataCivil,
): SituacaoDeVencimento {
  if (!contrato) {
    return 'em_dia';
  }
  if (diasDeAtraso(contrato.vencimentoEmAtraso, hoje) > 0) {
    return 'em_atraso';
  }
  if (contrato.proximoVencimento !== null) {
    const faltam = diasEntre(hoje, contrato.proximoVencimento);
    if (faltam >= 0 && faltam <= JANELA_A_VENCER_DIAS) {
      return 'a_vencer';
    }
  }
  return 'em_dia';
}

export type DecisaoDoPagamento = 'reativar' | 'nova_adesao';

/**
 * Pagamento depois do encerramento por atraso: até R dias (inclusive) reativa o mesmo contrato; depois
 * disso, é nova adesão.
 */
export function decidirPagamentoAposEncerramento(
  encerradoEm: DataCivil,
  pagoEm: DataCivil,
  config: ConfiguracaoDeContrato,
): DecisaoDoPagamento {
  return diasEntre(encerradoEm, pagoEm) <= config.reativacaoDias ? 'reativar' : 'nova_adesao';
}

export class OperacaoDeContratoInvalidaError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'OperacaoDeContratoInvalidaError';
  }
}

/** Trancar por `dias`: a vigência é estendida pelo mesmo tempo. */
export function trancar(
  contrato: EstadoGuardado,
  hoje: DataCivil,
  dias: number,
  config: ConfiguracaoDeContrato,
): Pick<EstadoGuardado, 'estado' | 'fim' | 'trancadoDesde' | 'trancadoAte'> {
  if (!Number.isSafeInteger(dias) || dias < 1 || dias > config.trancamentoMaximoDias) {
    throw new OperacaoDeContratoInvalidaError(
      `O trancamento vai de 1 a ${config.trancamentoMaximoDias} dias.`,
    );
  }
  const atual = avaliarContrato(contrato, hoje, config).estado;
  if (atual === 'encerrado' || atual === 'trancado') {
    throw new OperacaoDeContratoInvalidaError(`Contrato ${atual} não pode ser trancado.`);
  }
  return {
    estado: 'trancado',
    fim: somarDias(contrato.fim, dias),
    trancadoDesde: hoje,
    trancadoAte: somarDias(hoje, dias),
  };
}

/** Destrancar antes do prazo devolve à vigência os dias de trancamento que não foram usados. */
export function destrancar(
  contrato: EstadoGuardado,
  hoje: DataCivil,
): Pick<EstadoGuardado, 'estado' | 'fim' | 'trancadoDesde' | 'trancadoAte'> {
  if (contrato.estado !== 'trancado' || contrato.trancadoAte === null) {
    throw new OperacaoDeContratoInvalidaError('O contrato não está trancado.');
  }
  const naoUsados = Math.max(0, diasEntre(hoje, contrato.trancadoAte));
  return {
    estado: 'ativo',
    fim: somarDias(contrato.fim, -naoUsados),
    trancadoDesde: null,
    trancadoAte: null,
  };
}

/**
 * Renovar por mais um período do plano: começa no dia seguinte ao fim (ou hoje, se a vigência já
 * acabou). Contrato encerrado por atraso não renova: o caminho é pagar (reativação) ou nova adesão.
 */
export function renovar(
  contrato: EstadoGuardado,
  hoje: DataCivil,
  duracaoMeses: number,
  config: ConfiguracaoDeContrato,
): { novoInicio: DataCivil; fim: DataCivil } {
  const avaliacao = avaliarContrato(contrato, hoje, config);
  if (avaliacao.estado === 'encerrado' && avaliacao.motivoDoEncerramento === 'atraso') {
    throw new OperacaoDeContratoInvalidaError(
      'Contrato encerrado por atraso não renova: regularize o pagamento ou faça nova adesão.',
    );
  }
  if (avaliacao.estado === 'trancado') {
    throw new OperacaoDeContratoInvalidaError('Destranque o contrato antes de renovar.');
  }
  const novoInicio = hoje > contrato.fim ? hoje : somarDias(contrato.fim, 1);
  return { novoInicio, fim: fimDaVigencia(novoInicio, duracaoMeses) };
}
