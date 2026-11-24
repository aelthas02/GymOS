import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { EmptyState } from '../states/empty-state';
import { alturas, indiceDestaque, passoDeRotulos } from './escala';
import { GraficoDeSerie, GraficoTabela, graficoStyles } from './grafico-base';

const LARGURA = 320;
const ALTURA = 160;
const BASE = 138;
const ALTURA_MAX = 116;

/**
 * Barras verticais. O maior valor ganha a cor de acento e o rótulo ("112" às 18h, no Início); as
 * demais ficam em `--chart-bar`.
 */
@Component({
  selector: 'ui-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, GraficoTabela],
  styles: [
    graficoStyles,
    `
      .ui-barra {
        fill: var(--chart-bar);
      }
      .ui-barra--destaque {
        fill: var(--accent);
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
        <line
          x1="0"
          [attr.x2]="largura"
          [attr.y1]="base"
          [attr.y2]="base"
          stroke="var(--divider)"
        />
        @for (barra of barras(); track $index) {
          <rect
            class="ui-barra"
            [class.ui-barra--destaque]="barra.destaque"
            [attr.x]="barra.x"
            [attr.y]="barra.y"
            [attr.width]="barra.largura"
            [attr.height]="barra.altura"
            rx="3"
          />
          @if (barra.destaque) {
            <text
              class="ui-valor ui-barra-valor"
              text-anchor="middle"
              [attr.x]="barra.x + barra.largura / 2"
              [attr.y]="barra.y - 5"
            >
              {{ barra.valor }}
            </text>
          }
          @if (barra.rotulo !== null) {
            <text
              class="ui-eixo"
              text-anchor="middle"
              [attr.x]="barra.x + barra.largura / 2"
              [attr.y]="altura - 4"
            >
              {{ barra.rotulo }}
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
export class BarChart extends GraficoDeSerie {
  protected override readonly nome = 'Gráfico de barras';
  protected readonly largura = LARGURA;
  protected readonly altura = ALTURA;
  protected readonly base = BASE;

  protected readonly barras = computed(() => {
    const dados = this.dados();
    const valores = dados.map((p) => p.valor);
    const hs = alturas(valores, ALTURA_MAX);
    const pico = indiceDestaque(valores);
    const passo = passoDeRotulos(dados.length);
    const faixa = LARGURA / dados.length;
    const largura = Math.min(faixa * 0.72, 32);
    const formatar = this.formato();

    return dados.map((ponto, i) => ({
      x: i * faixa + (faixa - largura) / 2,
      y: BASE - hs[i],
      largura,
      altura: hs[i],
      destaque: i === pico,
      valor: formatar(ponto.valor),
      rotulo: i % passo === 0 || i === pico ? ponto.rotulo : null,
    }));
  });
}
