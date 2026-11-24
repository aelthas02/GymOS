import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EmptyState } from '../states/empty-state';
import { corDaSerie, fatiasDonut } from './escala';
import { GraficoDeSerie, GraficoTabela, graficoStyles } from './grafico-base';

const TAMANHO = 130;
const RAIO = 48;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

/** Rosca com legenda (receita por forma de pagamento, por origem). Valor zero some do arco e fica na legenda. */
@Component({
  selector: 'ui-donut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, GraficoTabela],
  styles: [
    graficoStyles,
    `
      .ui-donut {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 20px;
      }
      svg {
        flex: none;
        width: 130px;
        max-width: 100%;
      }
      .ui-trilho {
        fill: none;
        stroke: var(--divider);
      }
      .ui-fatia {
        fill: none;
      }
      .ui-legenda {
        flex: 1;
        min-width: 140px;
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 13px;
      }
      .ui-legenda li {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
      }
      .ui-legenda__cor {
        flex: none;
        width: 10px;
        height: 10px;
        border-radius: 3px;
      }
      .ui-legenda__rotulo {
        flex: 1;
      }
      .ui-legenda__valor {
        font-weight: var(--font-weight-semibold);
      }
      .ui-legenda__parte {
        color: var(--muted);
      }
    `,
  ],
  template: `
    @if (vazio() || semTotal()) {
      <ui-empty-state [heading]="mensagemVazia()" />
    } @else {
      <div class="ui-donut">
        <svg
          role="img"
          [attr.aria-label]="textoAlternativo()"
          [attr.viewBox]="'0 0 ' + tamanho + ' ' + tamanho"
        >
          <circle
            class="ui-trilho"
            [attr.cx]="centro"
            [attr.cy]="centro"
            [attr.r]="raio"
            stroke-width="22"
          />
          @for (fatia of fatias(); track $index) {
            @if (fatia.comprimento > 0) {
              <circle
                class="ui-fatia"
                [attr.cx]="centro"
                [attr.cy]="centro"
                [attr.r]="raio"
                stroke-width="22"
                [attr.stroke]="fatia.cor"
                [attr.stroke-dasharray]="
                  fatia.comprimento + ' ' + (circunferencia - fatia.comprimento)
                "
                [attr.stroke-dashoffset]="-fatia.deslocamento"
                [attr.transform]="'rotate(-90 ' + centro + ' ' + centro + ')'"
              />
            }
          }
        </svg>
        <ul class="ui-legenda">
          @for (fatia of fatias(); track $index) {
            <li>
              <span
                class="ui-legenda__cor"
                aria-hidden="true"
                [style.background]="fatia.cor"
              ></span>
              <span class="ui-legenda__rotulo">{{ fatia.rotulo }}</span>
              <span class="ui-legenda__valor">{{ fatia.valor }}</span>
              @if (fatia.parte) {
                <span class="ui-legenda__parte">{{ fatia.parte }}</span>
              }
            </li>
          }
        </ul>
      </div>
      <ui-grafico-tabela
        [legenda]="textoAlternativo()"
        [colunas]="colunas()"
        [linhas]="linhasDaTabela()"
      />
    }
  `,
})
export class Donut extends GraficoDeSerie {
  /** Texto da parte de cada fatia na legenda ("54%"); recebe a fração de 0 a 1. Sem ele, só o valor. */
  readonly formatarParte = input<(fracao: number) => string>();

  protected override readonly nome = 'Gráfico de rosca';
  protected readonly tamanho = TAMANHO;
  protected readonly centro = TAMANHO / 2;
  protected readonly raio = RAIO;
  protected readonly circunferencia = CIRCUNFERENCIA;

  protected readonly semTotal = computed(() => this.fatias().every((f) => f.comprimento === 0));

  protected readonly fatias = computed(() => {
    const dados = this.dados();
    const geometria = fatiasDonut(dados.map((p) => p.valor));
    const formatar = this.formato();
    const parte = this.formatarParte();
    return dados.map((ponto, i) => ({
      rotulo: ponto.rotulo,
      valor: formatar(ponto.valor),
      parte: parte && geometria[i].fracao > 0 ? parte(geometria[i].fracao) : '',
      cor: corDaSerie(i),
      comprimento: (geometria[i].angulo / 360) * CIRCUNFERENCIA,
      deslocamento: (geometria[i].inicio / 360) * CIRCUNFERENCIA,
    }));
  });
}
