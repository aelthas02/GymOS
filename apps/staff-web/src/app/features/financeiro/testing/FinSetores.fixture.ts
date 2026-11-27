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

/** Setor, rótulo, receita bruta, despesas (em reais) e peso. */
const SETORES: ReadonlyArray<readonly [string, string, number, number, number]> = [
  ['musculacao', 'Planos de musculação', 27500, 1700, 50],
  ['aulas', 'Aulas coletivas', 8700, 900, 16],
  ['lutas', 'Lutas', 5100, 500, 9],
  ['loja', 'Loja', 6600, 700, 12],
  ['personal', 'Personal', 4900, 400, 9],
  ['nutricao', 'Nutrição', 2100, 400, 4],
];

/** Fixture de `/financeiro/setores`: os números de `FinSetores.html`. */
export default {
  respostas: [
    ...SESSAO_DA_GERENTE,
    {
      caminho: /^\/financeiro\/visoes\/setores(\?|$)/,
      corpo: visaoFinanceira({
        visao: 'setores',
        periodo: PERIODO_DE_NOVEMBRO,
        indicadores: [
          brl('Receita bruta', 54900, 'Soma dos setores'),
          brl('Despesas por setor', 4600, 'Taxas de R$ 1.980 não alocadas'),
          texto('Maior setor', 'Musculação', '50% da receita bruta'),
          texto('Maior crescimento', 'Personal', '+12% sobre outubro', true),
        ],
        grafico: {
          titulo: 'Receita bruta por setor',
          subtitulo: 'Total R$ 54.900',
          barras: SETORES.map(([, rotulo, receita]) => ({
            rotulo,
            valorCentavos: reais(receita),
          })),
        },
        tabela: {
          titulo: 'Resultado por setor',
          subtitulo: 'Receita bruta menos despesas do setor',
          colunas: [
            coluna('setor', 'Setor', 'texto'),
            coluna('receita', 'Receita bruta', 'brl'),
            coluna('despesas', 'Despesas', 'brl'),
            coluna('resultado', 'Resultado', 'brl'),
            coluna('peso', 'Peso', 'percentual'),
          ],
          linhas: SETORES.map(([id, rotulo, receita, despesas, peso]) =>
            linha(id, {
              setor: rotulo,
              receita: reais(receita),
              despesas: reais(despesas),
              resultado: reais(receita - despesas),
              peso,
            }),
          ),
          total: SETORES.length,
          proximoCursor: null,
        },
      }),
    },
  ],
} satisfies FixtureDeTela;
