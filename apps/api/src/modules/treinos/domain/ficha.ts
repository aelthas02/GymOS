import { diasEntre } from '../../alunos/domain/datas';
import type { DataCivil } from '../../platform/domain/relogio';

// Regras puras do domínio treinos (T25): situação e validade da ficha, evolução de carga e o pedido
// à IA. Nada aqui lê relógio nem banco: quem chama traz o "hoje".

export const DIVISOES = ['AB', 'ABC', 'ABCD', 'full_body'] as const;
export type Divisao = (typeof DIVISOES)[number];

export const NOMES_DAS_DIVISOES: Record<Divisao, string> = {
  AB: 'A/B',
  ABC: 'A/B/C',
  ABCD: 'A/B/C/D',
  full_body: 'Full body',
};

export const NIVEIS = ['iniciante', 'intermediario', 'avancado'] as const;
export type Nivel = (typeof NIVEIS)[number];

export const GRUPOS_MUSCULARES = [
  'Peito',
  'Costas',
  'Pernas',
  'Ombros',
  'Braços',
  'Abdômen',
] as const;

/**
 * Situações guardadas (`arquivada`: ficha ativa trocada por outra mais nova). "Vencida" não é
 * guardada: deriva de `validaAte` (ver `situacaoDaFicha`).
 */
export const SITUACOES_GUARDADAS = [
  'rascunho',
  'aguardando_aprovacao',
  'ativa',
  'recusada',
  'arquivada',
] as const;
export type SituacaoGuardada = (typeof SITUACOES_GUARDADAS)[number];
export type SituacaoDaFicha = SituacaoGuardada | 'vencida';

const LINK_DO_YOUTUBE =
  /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?|embed\/|shorts\/)|youtu\.be\/)\S+$/i;

/** Só link do YouTube: o aluno vê o vídeo pelo player oficial. */
export function ehLinkDoYoutube(link: string): boolean {
  return LINK_DO_YOUTUBE.test(link.trim());
}

export const ORIGENS_DA_FICHA = ['manual', 'ia', 'modelo'] as const;
export type OrigemDaFicha = (typeof ORIGENS_DA_FICHA)[number];

/** A ficha entra em "Vencem em 30 dias" com a validade em até 30 dias, inclusive. */
export const DIAS_DO_ALERTA_DE_VALIDADE = 30;
/** O chip "Vence em N dias" da tabela aparece até 31 dias (um mês), como em TreinosFichas.html. */
export const DIAS_DO_CHIP_DE_VALIDADE = 31;

export interface ExercicioDaFicha {
  exercicioId: string | null;
  nome: string;
  series: number;
  repeticoes: number;
  /** Nulo é peso do corpo. */
  cargaKg: number | null;
  descansoSegundos: number;
  videoUrl: string | null;
}

export interface TreinoDaFicha {
  /** Letra ou nome da aba: "A", "B", "Full body". */
  nome: string;
  foco: string;
  exercicios: ExercicioDaFicha[];
}

export class TreinoInvalidoError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'TreinoInvalidoError';
  }
}

/** Confere os treinos de uma ficha ou de um modelo; devolve-os com texto aparado. */
export function validarTreinos(treinos: readonly TreinoDaFicha[]): TreinoDaFicha[] {
  if (treinos.length === 0) {
    throw new TreinoInvalidoError('Inclua pelo menos um treino.');
  }
  return treinos.map((treino) => {
    const nome = treino.nome.trim();
    if (!nome) {
      throw new TreinoInvalidoError('Todo treino precisa de um nome.');
    }
    return {
      nome,
      foco: treino.foco.trim(),
      exercicios: treino.exercicios.map((exercicio) => {
        const nomeDoExercicio = exercicio.nome.trim();
        if (!nomeDoExercicio) {
          throw new TreinoInvalidoError(`O treino ${nome} tem um exercício sem nome.`);
        }
        if (exercicio.series < 1 || exercicio.repeticoes < 1) {
          throw new TreinoInvalidoError(
            `${nomeDoExercicio}: séries e repetições precisam ser de pelo menos 1.`,
          );
        }
        if (exercicio.cargaKg !== null && exercicio.cargaKg < 0) {
          throw new TreinoInvalidoError(`${nomeDoExercicio}: a carga não pode ser negativa.`);
        }
        return { ...exercicio, nome: nomeDoExercicio };
      }),
    };
  });
}

