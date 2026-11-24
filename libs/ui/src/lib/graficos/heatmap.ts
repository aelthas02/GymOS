import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EmptyState } from '../states/empty-state';
import { type FormatarValor, formatarPadrao, intensidade } from './escala';
import { GraficoTabela, graficoStyles } from './grafico-base';

const LARGURA = 320;
const COLUNA_ROTULOS = 52;
const CABECALHO = 18;
const LINHA = 30;
const FOLGA = 3;
const OPACIDADE_MIN = 0.12;

/** Mapa de calor (dia da semana × turno, de `Relatorios.html`): quanto maior o valor, mais forte o acento. */
@Component({
  selector: 'ui-heatmap',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, GraficoTabela],
  styles: [
    graficoStyles,
    `
      .ui-celula {
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
        [attr.viewBox]="'0 0 ' + largura + ' ' + altura()"
      >
        @for (coluna of colunas(); track $index) {
          <text
            class="ui-eixo"
            text-anchor="middle"
            [attr.x]="colunaX($index) + larguraCelula() / 2"
            y="12"
          >
            {{ coluna }}
          </text>
        }
        @for (linha of linhas(); track $index) {
          <text
            class="ui-eixo"
            x="0"
            [attr.y]="cabecalho + $index * linhaAltura + linhaAltura / 2 + 4"
          >
            {{ linha }}
          </text>
        }
        @for (celula of celulas(); track celula.id) {
          <rect
            class="ui-celula"
            rx="6"
            [attr.x]="celula.x"
            [attr.y]="celula.y"
            [attr.width]="larguraCelula()"
            [attr.height]="linhaAltura - folga"
            [attr.fill-opacity]="celula.opacidade"
          />
        }
      </svg>
      <ui-grafico-tabela
        [legenda]="textoAlternativo()"
        [colunas]="cabecalhoTabela()"
        [linhas]="linhasDaTabela()"
      />
    }
  `,
})
export class Heatmap {
  /** Colunas (dias da semana). */
  readonly colunas = input.required<readonly string[]>();
  /** Linhas (turnos). */
  readonly linhas = input.required<readonly string[]>();
  /** Matriz `valores[linha][coluna]`; célula ausente vale 0. */
  readonly valores = input.required<readonly (readonly number[])[]>();
  readonly formatar = input<FormatarValor>(formatarPadrao);
  readonly resumo = input<string>();
  readonly mensagemVazia = input('Sem dados no período');
  /** Cabeçalho da coluna de rótulos na tabela acessível. */
  readonly cabecalhoLinha = input('Turno');

  protected readonly largura = LARGURA;
  protected readonly cabecalho = CABECALHO;
  protected readonly linhaAltura = LINHA;
  protected readonly folga = FOLGA;

  protected readonly vazio = computed(
    () => this.colunas().length === 0 || this.linhas().length === 0,
  );
  protected readonly altura = computed(() => CABECALHO + this.linhas().length * LINHA);
  protected readonly larguraCelula = computed(
    () => (LARGURA - COLUNA_ROTULOS) / this.colunas().length - FOLGA,
  );

  private readonly matriz = computed(() =>
    this.linhas().map((_, l) => this.colunas().map((__, c) => this.valores()[l]?.[c] ?? 0)),
  );

  protected colunaX(coluna: number): number {
    return COLUNA_ROTULOS + coluna * (this.larguraCelula() + FOLGA);
  }

  protected readonly celulas = computed(() => {
    const matriz = this.matriz();
    const maximo = Math.max(0, ...matriz.flat().filter(Number.isFinite));
    return matriz.flatMap((linha, l) =>
      linha.map((valor, c) => ({
        id: `${l}-${c}`,
        x: this.colunaX(c),
        y: CABECALHO + l * LINHA,
        opacidade: Number(
          Math.min(1, OPACIDADE_MIN + (1 - OPACIDADE_MIN) * intensidade(valor, maximo)).toFixed(3),
        ),
      })),
    );
  });

  protected readonly cabecalhoTabela = computed(() => [this.cabecalhoLinha(), ...this.colunas()]);

  protected readonly linhasDaTabela = computed(() => {
    const formatar = this.formatar();
    return this.linhas().map((rotulo, l) => [rotulo, ...this.matriz()[l].map((v) => formatar(v))]);
  });

  protected readonly textoAlternativo = computed(() => {
    const matriz = this.matriz();
    let melhor = { valor: -1, linha: 0, coluna: 0 };
    matriz.forEach((linha, l) =>
      linha.forEach((valor, c) => {
        if (valor > melhor.valor) melhor = { valor, linha: l, coluna: c };
      }),
    );
    const pico = `maior valor ${this.formatar()(melhor.valor)}: ${this.linhas()[melhor.linha]}, ${this.colunas()[melhor.coluna]}`;
    return `${this.resumo() ?? 'Mapa de calor'}. ${pico}.`;
  });
}
