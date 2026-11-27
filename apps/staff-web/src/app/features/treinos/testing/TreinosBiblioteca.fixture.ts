import type { Schemas } from '@gymos/api-contracts';
import type { FixtureDeTela } from '../../../../../../e2e/src/fixture-de-tela';
import { respostasDaSessao } from './sessao.fixture';

const exercicio = (
  numero: number,
  nome: string,
  grupoMuscular: Schemas['ExercicioDto']['grupoMuscular'],
  equipamento: string,
): Schemas['ExercicioDto'] => ({
  id: `c6e3a9f2-4d51-4e7a-9a83-00000000000${numero}`,
  nome,
  grupoMuscular,
  equipamento,
  videoUrl: null,
  instrucoes: null,
});

/**
 * Cartões de `TreinosBiblioteca.html`. A tela mostra "Bíceps · Barra W" na Rosca direta, mas o filtro só
 * tem "Braços": o fixture usa "Braços" (inconsistencias.md).
 */
const exercicios: Schemas['ExercicioDto'][] = [
  exercicio(1, 'Supino reto', 'Peito', 'Barra'),
  exercicio(2, 'Agachamento livre', 'Pernas', 'Barra'),
  exercicio(3, 'Remada curvada', 'Costas', 'Barra'),
  exercicio(4, 'Desenvolvimento', 'Ombros', 'Halteres'),
  exercicio(5, 'Rosca direta', 'Braços', 'Barra W'),
  exercicio(6, 'Leg press', 'Pernas', 'Máquina'),
  exercicio(7, 'Prancha', 'Abdômen', 'Peso do corpo'),
  exercicio(8, 'Puxada frontal', 'Costas', 'Polia'),
];

/** O que `TreinosBiblioteca.html` mostra preenchido no painel (o teste digita estes valores). */
export const exercicioDoPainel = {
  nome: 'Supino reto',
  grupoMuscular: 'Peito',
  equipamento: 'Barra',
  video: 'https://youtube.com/watch?v=...',
  instrucoes: 'Costas apoiadas, descer a barra até o peito, subir sem travar o cotovelo.',
} as const;

/** Fixture de `/treinos/biblioteca` (ADR-019): API interceptada, relógio padrão (19/11/2026 09:00). */
export default {
  respostas: [...respostasDaSessao, { caminho: '/treinos/exercicios', corpo: exercicios }],
} satisfies FixtureDeTela;
