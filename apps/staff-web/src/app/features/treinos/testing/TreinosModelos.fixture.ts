import type { Schemas } from '@gymos/api-contracts';
import type { FixtureDeTela } from '../../../../../../e2e/src/fixture-de-tela';
import { respostasDaSessao } from './sessao.fixture';

const modelo = (
  numero: number,
  nome: string,
  diasPorSemana: number,
  totalDeExercicios: number,
  divisao: Schemas['ModeloDto']['divisao'],
): Schemas['ModeloDto'] => ({
  id: `b5d2f8e1-3c40-4d69-8f72-00000000000${numero}`,
  nome,
  divisao,
  diasPorSemana,
  totalDeExercicios,
  treinos: [],
});

/** Cartões de `TreinosModelos.html`: dias por semana e total de exercícios iguais aos da tela. */
const modelos: Schemas['ModeloDto'][] = [
  modelo(1, 'Hipertrofia A/B/C', 5, 18, 'ABC'),
  modelo(2, 'Emagrecimento', 4, 14, 'ABCD'),
  modelo(3, 'Iniciante full body', 3, 10, 'full_body'),
  modelo(4, 'Força A/B', 4, 12, 'AB'),
  modelo(5, 'Funcional', 3, 12, 'ABC'),
  modelo(6, 'Reabilitação ombro', 3, 9, 'ABC'),
];

/** Fixture de `/treinos/modelos` (ADR-019): API interceptada, relógio padrão (19/11/2026 09:00). */
export default {
  respostas: [...respostasDaSessao, { caminho: '/treinos/modelos', corpo: modelos }],
} satisfies FixtureDeTela;
