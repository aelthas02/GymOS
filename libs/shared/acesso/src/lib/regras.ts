import { diaEmSaoPaulo, minutoDoDiaEmSaoPaulo, minutosDoHorario, segundaDaSemana } from './tempo';

// Regras de acesso (T23a): uma Strategy por regra, encadeadas; cada uma devolve liberado, liberado
// na tolerância ou negado com motivo. Pacote puro, usado pela API e pelo agente da catraca (T24a,
// ADR-016): sem banco, sem relógio e sem Nest. Quem chama traz tudo em `PedidoDeAcesso`.
//
// ADR-018 (fronteira de atraso): `diasDeAtraso` vem sempre da função única da Cobrança (T19). Com
// "bloquear após N dias", a catraca nega quando `diasDeAtraso ≥ N − 1` (a partir do N-ésimo dia,
// contando o dia do vencimento) e libera "na tolerância" de 1 até N − 2.

export type DirecaoDeAcesso = 'entrada' | 'saida';
export type MetodoDeAcesso = 'facial' | 'biometria' | 'qr_code' | 'manual';
export type ResultadoDeAcesso = 'liberado' | 'tolerancia' | 'negado';

export const MOTIVOS_DE_NEGACAO = {
  mensalidade_em_atraso: 'Mensalidade em atraso',
  contrato_encerrado: 'Contrato encerrado',
  plano_trancado: 'Plano trancado',
  sem_contrato: 'Sem contrato vigente',
  fora_do_horario: 'Fora do horário de funcionamento',
  modalidade_fora_do_plano: 'Modalidade fora do plano',
  limite_diario: 'Limite diário',
  anti_passback: 'Anti-passback',
  limite_semanal: 'Limite semanal do plano',
  qr_ja_usado: 'QR já usado',
  qr_invalido: 'QR inválido',
  qr_expirado: 'QR expirado',
  aluno_nao_encontrado: 'Aluno não encontrado',
} as const;
export type MotivoDeNegacao = keyof typeof MOTIVOS_DE_NEGACAO;

export const rotuloDoMotivo = (motivo: MotivoDeNegacao): string => MOTIVOS_DE_NEGACAO[motivo];

export interface ConfiguracaoDeAcesso {
  /** N de "Bloquear aluno em atraso: após N dias"; `null` não bloqueia por atraso. */
  bloqueioPorAtrasoDias: number | null;
  /** `HH:MM` no fuso de São Paulo; o início é inclusivo e o fim, exclusivo. */
  abertura: string;
  fechamento: string;
  /** Entradas por dia; `null` é ilimitado. Sair e entrar de novo conta como nova entrada. */
  limitePorDia: number | null;
  antiPassback: boolean;
}

export const CONFIGURACAO_DE_ACESSO_PADRAO: ConfiguracaoDeAcesso = {
  bloqueioPorAtrasoDias: 7,
  abertura: '05:00',
  fechamento: '23:00',
  limitePorDia: 1,
  antiPassback: true,
};

/** Estado do contrato do aluno como o domínio de alunos o avalia (T15a); `null` é sem contrato. */
export type SituacaoDoContratoParaAcesso = 'ativo' | 'tolerancia' | 'encerrado' | 'trancado' | null;

/** Passagem já liberada (entrada ou saída), do histórico do aluno. */
export interface PassagemLiberada {
  direcao: DirecaoDeAcesso;
  registradoEm: Date;
}

export interface PedidoDeAcesso {
  direcao: DirecaoDeAcesso;
  instante: Date;
  /** Modalidade do ponto de acesso (ex.: `Lutas`); `null` é a entrada geral da academia. */
  modalidade: string | null;
  contrato: SituacaoDoContratoParaAcesso;
  /** Sempre de `diasDeAtraso` da Cobrança (ADR-018). */
  diasDeAtraso: number;
  modalidadesDoPlano: readonly string[];
  /** `null` é ilimitado. */
  acessosPorSemana: number | null;
  /** Passagens liberadas do aluno; precisam cobrir ao menos a semana (segunda a domingo) do instante. */
  passagens: readonly PassagemLiberada[];
  configuracao: ConfiguracaoDeAcesso;
}

