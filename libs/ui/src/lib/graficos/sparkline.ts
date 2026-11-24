import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EmptyState } from '../states/empty-state';
import { type FormatarValor, formatarPadrao, pontosDaLinha } from './escala';
import { GraficoTabela, graficoStyles } from './grafico-base';

const LARGURA = 140;
const ALTURA = 40;
const MARGEM = 4;

/** Linha mínima, sem eixos, para cards e KPIs (a tendência de `Aluno.html`). Estica na largura do pai. */
@Component({
  selector: 'ui-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, GraficoTabela],
  styles: [
    graficoStyles,
    `
      svg {
        height: 40px;
      }
      .ui-linha {
        fill: none;
        stroke: var(--accent);
        stroke-width: 2.5;
        stroke-linejoin: round;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
      }
      .ui-area {
        fill: var(--accent);
        fill-opacity: 0.18;
      }
    `,
  ],
  template: `
    @if (valores().length === 0) {
      <ui-empty-state [heading]="mensagemVazia()" />
    } @else {
      <svg
        role="img"
        preserveAspectRatio="none"
        [attr.aria-label]="textoAlternativo()"
        [attr.viewBox]="'0 0 ' + largura + ' ' + altura"
      >
        <polygon class="ui-area" [attr.points]="poligono()" />
        <polyline class="ui-linha" [attr.points]="linha()" />
      </svg>
      <ui-grafico-tabela
        [legenda]="textoAlternativo()"
        [colunas]="colunas()"
        [linhas]="linhasDaTabela()"
      />
    }
  `,
})
export class Sparkline {
  readonly valores = input.required<readonly number[]>();
  /** Rótulo de cada ponto na tabela acessível; sem ele os pontos são numerados. */
  readonly rotulos = input<readonly string[]>([]);
  readonly formatar = input<FormatarValor>(formatarPadrao);
  readonly resumo = input<string>();
  readonly mensagemVazia = input('Sem dados');
  readonly colunaRotulo = input('Ponto');
  readonly colunaValor = input('Valor');

  protected readonly largura = LARGURA;
  protected readonly altura = ALTURA;

  private readonly coordenadas = computed(() =>
    pontosDaLinha(this.valores(), {
      largura: LARGURA,
      altura: ALTURA,
      margem: MARGEM,
      baseZero: false,
    }),
  );

  protected readonly linha = computed(() =>
    this.coordenadas()
      .map((p) => `${p.x},${p.y}`)
      .join(' '),
  );

  protected readonly poligono = computed(() => {
    const pontos = this.coordenadas();
    return `${pontos[0].x},${ALTURA} ${this.linha()} ${pontos[pontos.length - 1].x},${ALTURA}`;
  });

  protected readonly textoAlternativo = computed(() => {
    const valores = this.valores();
    const formatar = this.formatar();
    const primeiro = formatar(valores[0]);
    const ultimo = formatar(valores[valores.length - 1]);
    return `${this.resumo() ?? 'Tendência'}. ${valores.length} pontos, de ${primeiro} a ${ultimo}.`;
  });

  protected readonly colunas = computed(() => [this.colunaRotulo(), this.colunaValor()]);

  protected readonly linhasDaTabela = computed(() => {
    const rotulos = this.rotulos();
    const formatar = this.formatar();
    return this.valores().map((valor, i) => [rotulos[i] ?? String(i + 1), formatar(valor)]);
  });
}
