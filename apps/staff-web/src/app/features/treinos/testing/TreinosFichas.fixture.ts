import type { Schemas } from '@gymos/api-contracts';
import type { FixtureDeTela } from '../../../../../../e2e/src/fixture-de-tela';
import { respostasDaSessao } from './sessao.fixture';

const linha = (
  numero: number,
  dados: Pick<
    Schemas['LinhaDeFichaDto'],
    'alunoNome' | 'nome' | 'professorNome' | 'validaAte' | 'situacao' | 'venceEmDias'
  >,
): Schemas['LinhaDeFichaDto'] => ({
  fichaId: `a4c1e7d0-2b3f-4c58-9e61-00000000000${numero}`,
  alunoId: `9c2e5a10-4d7b-4f31-8a52-00000000010${numero}`,
  ...dados,
});

/** Linhas de `TreinosFichas.html`: Marina é "Vence em 31 dias" (fora do KPI de 30 dias, inconsistencias.md). */
const itens: Schemas['LinhaDeFichaDto'][] = [
  linha(1, {
    alunoNome: 'Paulo Reis',
    nome: 'Hipertrofia A/B/C',
    professorNome: 'Diego Martins',
    validaAte: '2027-01-15',
    situacao: 'ativa',
    venceEmDias: null,
  }),
  linha(2, {
    alunoNome: 'Marina Costa',
    nome: 'Emagrecimento',
    professorNome: 'Lia Fernandes',
    validaAte: '2026-12-20',
    situacao: 'ativa',
    venceEmDias: 31,
  }),
  linha(3, {
    alunoNome: 'Pedro Almeida',
    nome: 'Força A/B',
    professorNome: 'Diego Martins',
    validaAte: null,
    situacao: 'aguardando_aprovacao',
    venceEmDias: null,
  }),
  linha(4, {
    alunoNome: 'Larissa Nunes',
    nome: 'Funcional',
    professorNome: 'Camila Rocha',
    validaAte: '2027-03-02',
    situacao: 'ativa',
    venceEmDias: null,
  }),
  linha(5, {
    alunoNome: 'Bruno Lima',
    nome: 'Hipertrofia A/B/C',
    professorNome: 'Diego Martins',
    validaAte: null,
    situacao: 'aguardando_aprovacao',
    venceEmDias: null,
  }),
];

const painel: Schemas['PainelDeFichasDto'] = {
  kpis: { ativas: 310, aguardandoAprovacao: 2, vencemEm30Dias: 14, semFicha: 2 },
  itens,
  // A tabela da tela lista 5 fichas (sem paginação); o subtítulo traz os 312 alunos com ficha.
  total: 5,
  pagina: 1,
  limite: 20,
  alunosComFicha: 312,
  sugeridas: [
    {
      fichaId: 'a4c1e7d0-2b3f-4c58-9e61-000000000003',
      alunoId: '9c2e5a10-4d7b-4f31-8a52-000000000103',
      alunoNome: 'Pedro Almeida',
      resumo: 'Força A/B, 4 dias, sem restrição',
    },
    {
      fichaId: 'a4c1e7d0-2b3f-4c58-9e61-000000000005',
      alunoId: '9c2e5a10-4d7b-4f31-8a52-000000000105',
      alunoNome: 'Bruno Lima',
      resumo: 'Hipertrofia A/B/C, 5 dias, joelho sensível',
    },
  ],
};

/** Fixture de `/treinos/fichas` (ADR-019): API interceptada, relógio padrão (19/11/2026 09:00). */
export default {
  respostas: [
    ...respostasDaSessao,
    { caminho: '/treinos/fichas?pagina=1&limite=20', corpo: painel },
  ],
} satisfies FixtureDeTela;