export type DecisaoDeAcesso =
  | { resultado: 'liberado' }
  | { resultado: 'tolerancia' }
  | { resultado: 'negado'; motivo: MotivoDeNegacao };

export interface RegraDeAcesso {
  readonly nome: string;
  avaliar(pedido: PedidoDeAcesso): DecisaoDeAcesso;
}

const LIBERADO: DecisaoDeAcesso = { resultado: 'liberado' };
const TOLERANCIA: DecisaoDeAcesso = { resultado: 'tolerancia' };
const negado = (motivo: MotivoDeNegacao): DecisaoDeAcesso => ({ resultado: 'negado', motivo });

const semAcento = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

const doMesmoDia = (passagem: PassagemLiberada, instante: Date): boolean =>
  diaEmSaoPaulo(passagem.registradoEm) === diaEmSaoPaulo(instante);

/** Contrato Encerrado ou Trancado (T15a), ou sem contrato, nega. */
export const regraDoContrato: RegraDeAcesso = {
  nome: 'contrato',
  avaliar({ contrato }) {
    switch (contrato) {
      case null:
        return negado('sem_contrato');
      case 'encerrado':
        return negado('contrato_encerrado');
      case 'trancado':
        return negado('plano_trancado');
      default:
        return LIBERADO;
    }
  },
};

/** ADR-018: nega com `diasDeAtraso ≥ N − 1`; de 1 até N − 2 libera na tolerância. */
export const regraDeAtraso: RegraDeAcesso = {
  nome: 'atraso',
  avaliar({ diasDeAtraso, configuracao }) {
    const n = configuracao.bloqueioPorAtrasoDias;
    if (n === null || diasDeAtraso < 1) {
      return LIBERADO;
    }
    // Com N = 1 o limite seria 0 e barraria quem está em dia: o primeiro dia de atraso é o piso.
    return diasDeAtraso >= Math.max(1, n - 1) ? negado('mensalidade_em_atraso') : TOLERANCIA;
  },
};

/** Horário de funcionamento em São Paulo; vale também a janela que cruza a meia-noite. */
export const regraDeHorario: RegraDeAcesso = {
  nome: 'horario',
  avaliar({ instante, configuracao }) {
    const abre = minutosDoHorario(configuracao.abertura);
    const fecha = minutosDoHorario(configuracao.fechamento);
    const agora = minutoDoDiaEmSaoPaulo(instante);
    const aberto =
      abre === fecha
        ? true
        : abre < fecha
          ? agora >= abre && agora < fecha
          : agora >= abre || agora < fecha;
    return aberto ? LIBERADO : negado('fora_do_horario');
  },
};

/** Aulas e lutas só com plano que inclui a modalidade. */
export const regraDeModalidade: RegraDeAcesso = {
  nome: 'modalidade',
  avaliar({ modalidade, modalidadesDoPlano }) {
    if (modalidade === null) {
      return LIBERADO;
    }
    const doPlano = modalidadesDoPlano.map(semAcento);
    return doPlano.includes(semAcento(modalidade)) ? LIBERADO : negado('modalidade_fora_do_plano');
  },
};

/** Anti-passback: nova entrada no mesmo dia sem ter saído da anterior é negada. */
export const regraDeAntiPassback: RegraDeAcesso = {
  nome: 'anti-passback',
  avaliar({ passagens, instante, configuracao }) {
    if (!configuracao.antiPassback) {
      return LIBERADO;
    }
    const ultima = passagens
      .filter((passagem) => doMesmoDia(passagem, instante))
      .reduce<PassagemLiberada | null>(
        (maisNova, passagem) =>
          maisNova === null || passagem.registradoEm > maisNova.registradoEm ? passagem : maisNova,
        null,
      );
    return ultima?.direcao === 'entrada' ? negado('anti_passback') : LIBERADO;
  },
};

