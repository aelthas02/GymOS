import { diasEntre } from '../../alunos/domain/datas';
import type { DataCivil } from '../../platform/domain/relogio';

// Alertas de frequência (T23a, bloco "Alertas de frequência" de Configurações): quem começou a se
// afastar. O alerta comum avisa quem passou do prazo sem treinar; o urgente marca o aluno em risco de
// cancelar; a queda compara as últimas 4 semanas com as 4 anteriores.

export const TIPOS_DE_ALERTA = ['sem_treinar', 'queda'] as const;
export type TipoDeAlerta = (typeof TIPOS_DE_ALERTA)[number];

export const NIVEIS_DO_ALERTA = ['comum', 'urgente'] as const;
export type NivelDoAlerta = (typeof NIVEIS_DO_ALERTA)[number];

export const DESTINATARIOS_DO_ALERTA = ['professor', 'recepcao', 'gerencia'] as const;
export type DestinatarioDoAlerta = (typeof DESTINATARIOS_DO_ALERTA)[number];

/** Semanas de cada janela da queda de frequência (últimas 4 contra as 4 anteriores). */
export const SEMANAS_DA_JANELA = 4;
export const DIAS_DA_JANELA = SEMANAS_DA_JANELA * 7;

export interface ConfiguracaoDeAlertas {
  /** Alerta comum: dias sem treinar. */
  diasSemTreinar: number;
  /** Alerta urgente: dias sem treinar. */
  urgenteAposDias: number;
  /** Queda de frequência, em %, das últimas 4 semanas sobre as 4 anteriores. */
  quedaPercentual: number;
  ignorarFeriasETrancados: boolean;
  /** `HH:MM` de São Paulo: a verificação é diária. */
  horaDaVerificacao: string;
  destinatarios: readonly DestinatarioDoAlerta[];
  /** Mensagem automática ao aluno; só vai a quem aceitou marketing (T13d, LGPD). */
  mensagemAoAluno: boolean;
}

export const CONFIGURACAO_DE_ALERTAS_PADRAO: ConfiguracaoDeAlertas = {
  diasSemTreinar: 7,
  urgenteAposDias: 15,
  quedaPercentual: 40,
  ignorarFeriasETrancados: true,
  horaDaVerificacao: '08:00',
  destinatarios: ['professor', 'recepcao', 'gerencia'],
  mensagemAoAluno: false,
};

export class ConfiguracaoDeAlertasInvalidaError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'ConfiguracaoDeAlertasInvalidaError';
  }
}

export function validarConfiguracaoDeAlertas(config: ConfiguracaoDeAlertas): void {
  const entre = (valor: number, minimo: number, maximo: number): boolean =>
    Number.isSafeInteger(valor) && valor >= minimo && valor <= maximo;
  if (!entre(config.diasSemTreinar, 1, 365)) {
    throw new ConfiguracaoDeAlertasInvalidaError('Os dias sem treinar vão de 1 a 365.');
  }
  if (!entre(config.urgenteAposDias, 1, 365) || config.urgenteAposDias < config.diasSemTreinar) {
    throw new ConfiguracaoDeAlertasInvalidaError(
      'O alerta urgente vai de 1 a 365 dias e não pode vir antes do alerta comum.',
    );
  }
  if (!entre(config.quedaPercentual, 1, 100)) {
    throw new ConfiguracaoDeAlertasInvalidaError('A queda de frequência vai de 1% a 100%.');
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(config.horaDaVerificacao)) {
    throw new ConfiguracaoDeAlertasInvalidaError('A hora da verificação usa o formato HH:MM.');
  }
  const validos = config.destinatarios.every((d) =>
    (DESTINATARIOS_DO_ALERTA as readonly string[]).includes(d),
  );
  if (!validos || new Set(config.destinatarios).size !== config.destinatarios.length) {
    throw new ConfiguracaoDeAlertasInvalidaError('Destinatários inválidos para o alerta.');
  }
}

/** O que a avaliação precisa saber de um aluno. */
export interface FrequenciaDoAluno {
  /** Último dia com entrada liberada, ou, sem nenhuma, o início do contrato vigente. */
  desde: DataCivil;
  /** Dias com entrada nas últimas 4 semanas (terminando hoje). */
  diasRecentes: number;
  /** Dias com entrada nas 4 semanas anteriores a essas. */
  diasAnteriores: number;
  /** Contrato trancado (férias): ignorado quando `ignorarFeriasETrancados`. */
  trancado: boolean;
}

export interface AlertaApurado {
  tipo: TipoDeAlerta;
  nivel: NivelDoAlerta;
  diasSemTreinar: number | null;
  quedaPercentual: number | null;
}

/**
 * Alertas que valem hoje para um aluno com contrato vigente (encerrado já nem é avaliado). Sem
 * treinar há `diasSemTreinar` ou mais é comum; a partir de `urgenteAposDias` é urgente. A queda só
 * existe quando as 4 semanas anteriores tiveram treino.
 */
export function apurarAlertas(
  frequencia: FrequenciaDoAluno,
  hoje: DataCivil,
  config: ConfiguracaoDeAlertas,
): AlertaApurado[] {
  if (frequencia.trancado && config.ignorarFeriasETrancados) {
    return [];
  }
  const alertas: AlertaApurado[] = [];
  const dias = Math.max(0, diasEntre(frequencia.desde, hoje));
  if (dias >= config.diasSemTreinar) {
    alertas.push({
      tipo: 'sem_treinar',
      nivel: dias >= config.urgenteAposDias ? 'urgente' : 'comum',
      diasSemTreinar: dias,
      quedaPercentual: null,
    });
  }
  const { diasAnteriores, diasRecentes } = frequencia;
  // Comparação em inteiros: (anterior − recente) / anterior ≥ queda%.
  if (
    diasAnteriores > 0 &&
    (diasAnteriores - diasRecentes) * 100 >= config.quedaPercentual * diasAnteriores
  ) {
    alertas.push({
      tipo: 'queda',
      nivel: 'comum',
      diasSemTreinar: null,
      quedaPercentual: Math.round(((diasAnteriores - diasRecentes) * 100) / diasAnteriores),
    });
  }
  return alertas;
}