export function totalDeExercicios(treinos: readonly TreinoDaFicha[]): number {
  return treinos.reduce((soma, treino) => soma + treino.exercicios.length, 0);
}

/** Dias até a validade (negativo: já venceu). Nulo quando a ficha não tem validade. */
export function diasParaVencer(validaAte: DataCivil | null, hoje: DataCivil): number | null {
  return validaAte === null ? null : diasEntre(hoje, validaAte);
}

interface ValidadeDaFicha {
  situacao: SituacaoGuardada;
  validaAte: DataCivil | null;
}

/** Ativa com a validade antes de hoje vira "Vencida". A validade de hoje ainda vale. */
export function situacaoDaFicha(ficha: ValidadeDaFicha, hoje: DataCivil): SituacaoDaFicha {
  if (ficha.situacao === 'ativa' && ficha.validaAte !== null && ficha.validaAte < hoje) {
    return 'vencida';
  }
  return ficha.situacao;
}

/** Ativa e vencendo em até 30 dias (inclusive); a que vence daqui a 31 dias não entra. */
export function venceEmBreve(ficha: ValidadeDaFicha, hoje: DataCivil): boolean {
  if (situacaoDaFicha(ficha, hoje) !== 'ativa') {
    return false;
  }
  const dias = diasParaVencer(ficha.validaAte, hoje);
  return dias !== null && dias >= 0 && dias <= DIAS_DO_ALERTA_DE_VALIDADE;
}

/** Dias para exibir o chip "Vence em N dias"; nulo fora da janela ou sem ficha ativa. */
export function diasDoChipDeValidade(ficha: ValidadeDaFicha, hoje: DataCivil): number | null {
  if (situacaoDaFicha(ficha, hoje) !== 'ativa') {
    return null;
  }
  const dias = diasParaVencer(ficha.validaAte, hoje);
  return dias !== null && dias >= 0 && dias <= DIAS_DO_CHIP_DE_VALIDADE ? dias : null;
}

// ---------- Execução e evolução de carga ----------

export interface RegistroDeCarga {
  /** Dia do registro. */
  dia: DataCivil;
  cargaKg: number;
}

export interface EvolucaoDeCarga {
  exercicio: string;
  pontos: RegistroDeCarga[];
  /** Último registro menos o primeiro, em kg, e a janela em semanas. */
  variacaoKg: number;
  semanas: number;
  texto: string;
}

const arredondarKg = (valor: number): number => Math.round(valor * 10) / 10;

/** "+8 kg em 6 semanas": último registro menos o primeiro, no intervalo entre eles. */
export function evolucaoDeCarga(
  exercicio: string,
  registros: readonly RegistroDeCarga[],
): EvolucaoDeCarga | null {
  const ordenados = [...registros].sort((a, b) => a.dia.localeCompare(b.dia));
  const primeiro = ordenados[0];
  const ultimo = ordenados.at(-1);
  if (!primeiro || !ultimo || ordenados.length < 2) {
    return null;
  }
  const variacaoKg = arredondarKg(ultimo.cargaKg - primeiro.cargaKg);
  const semanas = Math.max(1, Math.round(diasEntre(primeiro.dia, ultimo.dia) / 7));
  const sinal = variacaoKg > 0 ? '+' : variacaoKg < 0 ? '−' : '';
  const kg = Math.abs(variacaoKg).toLocaleString('pt-BR');
  const texto = `${sinal}${kg} kg em ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`;
  return { exercicio, pontos: ordenados, variacaoKg, semanas, texto };
}

export function validarEsforco(esforco: number): void {
  if (!Number.isInteger(esforco) || esforco < 0 || esforco > 10) {
    throw new TreinoInvalidoError('O esforço vai de 0 a 10.');
  }
}

// ---------- Pedido à IA (sem nome nem CPF) ----------

export interface DadosParaGerar {
  objetivo: string;
  nivel: Nivel;
  frequenciaSemanal: number;
  divisao: Divisao;
  restricoes: string | null;
}