/** Limite de entradas por dia (padrão 1); cada entrada, mesmo depois de sair, conta. */
export const regraDeLimiteDiario: RegraDeAcesso = {
  nome: 'limite-diario',
  avaliar({ passagens, instante, configuracao }) {
    const limite = configuracao.limitePorDia;
    if (limite === null) {
      return LIBERADO;
    }
    const entradas = passagens.filter(
      (passagem) => passagem.direcao === 'entrada' && doMesmoDia(passagem, instante),
    ).length;
    return entradas >= limite ? negado('limite_diario') : LIBERADO;
  },
};

/**
 * Acessos por semana do plano (segunda a domingo): conta os dias com entrada. Voltar no mesmo dia
 * não gasta outro acesso da semana (o limite do dia é a regra anterior).
 */
export const regraDeLimiteSemanal: RegraDeAcesso = {
  nome: 'limite-semanal',
  avaliar({ passagens, instante, acessosPorSemana }) {
    if (acessosPorSemana === null) {
      return LIBERADO;
    }
    const hoje = diaEmSaoPaulo(instante);
    const segunda = segundaDaSemana(hoje);
    const diasComEntrada = new Set(
      passagens
        .filter((passagem) => passagem.direcao === 'entrada')
        .map((passagem) => diaEmSaoPaulo(passagem.registradoEm))
        .filter((dia) => dia >= segunda && dia <= hoje),
    );
    return !diasComEntrada.has(hoje) && diasComEntrada.size >= acessosPorSemana
      ? negado('limite_semanal')
      : LIBERADO;
  },
};

/** Ordem da cadeia: a primeira negação encerra; a tolerância só vale se nenhuma regra negar. */
export const REGRAS_DE_ACESSO: readonly RegraDeAcesso[] = [
  regraDoContrato,
  regraDeAtraso,
  regraDeHorario,
  regraDeModalidade,
  regraDeAntiPassback,
  regraDeLimiteDiario,
  regraDeLimiteSemanal,
];

/**
 * Avalia um pedido pela cadeia. Saída nunca é barrada: quem está dentro precisa poder sair, e a
 * regra de atraso, de horário ou de plano não faz sentido para quem já entrou.
 */
export function avaliarAcesso(
  pedido: PedidoDeAcesso,
  regras: readonly RegraDeAcesso[] = REGRAS_DE_ACESSO,
): DecisaoDeAcesso {
  if (pedido.direcao === 'saida') {
    return LIBERADO;
  }
  let decisao: DecisaoDeAcesso = LIBERADO;
  for (const regra of regras) {
    const parcial = regra.avaliar(pedido);
    if (parcial.resultado === 'negado') {
      return parcial;
    }
    if (parcial.resultado === 'tolerancia') {
      decisao = TOLERANCIA;
    }
  }
  return decisao;
}

export function validarConfiguracaoDeAcesso(config: ConfiguracaoDeAcesso): string | null {
  const inteiroEntre = (valor: number, minimo: number, maximo: number): boolean =>
    Number.isSafeInteger(valor) && valor >= minimo && valor <= maximo;
  if (config.bloqueioPorAtrasoDias !== null && !inteiroEntre(config.bloqueioPorAtrasoDias, 1, 90)) {
    return 'O bloqueio por atraso vai de 1 a 90 dias.';
  }
  if (config.limitePorDia !== null && !inteiroEntre(config.limitePorDia, 1, 24)) {
    return 'O limite por dia vai de 1 a 24 entradas.';
  }
  try {
    minutosDoHorario(config.abertura);
    minutosDoHorario(config.fechamento);
  } catch {
    return 'Os horários de funcionamento usam o formato HH:MM.';
  }
  return null;
}
