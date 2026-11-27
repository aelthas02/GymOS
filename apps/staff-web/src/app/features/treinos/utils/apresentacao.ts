import { HttpErrorResponse } from '@angular/common/http';
import type { BadgeVariant, SelectOption } from '@gymos/ui';
import type {
  Divisao,
  ExercicioDaFicha,
  ExercicioEditavel,
  Ficha,
  LinhaDeFicha,
  Nivel,
  TreinoDaFicha,
  TreinoEditavel,
} from '../models/treinos';

export const DIVISOES: readonly { valor: Divisao; rotulo: string }[] = [
  { valor: 'AB', rotulo: 'AB' },
  { valor: 'ABC', rotulo: 'ABC' },
  { valor: 'ABCD', rotulo: 'ABCD' },
  { valor: 'full_body', rotulo: 'Full body' },
];

export const NIVEIS: readonly SelectOption[] = [
  { value: 'iniciante', label: 'Iniciante' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'avancado', label: 'Avançado' },
];

export const FREQUENCIAS: readonly SelectOption[] = [1, 2, 3, 4, 5, 6, 7].map((dias) => ({
  value: String(dias),
  label: dias === 1 ? '1 vez' : `${dias} vezes`,
}));

export const GRUPOS_MUSCULARES = ['Peito', 'Costas', 'Pernas', 'Ombros', 'Braços', 'Abdômen'];

const MENSAGEM_PADRAO = 'Não foi possível concluir. Tente de novo.';

/** Mensagem que a API devolveu (`{ message }` do Nest, texto ou lista); senão, o texto padrão. */
export function mensagemDaApi(erro: unknown, padrao: string = MENSAGEM_PADRAO): string {
  if (!(erro instanceof HttpErrorResponse)) {
    return padrao;
  }
  const mensagem: unknown = (erro.error as { message?: unknown } | null)?.message;
  if (typeof mensagem === 'string' && mensagem !== '') {
    return mensagem;
  }
  if (Array.isArray(mensagem) && mensagem.length > 0) {
    return mensagem.join(' ');
  }
  return padrao;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const BR = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** `yyyy-MM-dd` para `dd/MM/yyyy`; vazio vira "—". */
export function dataBr(iso: string | null | undefined): string {
  return iso && ISO.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
}

/** `dd/MM/yyyy` para `yyyy-MM-dd`; vazio ou inválido vira `null`. */
export function dataParaIso(texto: string): string | null {
  const br = BR.exec(texto.trim());
  return br ? `${br[3]}-${br[2]}-${br[1]}` : null;
}

export function primeiroNome(nome: string | null): string {
  return nome ? (nome.split(' ')[0] ?? nome) : '—';
}

/** Texto e cor do chip de situação da tabela de fichas (`TreinosFichas.html`). */
export function situacaoDaLinha(linha: LinhaDeFicha): { texto: string; variante: BadgeVariant } {
  switch (linha.situacao) {
    case 'ativa':
      return linha.venceEmDias === null
        ? { texto: 'Ativa', variante: 'ok' }
        : { texto: `Vence em ${linha.venceEmDias} dias`, variante: 'soon' };
    case 'vencida':
      return { texto: 'Vencida', variante: 'late' };
    case 'aguardando_aprovacao':
      return { texto: 'Aguardando aprovação', variante: 'off' };
    default:
      return { texto: 'Rascunho', variante: 'off' };
  }
}

// ---------- Editor ----------

export const rotuloDoTreino = (treino: Pick<TreinoEditavel, 'nome' | 'foco'>): string => {
  const nome = treino.nome.length === 1 ? `Treino ${treino.nome}` : treino.nome;
  return treino.foco ? `${nome}: ${treino.foco}` : nome;
};

export const textoDoDescanso = (segundos: number): string => `${segundos} s`;

export function editavelDe(exercicio: ExercicioDaFicha): ExercicioEditavel {
  return {
    exercicioId: exercicio.exercicioId,
    nome: exercicio.nome,
    series: String(exercicio.series),
    repeticoes: String(exercicio.repeticoes),
    carga: exercicio.cargaKg === null ? 'Corpo' : String(exercicio.cargaKg).replace('.', ','),
    descanso: textoDoDescanso(exercicio.descansoSegundos),
    videoUrl: exercicio.videoUrl ?? '',
  };
}

export const treinosEditaveis = (treinos: readonly TreinoDaFicha[]): TreinoEditavel[] =>
  treinos.map((treino) => ({
    nome: treino.nome,
    foco: treino.foco,
    exercicios: treino.exercicios.map(editavelDe),
  }));

const inteiro = (texto: string, padrao: number): number => {
  const valor = Number.parseInt(texto.replace(/\D/g, ''), 10);
  return Number.isNaN(valor) ? padrao : valor;
};

export function exercicioParaApi(exercicio: ExercicioEditavel): ExercicioDaFicha {
  const carga = exercicio.carga.trim().replace(',', '.');
  const numero = Number.parseFloat(carga);
  return {
    exercicioId: exercicio.exercicioId,
    nome: exercicio.nome.trim(),
    series: inteiro(exercicio.series, 3),
    repeticoes: inteiro(exercicio.repeticoes, 10),
    cargaKg: carga === '' || Number.isNaN(numero) ? null : numero,
    descansoSegundos: inteiro(exercicio.descanso, 60),
    videoUrl: exercicio.videoUrl.trim() || null,
  };
}

export const treinosParaApi = (treinos: readonly TreinoEditavel[]): TreinoDaFicha[] =>
  treinos.map((treino) => ({
    nome: treino.nome,
    foco: treino.foco,
    exercicios: treino.exercicios.map(exercicioParaApi),
  }));

export const exercicioEmBranco = (): ExercicioEditavel => ({
  exercicioId: null,
  nome: '',
  series: '3',
  repeticoes: '10',
  carga: '',
  descanso: '60 s',
  videoUrl: '',
});

export const proximaLetra = (treinos: readonly TreinoEditavel[]): string =>
  String.fromCharCode(65 + treinos.length);

export function fichaVazia(): Pick<
  Ficha,
  'objetivo' | 'nivel' | 'frequenciaSemanal' | 'divisao' | 'restricoes' | 'validaAte'
> {
  return {
    objetivo: '',
    nivel: 'intermediario' as Nivel,
    frequenciaSemanal: 3,
    divisao: 'ABC' as Divisao,
    restricoes: null,
    validaAte: null,
  };
}
