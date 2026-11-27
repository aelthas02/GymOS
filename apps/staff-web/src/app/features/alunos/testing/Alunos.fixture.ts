import type { Schemas } from '@gymos/api-contracts';
import type { FixtureDeTela } from '../../../../../../e2e/src/fixture-de-tela';
import { planosDoFixture, respostasDaSessao } from './sessao.fixture';

type Item = Schemas['ItemDaListaDeAlunosDto'];

const idDoAluno = (numero: number): string => `9c2e5a10-4d7b-4f31-8a52-00000000000${numero}`;

const plano = (nome: string): Item['plano'] => {
  const encontrado = planosDoFixture.find((item) => item.nome === nome);
  return encontrado ? { id: encontrado.id, nome } : null;
};

const EM_DIA = { estadoDoContrato: 'ativo', diasDeAtraso: 0, venceEmDias: null } as const;

/** Linhas de `Alunos.html`, com os nomes e as situações exatos da tela. */
export const alunosDaLista: Item[] = [
  {
    id: idDoAluno(1),
    nome: 'Rafael Souza',
    plano: plano('Mensal'),
    situacao: 'em_atraso',
    estadoDoContrato: 'tolerancia',
    diasDeAtraso: 6,
    venceEmDias: null,
  },
  {
    id: idDoAluno(2),
    nome: 'Camila Duarte',
    plano: plano('Trimestral'),
    situacao: 'a_vencer',
    estadoDoContrato: 'ativo',
    diasDeAtraso: 0,
    venceEmDias: 3,
  },
  { id: idDoAluno(3), nome: 'Pedro Almeida', plano: plano('Anual'), situacao: 'em_dia', ...EM_DIA },
  {
    id: idDoAluno(4),
    nome: 'Juliana Prado',
    plano: plano('Mensal'),
    situacao: 'em_atraso',
    estadoDoContrato: 'tolerancia',
    diasDeAtraso: 2,
    venceEmDias: null,
  },
  {
    id: idDoAluno(5),
    nome: 'Bruno Lima',
    plano: plano('Trimestral'),
    situacao: 'em_dia',
    ...EM_DIA,
  },
  {
    id: idDoAluno(6),
    nome: 'Marina Costa',
    plano: plano('Semestral'),
    situacao: 'em_dia',
    ...EM_DIA,
  },
  { id: idDoAluno(7), nome: 'Paulo Reis', plano: plano('Mensal'), situacao: 'em_dia', ...EM_DIA },
  {
    id: idDoAluno(8),
    nome: 'Larissa Nunes',
    plano: plano('Anual'),
    situacao: 'em_dia',
    ...EM_DIA,
  },
];

/** Contadores de `Alunos.html` (o rodapé mostra "de 312 alunos"). */
export const contadoresDaLista: Schemas['ContadoresDeAlunosDto'] = {
  todos: 312,
  em_dia: 289,
  a_vencer: 11,
  em_atraso: 12,
};

const pagina: Schemas['PaginaDeAlunosDto'] = {
  itens: alunosDaLista,
  contadores: contadoresDaLista,
  proximoCursor: 'cursor-da-pagina-2',
};

/** Fixture de `/alunos` (ADR-019): a regressão visual roda com a API interceptada. Relógio padrão. */
export default {
  respostas: [
    ...respostasDaSessao,
    { caminho: /^\/alunos\?/, corpo: pagina },
    { caminho: '/planos', corpo: planosDoFixture },
  ],
} satisfies FixtureDeTela;
