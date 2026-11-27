import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EmptyState } from '../states/empty-state';
import { alturas } from './escala';
import { GraficoDeSerie, GraficoTabela, graficoStyles } from './grafico-base';

const LINHA = 34;

/** Barras horizontais: rótulo e valor acima de cada barra (receita por setor, por aula, por funcionário). */
@Component({
  selector: 'ui-horizontal-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, GraficoTabela],
  styles: [
    graficoStyles,
    `
      .ui-trilho {
        fill: var(--divider);
      }
      .ui-barra {
        fill: var(--accent);
      }
      .ui-rotulo {
        fill: var(--ink);
        font-family: var(--font);
        font-size: 12px;
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
        [attr.viewBox]="'0 0 ' + largura() + ' ' + altura()"
      >
        @for (linha of linhas(); track $index) {
          <text class="ui-rotulo" x="0" [attr.y]="linha.y + 12">{{ linha.rotulo }}</text>
          <text class="ui-valor" text-anchor="end" [attr.x]="largura()" [attr.y]="linha.y + 12">
            {{ linha.valor }}
          </text>
          <rect
            class="ui-trilho"
            x="0"
            [attr.y]="linha.y + 18"
            [attr.width]="largura()"
            height="8"
            rx="4"
          />
          <rect
            class="ui-barra"
            x="0"
            [attr.y]="linha.y + 18"
            [attr.width]="linha.largura"
            height="8"
            rx="4"
          />
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
export class HorizontalBars extends GraficoDeSerie {
  protected override readonly nome = 'Gráfico de barras horizontais';
  /** Largura do desenho em unidades do viewBox (320 em cartão estreito; maior em cartão largo). */
  readonly largura = input(320);
  protected readonly altura = computed(() => this.dados().length * LINHA);

  protected readonly linhas = computed(() => {
    const dados = this.dados();
    const larguras = alturas(
      dados.map((p) => p.valor),
      this.largura(),
    );
    const formatar = this.formato();
    return dados.map((ponto, i) => ({
      y: i * LINHA,
      rotulo: ponto.rotulo,
      valor: formatar(ponto.valor),
      largura: larguras[i],
    }));
  });
}