export const FORMATO_DA_FICHA_GERADA = {
  nomeDaFicha: 'texto',
  treinos: 'lista',
} as const;

/**
 * Pedido ao `GeradorIA`: só objetivo, nível, frequência, divisão e restrições. Nunca o aluno (nome,
 * CPF, contato): quem monta o pedido não os recebe.
 */
export function pedidoDeGeracao(dados: DadosParaGerar): {
  finalidade: string;
  instrucao: string;
  dados: Record<string, unknown>;
  formato: Record<string, 'texto' | 'lista'>;
} {
  return {
    finalidade: 'treinos.sugerir-ficha',
    instrucao:
      'Monte um rascunho de ficha de treino de musculação com os treinos da divisão pedida. ' +
      'Responda o nome da ficha e uma lista de treinos no formato "Treino A: foco | exercício 3x10, ...".',
    dados: {
      objetivo: dados.objetivo,
      nivel: dados.nivel,
      frequenciaSemanal: dados.frequenciaSemanal,
      divisao: NOMES_DAS_DIVISOES[dados.divisao],
      restricoes: dados.restricoes ?? 'nenhuma',
    },
    formato: { ...FORMATO_DA_FICHA_GERADA },
  };
}

/** Treinos de partida de cada divisão, para quando o provedor devolve só texto livre (o fake). */
const FOCOS_POR_DIVISAO: Record<Divisao, readonly string[]> = {
  AB: ['Peito, ombros e tríceps', 'Costas, pernas e bíceps'],
  ABC: ['Peito e tríceps', 'Costas e bíceps', 'Pernas e ombros'],
  ABCD: ['Peito e tríceps', 'Costas e bíceps', 'Pernas', 'Ombros e abdômen'],
  full_body: ['Corpo inteiro'],
};

const EXERCICIOS_POR_FOCO: Record<string, readonly string[]> = {
  'Peito, ombros e tríceps': ['Supino reto', 'Desenvolvimento', 'Tríceps corda'],
  'Costas, pernas e bíceps': ['Remada curvada', 'Agachamento livre', 'Rosca direta'],
  'Peito e tríceps': ['Supino reto', 'Supino inclinado', 'Tríceps corda'],
  'Costas e bíceps': ['Puxada frontal', 'Remada curvada', 'Rosca direta'],
  Pernas: ['Agachamento livre', 'Leg press', 'Mesa flexora'],
  'Pernas e ombros': ['Agachamento livre', 'Leg press', 'Desenvolvimento'],
  'Ombros e abdômen': ['Desenvolvimento', 'Elevação lateral', 'Prancha'],
  'Corpo inteiro': ['Agachamento livre', 'Supino reto', 'Remada curvada', 'Prancha'],
};

/**
 * Converte a resposta do provedor em treinos. Cada item de `treinos` pode vir como
 * "Treino A: foco | exercício, exercício"; o que não se entende cai no desenho padrão da divisão.
 * A ficha sempre fica editável: o professor revisa antes de aprovar.
 */
export function treinosDaResposta(
  divisao: Divisao,
  itens: readonly string[],
  restricoes: string | null,
): TreinoDaFicha[] {
  const focos = FOCOS_POR_DIVISAO[divisao];
  const evitaOmbro = /ombro/i.test(restricoes ?? '');
  return focos.map((foco, indice) => {
    const nome = divisao === 'full_body' ? 'Full body' : String.fromCharCode(65 + indice);
    const doProvedor = itens[indice]?.split('|')[1]?.trim();
    const nomes = doProvedor
      ? doProvedor.split(',').map((item) => item.replace(/\d+x\d+/gi, '').trim())
      : [...(EXERCICIOS_POR_FOCO[foco] ?? [])];
    const exercicios = nomes
      .filter((item) => item.length > 0 && !(evitaOmbro && /desenvolvimento/i.test(item)))
      .map((item): ExercicioDaFicha => ({
        exercicioId: null,
        nome: item,
        series: 3,
        repeticoes: 12,
        cargaKg: /prancha/i.test(item) ? null : 0,
        descansoSegundos: 60,
        videoUrl: null,
      }));
    return { nome, foco, exercicios };
  });
}
