import type { FixtureDeTela } from '../../../../../../e2e/src/fixture-de-tela';
import {
  brl,
  coluna,
  inteiro,
  linha,
  PERIODO_DE_NOVEMBRO,
  reais,
  visaoFinanceira,
} from './financeiro-base.fixture';
import { SESSAO_DA_GERENTE } from './sessao-da-gerente.fixture';

type Situacao = 'em_dia' | 'em_atraso' | 'a_vencer';

/** Aluno, plano, parcela (em centavos), texto da situação e o tom dela. */
const ALUNOS: ReadonlyArray<readonly [string, string, number, string, Situacao]> = [
  ['Pedro Almeida', 'Anual', 10533, 'Em dia', 'em_dia'],
  ['Paulo Reis', 'Mensal', 11900, 'Em dia', 'em_dia'],
  ['Marina Costa', 'Semestral', 8900, 'Em dia', 'em_dia'],
  ['Juliana Prado', 'Mensal', 11900, 'Atraso 2 dias', 'em_atraso'],
  ['Rafael Souza', 'Mensal', 11900, 'Atraso 6 dias', 'em_atraso'],
  ['Camila Duarte', 'Trimestral', 9900, 'Vence em 3 dias', 'a_vencer'],
];

/** Fixture de `/financeiro/alunos`: os números de `FinAlunos.html`. */
export default {
  respostas: [
    ...SESSAO_DA_GERENTE,
    {
      caminho: /^\/financeiro\/visoes\/alunos(\?|$)/,
      corpo: visaoFinanceira({
        visao: 'alunos',
        periodo: PERIODO_DE_NOVEMBRO,
        indicadores: [
          brl('Ticket médio', 176, 'Por aluno ativo'),
          inteiro('Em dia', 289, '92,6% dos alunos'),
          inteiro('Em atraso', 12, 'R$ 1.428 a receber'),
          inteiro('A vencer', 11, 'Próximos 7 dias'),
        ],
        grafico: {
          titulo: 'Receita por tipo de plano',
          subtitulo: 'Alunos ativos × valor',
          barras: [
            { rotulo: 'Mensal', valorCentavos: reais(16898) },
            { rotulo: 'Trimestral', valorCentavos: reais(7722) },
            { rotulo: 'Semestral', valorCentavos: reais(4094) },
            { rotulo: 'Anual', valorCentavos: reais(3990) },
          ],
        },
        tabela: {
          titulo: 'Alunos e cobranças',
          subtitulo: 'Mostrando 6 de 312',
          colunas: [
            coluna('aluno', 'Aluno', 'texto'),
            coluna('plano', 'Plano', 'texto'),
            coluna('parcela', 'Parcela', 'brl', '—'),
            coluna('situacao', 'Situação', 'situacao'),
          ],
          linhas: ALUNOS.map(([nome, plano, parcela, textoDaSituacao, situacao], indice) => {
            const id = `00000000-0000-4000-8000-00000000a00${indice}`;
            return linha(
              id,
              { aluno: nome, plano, parcela, situacao: textoDaSituacao },
              { situacao, link: `/alunos/${id}` },
            );
          }),
          total: 312,
          proximoCursor: null,
        },
      }),
    },
  ],
} satisfies FixtureDeTela;
