import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Card } from '../lib/card/card';
import { AreaChart } from '../lib/graficos/area-chart';
import { BarChart } from '../lib/graficos/bar-chart';
import { Donut } from '../lib/graficos/donut';
import { Heatmap } from '../lib/graficos/heatmap';
import { HorizontalBars } from '../lib/graficos/horizontal-bars';
import { LineChart } from '../lib/graficos/line-chart';
import { ProgressBar } from '../lib/graficos/progress-bar';
import { Sparkline } from '../lib/graficos/sparkline';
import { StackedBarChart } from '../lib/graficos/stacked-bar-chart';
import { WeekDots } from '../lib/graficos/week-dots';

const meta: Meta<BarChart> = {
  title: 'Componentes/Gráficos',
  component: BarChart,
  decorators: [
    moduleMetadata({
      imports: [
        Card,
        BarChart,
        StackedBarChart,
        HorizontalBars,
        Donut,
        LineChart,
        AreaChart,
        Sparkline,
        Heatmap,
        ProgressBar,
        WeekDots,
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<BarChart>;

// As telas injetam os pipes do T08; aqui o formato é o do protótipo.
const reais = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const real = (valor: number) => reais.format(valor);
const percentual = (valor: number) => `${valor.toString().replace('.', ',')}%`;
const parte = (fracao: number) => `${Math.round(fracao * 100)}%`;

const meses = ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov'];
const liquidaPorMes = [39800, 41200, 43100, 44900, 46100, 48320].map((valor, i) => ({
  rotulo: meses[i],
  valor,
}));

const moldura = (titulo: string, corpo: string, largura = 420) => `
  <div style="padding:16px;max-width:${largura}px">
    <ui-card>
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:700">${titulo}</h2>
      ${corpo}
    </ui-card>
  </div>`;

/** "Frequência por horário", de Main.html: pico de 112 check-ins às 18h. */
export const CheckInsPorHora: Story = {
  name: 'Barras · check-ins por hora',
  render: () => ({
    props: {
      dados: [
        1, 1, 1, 1, 2, 12, 48, 70, 55, 40, 44, 38, 52, 35, 30, 36, 50, 84, 112, 96, 62, 30, 10, 2,
      ].map((valor, hora) => ({ rotulo: `${hora}h`, valor })),
    },
    template: moldura(
      'Frequência por horário',
      `<ui-bar-chart [dados]="dados" resumo="Check-ins por hora, média dos últimos 30 dias" colunaRotulo="Hora" colunaValor="Check-ins" />`,
      560,
    ),
  }),
};

/** "Frequência por dia da semana", de Relatorios.html: pico de 240 na quinta. */
export const FrequenciaPorDia: Story = {
  name: 'Barras · frequência por dia da semana',
  render: () => ({
    props: {
      dados: [211, 230, 226, 240, 204, 120, 60].map((valor, i) => ({
        rotulo: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][i],
        valor,
      })),
    },
    template: moldura(
      'Frequência por dia da semana',
      `<ui-bar-chart [dados]="dados" resumo="Média de check-ins por dia da semana" colunaRotulo="Dia" colunaValor="Check-ins" />`,
    ),
  }),
};

export const SemDados: Story = {
  name: 'Barras · estado vazio',
  render: () => ({
    template: moldura(
      'Frequência por horário',
      `<ui-bar-chart [dados]="[]" mensagemVazia="Nenhum check-in neste período" />`,
    ),
  }),
};

/** "Adesões e cancelamentos", de Relatorios.html. */
export const AdesoesECancelamentos: Story = {
  name: 'Barras empilhadas · adesões e cancelamentos',
  render: () => ({
    props: {
      dados: [
        [20, 12],
        [19, 11],
        [21, 13],
        [20, 12],
        [21, 13],
        [20, 12],
      ].map(([positivo, negativo], i) => ({ rotulo: meses[i], positivo, negativo })),
    },
    template: moldura(
      'Adesões e cancelamentos',
      `<ui-stacked-bar-chart [dados]="dados" rotuloPositivo="Adesões" rotuloNegativo="Cancelamentos" resumo="Adesões e cancelamentos por mês, saldo de 8 alunos" />`,
    ),
  }),
};

/** "Despesas por categoria", de Financeiro.html (total R$ 4.600). */
export const DespesasPorCategoria: Story = {
  name: 'Barras horizontais · despesas por categoria',
  render: () => ({
    props: {
      real,
      dados: [
        { rotulo: 'Folha', valor: 2400 },
        { rotulo: 'Aluguel', valor: 1200 },
        { rotulo: 'Contas', valor: 600 },
        { rotulo: 'Outros', valor: 400 },
      ],
    },
    template: moldura(
      'Despesas por categoria',
      `<ui-horizontal-bars [dados]="dados" [formatar]="real" resumo="Despesas por categoria, total de R$ 4.600" />`,
    ),
  }),
};

/** "Ocupação das aulas", de Relatorios.html. */
export const OcupacaoDasAulas: Story = {
  name: 'Barras horizontais · ocupação das aulas',
  render: () => ({
    props: {
      percentual,
      dados: [
        { rotulo: 'CrossFit', valor: 82 },
        { rotulo: 'Spinning', valor: 78 },
        { rotulo: 'Pilates', valor: 71 },
        { rotulo: 'Zumba', valor: 64 },
        { rotulo: 'Jiu-Jitsu', valor: 58 },
      ],
    },
    template: moldura(
      'Ocupação das aulas',
      `<ui-horizontal-bars [dados]="dados" [formatar]="percentual" resumo="Ocupação média das aulas na semana" />`,
    ),
  }),
};

/** "Receita por forma de pagamento", de Financeiro.html (54%, 36% e 10% da receita bruta de novembro). */
export const FormaDePagamento: Story = {
  name: 'Donut · receita por forma de pagamento',
  render: () => ({
    props: {
      real,
      parte,
      dados: [
        { rotulo: 'PIX', valor: 29646 },
        { rotulo: 'Cartão', valor: 19764 },
        { rotulo: 'Boleto', valor: 5490 },
      ],
    },
    template: moldura(
      'Receita por forma de pagamento',
      `<ui-donut [dados]="dados" [formatar]="real" [formatarParte]="parte" resumo="Receita por forma de pagamento" />`,
    ),
  }),
};

/** "Receita por origem", de Relatorios.html. */
export const ReceitaPorOrigem: Story = {
  name: 'Donut · receita por origem',
  render: () => ({
    props: {
      real,
      parte,
      dados: [
        { rotulo: 'Planos', valor: 38979 },
        { rotulo: 'Loja', valor: 6588 },
        { rotulo: 'Personal', valor: 4941 },
        { rotulo: 'Nutrição', valor: 2745 },
        { rotulo: 'Aulas avulsas', valor: 1647 },
      ],
    },
    template: moldura(
      'Receita por origem',
      `<ui-donut [dados]="dados" [formatar]="real" [formatarParte]="parte" resumo="Receita por origem em novembro de 2026" />`,
    ),
  }),
};

export const AlunosPorPlano: Story = {
  name: 'Donut · com um valor zero',
  render: () => ({
    props: {
      dados: [
        { rotulo: 'Mensal', valor: 142 },
        { rotulo: 'Trimestral', valor: 78 },
        { rotulo: 'Semestral', valor: 46 },
        { rotulo: 'Anual', valor: 38 },
        { rotulo: 'Casal', valor: 8 },
        { rotulo: 'Experimental', valor: 0 },
      ],
    },
    template: moldura(
      'Alunos por plano',
      `<ui-donut [dados]="dados" resumo="Alunos ativos por plano, 312 no total" />`,
    ),
  }),
};

/** "Receita líquida por mês", de Financeiro.html e Relatorios.html. */
export const ReceitaLiquida: Story = {
  name: 'Linha e área · receita líquida por mês',
  render: () => ({
    props: { real, dados: liquidaPorMes },
    template: `<div style="display:grid;gap:16px;padding:16px;max-width:460px">
      <ui-card>
        <h2 style="margin:0 0 12px;font-size:16px;font-weight:700">Receita líquida por mês (linha)</h2>
        <ui-line-chart [dados]="dados" [formatar]="real" resumo="Receita líquida dos últimos 6 meses" colunaRotulo="Mês" colunaValor="Receita líquida" />
      </ui-card>
      <ui-card>
        <h2 style="margin:0 0 12px;font-size:16px;font-weight:700">Receita líquida por mês (área)</h2>
        <ui-area-chart [dados]="dados" [formatar]="real" resumo="Receita líquida dos últimos 6 meses" colunaRotulo="Mês" colunaValor="Receita líquida" />
      </ui-card>
    </div>`,
  }),
};

/** "Taxa de renovação" e "Inadimplência", de Relatorios.html. */
export const RenovacaoEInadimplencia: Story = {
  name: 'Linha e área · renovação e inadimplência',
  render: () => ({
    props: {
      percentual,
      renovacao: [76, 80, 78, 84, 86, 88].map((valor, i) => ({ rotulo: meses[i], valor })),
      inadimplencia: [8, 7, 5.7, 5.1, 4.4, 3.8].map((valor, i) => ({ rotulo: meses[i], valor })),
    },
    template: `<div style="display:grid;gap:16px;padding:16px;max-width:460px">
      <ui-card>
        <h2 style="margin:0 0 12px;font-size:16px;font-weight:700">Taxa de renovação</h2>
        <ui-area-chart [dados]="renovacao" [formatar]="percentual" [baseZero]="false" resumo="Taxa de renovação, 88% em novembro" />
      </ui-card>
      <ui-card>
        <h2 style="margin:0 0 12px;font-size:16px;font-weight:700">Inadimplência</h2>
        <ui-area-chart [dados]="inadimplencia" [formatar]="percentual" [baseZero]="false" resumo="Inadimplência, 3,8% em novembro" />
      </ui-card>
    </div>`,
  }),
};

/** "Evolução de carga", de AlunoDesempenho.html: supino reto, +8 kg. */
export const EvolucaoDeCarga: Story = {
  name: 'Linha · evolução de carga',
  render: () => ({
    props: {
      kg: (valor: number) => `${valor} kg`,
      dados: [60, 62, 62, 64, 66, 68].map((valor, i) => ({
        rotulo: `Treino ${i + 1}`,
        valor,
      })),
    },
    template: moldura(
      'Evolução de carga · Supino reto',
      `<ui-line-chart [dados]="dados" [formatar]="kg" [baseZero]="false" resumo="Supino reto, de 60 kg para 68 kg (+8 kg)" colunaRotulo="Treino" colunaValor="Carga" />`,
      380,
    ),
  }),
};

/** Tendência do card "Meu desempenho", de Aluno.html. */
export const TendenciaDoAluno: Story = {
  name: 'Sparkline',
  render: () => ({
    props: { valores: [60, 62, 62, 64, 66, 68] },
    template: moldura(
      'Meu desempenho',
      `<ui-sparkline [valores]="valores" resumo="Carga do supino reto nos últimos 6 treinos" colunaRotulo="Treino" colunaValor="Carga (kg)" />`,
      300,
    ),
  }),
};

export const SparklineVazia: Story = {
  name: 'Sparkline · estado vazio',
  render: () => ({
    template: moldura('Meu desempenho', `<ui-sparkline [valores]="[]" />`, 300),
  }),
};

/** "Mapa de calor de frequência", de Relatorios.html (turno × dia da semana). */
export const MapaDeCalor: Story = {
  name: 'Heatmap · frequência por turno e dia',
  render: () => ({
    props: {
      colunas: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
      linhas: ['Manhã', 'Tarde', 'Noite'],
      valores: [
        [180, 180, 180, 180, 120, 60, 60],
        [120, 120, 120, 120, 120, 60, 0],
        [240, 240, 240, 240, 180, 120, 60],
      ],
      checkins: (valor: number) => `${valor} check-ins`,
    },
    template: moldura(
      'Mapa de calor de frequência',
      `<ui-heatmap [colunas]="colunas" [linhas]="linhas" [valores]="valores" [formatar]="checkins" resumo="Check-ins por turno e dia da semana" />`,
      460,
    ),
  }),
};

/** "Treinos no mês" (14 de 16) e "Esta semana", de Aluno.html. */
export const MetaESemana: Story = {
  name: 'ProgressBar e WeekDots',
  render: () => ({
    props: {
      treinos: (valor: number) => `${valor} de 16 treinos`,
      semana: [true, true, false, true, true, false, false],
    },
    template: moldura(
      'Meu desempenho',
      `<ui-progress-bar [valor]="14" [max]="16" rotulo="Treinos no mês" [formatar]="treinos" />
       <p style="margin:6px 0 14px;font-size:12px;color:var(--muted)">14 de 16 treinos</p>
       <ui-week-dots [ativos]="semana" />`,
      300,
    ),
  }),
};
