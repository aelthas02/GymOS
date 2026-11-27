import type { FixtureDeTela } from '../../../../../../e2e/src/fixture-de-tela';
import {
  brl,
  coluna,
  linha,
  percentualDe,
  PERIODO_DE_NOVEMBRO,
  reais,
  texto,
  visaoFinanceira,
} from './financeiro-base.fixture';
import { SESSAO_DA_GERENTE } from './sessao-da-gerente.fixture';

/** Aula, tipo, receita (em reais) e ocupação em %; sem dado é `null`. */
const AULAS: ReadonlyArray<readonly [string, string, number, number | null]> = [
  ['CrossFit', 'Coletiva', 3000, 82],
  ['Spinning', 'Coletiva', 2500, 78],
  ['Zumba', 'Coletiva', 1800, 64],
  ['Pilates', 'Coletiva', 1400, 71],
  ['Jiu-Jitsu', 'Luta', 3200, 58],
  ['Muay thai', 'Luta', 1900, null],
];

/** Fixture de `/financeiro/aulas`: os números de `FinAulas.html`. */
export default {
  respostas: [
    ...SESSAO_DA_GERENTE,
    {
      caminho: /^\/financeiro\/visoes\/aulas(\?|$)/,
      corpo: visaoFinanceira({
        visao: 'aulas',
        periodo: PERIODO_DE_NOVEMBRO,
        indicadores: [
          brl('Aulas coletivas', 8700, 'CrossFit, Spinning, Zumba, Pilates'),
          brl('Lutas', 5100, 'Jiu-Jitsu e Muay thai'),
          percentualDe('Ocupação média', 71, 'Das vagas oferecidas'),
          texto('Melhor aula', 'CrossFit', '82% de ocupação'),
        ],
        grafico: {
          titulo: 'Receita por aula',
          subtitulo: 'Total R$ 13.800',
          barras: AULAS.map(([rotulo, , receita]) => ({ rotulo, valorCentavos: reais(receita) })),
        },
        tabela: {
          titulo: 'Aulas',
          subtitulo: 'Receita do mês e ocupação média',
          colunas: [
            coluna('aula', 'Aula', 'texto'),
            coluna('tipo', 'Tipo', 'texto'),
            coluna('receita', 'Receita', 'brl'),
            coluna('ocupacao', 'Ocupação', 'percentual', 'sem dado'),
          ],
          linhas: AULAS.map(([aula, tipo, receita, ocupacao]) =>
            linha(aula.toLowerCase(), { aula, tipo, receita: reais(receita), ocupacao }),
          ),
          total: AULAS.length,
          proximoCursor: null,
        },
      }),
    },
  ],
} satisfies FixtureDeTela;
