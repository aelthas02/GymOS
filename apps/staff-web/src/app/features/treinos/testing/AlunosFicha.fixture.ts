import type { Schemas } from '@gymos/api-contracts';
import type { FixtureDeTela } from '../../../../../../e2e/src/fixture-de-tela';
import { respostasDaSessao } from './sessao.fixture';

export const ID_DO_ALUNO = '9c2e5a10-4d7b-4f31-8a52-000000000101';
const ID_DO_PROFESSOR = '3b8d1e70-52a4-4c0e-9d11-0000000000d1';

const aluno: Schemas['AlunoDto'] = {
  id: ID_DO_ALUNO,
  nome: 'Paulo Reis',
  cpf: '12345678909',
  telefone: '11999990000',
  email: 'paulo.reis@email.com',
  dataNascimento: '1990-04-12',
  meta: 'hipertrofia',
  restricoes: null,
  leadId: null,
  professorId: ID_DO_PROFESSOR,
  unidadeId: '1e4a6b20-8c3d-4a95-b7f0-0000000000a1',
  criadoEm: '2026-03-10T12:00:00.000Z',
};

const exercicio = (
  nome: string,
  series: number,
  repeticoes: number,
  cargaKg: number | null,
  descansoSegundos: number,
  videoUrl: string | null = null,
): Schemas['ExercicioDaFichaDto'] => ({
  exercicioId: null,
  nome,
  series,
  repeticoes,
  cargaKg,
  descansoSegundos,
  videoUrl,
});

/** Ficha de `AlunosFicha.html`: rascunho da IA do Paulo, treino A com os seis exercícios da tela. */
const ficha: Schemas['FichaDto'] = {
  id: 'a4c1e7d0-2b3f-4c58-9e61-000000000101',
  alunoId: ID_DO_ALUNO,
  alunoNome: 'Paulo Reis',
  nome: 'Hipertrofia A/B/C',
  objetivo: 'Hipertrofia',
  nivel: 'intermediario',
  frequenciaSemanal: 4,
  divisao: 'ABC',
  validaAte: '2027-01-15',
  restricoes: 'Lesão leve no ombro direito: evitar desenvolvimento acima da cabeça.',
  professorId: ID_DO_PROFESSOR,
  professorNome: 'Diego Martins',
  situacao: 'aguardando_aprovacao',
  origem: 'ia',
  aprovadaPor: null,
  aprovadaEm: null,
  treinos: [
    {
      nome: 'A',
      foco: 'Peito e tríceps',
      exercicios: [
        exercicio('Supino reto', 4, 10, 40, 60, 'https://youtu.be/exemplo'),
        exercicio('Supino inclinado', 3, 12, 30, 60),
        exercicio('Crucifixo', 3, 12, 14, 45),
        exercicio('Tríceps testa', 3, 12, 20, 45),
        exercicio('Tríceps corda', 3, 15, 25, 45),
        exercicio('Mergulho', 3, 10, null, 60),
      ],
    },
    {
      nome: 'B',
      foco: 'Costas e bíceps',
      exercicios: [
        exercicio('Puxada frontal', 4, 10, 45, 60),
        exercicio('Rosca direta', 3, 12, 20, 45),
      ],
    },
    {
      nome: 'C',
      foco: 'Pernas e ombros',
      exercicios: [
        exercicio('Agachamento livre', 4, 10, 60, 90),
        exercicio('Leg press', 3, 12, 120, 60),
      ],
    },
  ],
};

const biblioteca: Schemas['ExercicioDto'][] = [
  {
    id: 'c6e3a9f2-4d51-4e7a-9a83-000000000001',
    nome: 'Supino reto',
    grupoMuscular: 'Peito',
    equipamento: 'Barra',
    videoUrl: null,
    instrucoes: 'Peitoral e tríceps.',
  },
];

/** Fixture de `/alunos/:id/ficha-de-treino` (ADR-019): API interceptada, relógio padrão (19/11/2026 09:00). */
export default {
  respostas: [
    ...respostasDaSessao,
    { caminho: `/alunos/${ID_DO_ALUNO}`, corpo: aluno },
    { caminho: `/treinos/alunos/${ID_DO_ALUNO}/ficha`, corpo: ficha },
    { caminho: '/treinos/exercicios', corpo: biblioteca },
  ],
} satisfies FixtureDeTela;
