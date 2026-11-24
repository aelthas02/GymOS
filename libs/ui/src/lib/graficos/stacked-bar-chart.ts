import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EmptyState } from '../states/empty-state';
import { type FormatarValor, alturas, formatarPadrao, passoDeRotulos } from './escala';
import { GraficoTabela, graficoStyles } from './grafico-base';

export interface PontoEmpilhado {
  rotulo: string;
  positivo: number;
  negativo: number;
}

const LARGURA = 320;
const ALTURA = 160;
const BASE = 138;
const ALTURA_MAX = 124;

/** Barras empilhadas: o positivo (adesões) em verde na base e o negativo (cancelamentos) em vermelho em cima. */
@Component({
  selector: 'ui-stacked-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, GraficoTabela],
  styles: [
    graficoStyles,
    `
      .ui-barra--positivo {
        fill: var(--accent);
      }
      .ui-barra--negativo {
        fill: var(--chart-negative);
      }
      .ui-legenda {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 16px;
        margin: 8px 0 0;
        padding: 0;
        list-style: none;
        font-size: 12px;
        color: var(--muted);
      }
      .ui-legenda li {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .ui-legenda__cor {
        width: 10px;
        height: 10px;
        border-radius: 3px;
      }
      .ui-legenda__cor--positivo {
        background: var(--accent);
      }
      .ui-legenda__cor--negativo {
        background: var(--chart-negative);
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
            class="ui-barra ui-barra--positivo"
            [attr.x]="barra.x"
            [attr.y]="barra.yPositivo"
            [attr.width]="barra.largura"
            [attr.height]="barra.alturaPositivo"
          />
          <rect
            class="ui-barra ui-barra--negativo"
            [attr.x]="barra.x"
            [attr.y]="barra.yNegativo"
            [attr.width]="barra.largura"
            [attr.height]="barra.alturaNegativo"
          />
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
      <ul class="ui-legenda">
        <li>
          <span class="ui-legenda__cor ui-legenda__cor--positivo" aria-hidden="true"></span>
          {{ rotuloPositivo() }}
        </li>
        <li>
          <span class="ui-legenda__cor ui-legenda__cor--negativo" aria-hidden="true"></span>
          {{ rotuloNegativo() }}
        </li>
      </ul>
      <ui-grafico-tabela
        [legenda]="textoAlternativo()"
        [colunas]="colunas()"
        [linhas]="linhasDaTabela()"
      />
    }
  `,
})
export class StackedBarChart {
  readonly dados = input.required<readonly PontoEmpilhado[]>();
  readonly rotuloPositivo = input('Adesões');
  readonly rotuloNegativo = input('Cancelamentos');
  readonly formatar = input<FormatarValor>(formatarPadrao);
  readonly resumo = input<string>();
  readonly mensagemVazia = input('Sem dados no período');
  readonly colunaRotulo = input('Período');

  protected readonly largura = LARGURA;
  protected readonly altura = ALTURA;
  protected readonly base = BASE;

  protected readonly vazio = computed(() => this.dados().length === 0);

  protected readonly textoAlternativo = computed(() => {
    const dados = this.dados();
    const soma = (campo: 'positivo' | 'negativo') =>
      dados.reduce((s, p) => s + (Number.isFinite(p[campo]) ? p[campo] : 0), 0);
    const formatar = this.formatar();
    return `${this.resumo() ?? 'Gráfico de barras empilhadas'}. ${dados.length} pontos; ${this.rotuloPositivo()}: ${formatar(soma('positivo'))}; ${this.rotuloNegativo()}: ${formatar(soma('negativo'))}.`;
  });

  protected readonly colunas = computed(() => [
    this.colunaRotulo(),
    this.rotuloPositivo(),
    this.rotuloNegativo(),
  ]);

  protected readonly linhasDaTabela = computed(() => {
    const formatar = this.formatar();
    return this.dados().map((p) => [p.rotulo, formatar(p.positivo), formatar(p.negativo)]);
  });

  protected readonly barras = computed(() => {
    const dados = this.dados();
    // Escala pelo total empilhado: as duas partes dividem a mesma régua.
    const totais = dados.map((p) => safe(p.positivo) + safe(p.negativo));
    const alturasTotais = alturas(totais, ALTURA_MAX);
    const passo = passoDeRotulos(dados.length);
    const faixa = LARGURA / dados.length;
    const largura = Math.min(faixa * 0.72, 32);

    return dados.map((ponto, i) => {
      const alturaPositivo =
        totais[i] === 0 ? 0 : (safe(ponto.positivo) / totais[i]) * alturasTotais[i];
      const alturaNegativo = alturasTotais[i] - alturaPositivo;
      return {
        x: i * faixa + (faixa - largura) / 2,
        largura,
        yPositivo: BASE - alturaPositivo,
        alturaPositivo,
        yNegativo: BASE - alturasTotais[i],
        alturaNegativo,
        rotulo: i % passo === 0 ? ponto.rotulo : null,
      };
    });
  });
}

function safe(valor: number): number {
  return Number.isFinite(valor) && valor > 0 ? valor : 0;
}
