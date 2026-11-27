import type { FixtureDeTela } from '../../../../../../e2e/src/fixture-de-tela';
import {
  brl,
  coluna,
  linha,
  PERIODO_DE_NOVEMBRO,
  reais,
  texto,
  visaoFinanceira,
} from './financeiro-base.fixture';
import { SESSAO_DA_GERENTE } from './sessao-da-gerente.fixture';

/** Nome, cargo, custo mensal e receita gerada (em reais); sem receita direta é `null`. */
const EQUIPE: ReadonlyArray<readonly [string, string, number, number | null]> = [
  ['Diego', 'Professor', 450, 3000],
  ['Lia', 'Professora', 400, 1400],
  ['Camila', 'Professora', 400, 1800],
  ['Renata', 'Nutricionista', 350, 2100],
  ['Carla', 'Recepção', 300, null],
  ['João', 'Recepção', 250, null],
  ['Marcos', 'Manutenção', 150, null],
  ['Neide', 'Limpeza', 100, null],
];

/** Fixture de `/financeiro/funcionarios`: os números de `FinFuncionarios.html`. */
export default {
  respostas: [
    ...SESSAO_DA_GERENTE,
    {
      caminho: /^\/financeiro\/visoes\/funcionarios(\?|$)/,
      corpo: visaoFinanceira({
        visao: 'funcionarios',
        periodo: PERIODO_DE_NOVEMBRO,
        indicadores: [
          brl('Folha do mês', 2400, '8 funcionários'),
          brl('Receita gerada', 8300, 'Aulas, personal e nutrição'),
          texto('Maior receita', 'Diego', 'R$ 3.000'),
          brl('Custo médio', 300, 'Por funcionário'),
        ],
        grafico: {
          titulo: 'Receita gerada por funcionário',
          subtitulo: 'Apenas quem atende alunos',
          barras: EQUIPE.flatMap(([nome, , , receita]) =>
            receita === null ? [] : [{ rotulo: nome, valorCentavos: reais(receita) }],
          ),
        },
        tabela: {
          titulo: 'Equipe',
          subtitulo: 'Custo mensal e receita atribuída',
          colunas: [
            coluna('funcionario', 'Funcionário', 'texto'),
            coluna('cargo', 'Cargo', 'texto'),
            coluna('custo', 'Custo', 'brl'),
            coluna('receita', 'Receita gerada', 'brl', 'sem receita direta'),
          ],
          linhas: EQUIPE.map(([nome, cargo, custo, receita]) =>
            linha(nome.toLowerCase(), {
              funcionario: nome,
              cargo,
              custo: reais(custo),
              receita: receita === null ? null : reais(receita),
            }),
          ),
          total: EQUIPE.length,
          proximoCursor: null,
        },
      }),
    },
  ],
} satisfies FixtureDeTela;
