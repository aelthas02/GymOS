import type { Schemas } from '@gymos/api-contracts';
import type { FixtureDeTela } from '../../../../../../e2e/src/fixture-de-tela';
import { OPCOES_DOS_FILTROS, PERIODO_DE_NOVEMBRO, reais } from './financeiro-base.fixture';
import { SESSAO_DA_GERENTE } from './sessao-da-gerente.fixture';

/** Mês, rótulo, bruta, taxas, despesas, líquida (em reais), adesões ativas e novas adesões. */
const MESES: ReadonlyArray<
  readonly [string, string, number, number, number, number, number, number]
> = [
  ['2026-06', 'Jun', 44000, 1400, 3200, 40000, 282, 20],
  ['2026-07', 'Jul', 46500, 1553, 3900, 41300, 288, 14],
  ['2026-08', 'Ago', 48200, 1630, 3725, 43000, 294, 26],
  ['2026-09', 'Set', 50100, 1736, 3745, 44800, 300, 20],
  ['2026-10', 'Out', 51800, 1858, 4050, 46100, 306, 26],
  ['2026-11', 'Nov', 54900, 1980, 4600, 48320, 312, 20],
];

/** Os seis meses de `Financeiro.html` (Jun a Nov), com as séries dos gráficos pequenos. */
const SERIE: Schemas['PontoDaSerieDto'][] = MESES.map(
  ([mes, rotulo, bruta, taxas, despesas, liquida, ativas, novas]) => ({
    mes,
    rotulo,
    brutaCentavos: reais(bruta),
    taxasCentavos: reais(taxas),
    despesasCentavos: reais(despesas),
    liquidaCentavos: reais(liquida),
    adesoesAtivas: ativas,
    novasAdesoes: novas,
  }),
);

const geral: Schemas['FinanceiroGeralDto'] = {
  periodo: PERIODO_DE_NOVEMBRO,
  receitaLiquida: {
    centavos: reais(48320),
    anteriorCentavos: reais(46100),
    variacaoPontosBase: 482,
  },
  brutaCentavos: reais(54900),
  taxasCentavos: reais(1980),
  despesasCentavos: reais(4600),
  adesoesAtivas: 312,
  novasAdesoes: 20,
  cancelamentos: 12,
  inadimplencia: { emAtraso: 12, ativos: 312, pontosBase: 385 },
  porForma: [
    { forma: 'pix', centavos: reais(29646), percentual: 54 },
    { forma: 'cartao', centavos: reais(19764), percentual: 36 },
    { forma: 'boleto', centavos: reais(5490), percentual: 10 },
  ],
  despesasPorCategoria: [
    { categoria: 'folha', rotulo: 'Folha', centavos: reais(2400) },
    { categoria: 'aluguel', rotulo: 'Aluguel', centavos: reais(1200) },
    { categoria: 'contas', rotulo: 'Contas', centavos: reais(610) },
    { categoria: 'outros', rotulo: 'Outros', centavos: reais(390) },
  ],
  serieMensal: SERIE,
};

/** Fixture de `/financeiro` (ADR-019): os números de `Financeiro.html`, com a gerente logada. */
export default {
  respostas: [
    ...SESSAO_DA_GERENTE,
    { caminho: /^\/financeiro\/geral(\?|$)/, corpo: geral },
    { caminho: '/financeiro/filtros', corpo: OPCOES_DOS_FILTROS },
  ],
} satisfies FixtureDeTela;
