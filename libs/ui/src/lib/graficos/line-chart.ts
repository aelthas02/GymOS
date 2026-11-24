import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EmptyState } from '../states/empty-state';
import { passoDeRotulos, pontosDaLinha, poligonoDaArea, pontosSvg } from './escala';
import { GraficoDeSerie, GraficoTabela, graficoStyles } from './grafico-base';

const LARGURA = 320;
const ALTURA = 140;
const AREA = 116;
const MARGEM = 10;
const MAX_MARCADORES = 12;

/** Linha de uma série (evolução de carga, receita líquida por mês); `area` pinta o espaço sob ela. */
@Component({
  selector: 'ui-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, GraficoTabela],
  styles: [
    graficoStyles,
    `
      .ui-grade {
        stroke: var(--divider);
      }
      .ui-linha {
        fill: none;
        stroke: var(--accent);
        stroke-width: 2.5;
        stroke-linejoin: round;
        stroke-linecap: round;
      }
      .ui-area {
        fill: var(--accent);
        fill-opacity: 0.18;
      }
      .ui-ponto {
        fill: var(--surface);
        stroke: var(--accent);
        stroke-width: 2;
      }
    `,
  ],
  template: `
    @if (vazio()) {
      <ui-empty-state [heading]="mensagemVazia()" />
    } @else {
      <svg
        role="img"
        [attr.aria-label]="textoAlternativo()"
        [attr.viewBox]="'0 0 ' + largura + ' ' + altura"
      >
        @for (y of grade(); track $index) {
          <line class="ui-grade" x1="0" [attr.x2]="largura" [attr.y1]="y" [attr.y2]="y" />
        }
        @if (area()) {
          <polygon class="ui-area" [attr.points]="poligono()" />
        }
        <polyline class="ui-linha" [attr.points]="linha()" />
        @for (ponto of pontos(); track $index) {
          @if (ponto.marcar) {
            <circle class="ui-ponto" [attr.cx]="ponto.x" [attr.cy]="ponto.y" r="3.5" />
          }
          @if (ponto.rotulo !== null) {
            <text class="ui-eixo" text-anchor="middle" [attr.x]="ponto.x" [attr.y]="altura - 4">
              {{ ponto.rotulo }}
            </text>
          }
        }
      </svg>
      <ui-grafico-tabela
        [legenda]="textoAlternativo()"
        [colunas]="colunas()"
        [linhas]="linhasDaTabela()"
      />
    }
  `,
})
export class LineChart extends GraficoDeSerie {
  /** Pinta a área sob a linha. */
  readonly area = input(false);
  /** A escala parte de zero (padrão); com `false` vai do menor ao maior valor, para variações pequenas. */
  readonly baseZero = input(true);

  protected override readonly nome = 'Gráfico de linha';
  protected readonly largura = LARGURA;
  protected readonly altura = ALTURA;

  private readonly coordenadas = computed(() =>
    pontosDaLinha(
      this.dados().map((p) => p.valor),
      { largura: LARGURA, altura: AREA, margem: MARGEM, baseZero: this.baseZero() },
    ),
  );

  protected readonly grade = computed(() => [MARGEM, AREA / 2, AREA - MARGEM]);

  protected readonly linha = computed(() => pontosSvg(this.coordenadas()));

  protected readonly poligono = computed(() => {
    return poligonoDaArea(this.coordenadas(), AREA - MARGEM);
  });

  protected readonly pontos = computed(() => {
    const dados = this.dados();
    const passo = passoDeRotulos(dados.length);
    const marcarTodos = dados.length <= MAX_MARCADORES;
    return this.coordenadas().map((p, i) => ({
      ...p,
      marcar: marcarTodos || i === dados.length - 1,
      rotulo: i % passo === 0 ? (dados[i]?.rotulo ?? null) : null,
    }));
  });
}
