import { ChangeDetectionStrategy, Component, Directive, computed, input } from '@angular/core';
import {
  type FormatarValor,
  type PontoGrafico,
  formatarPadrao,
  resumoDaSerie,
  formatarSeguro,
} from './escala';

/** Estilos comuns: o gráfico ocupa a largura do pai e o texto do eixo usa tokens. */
export const graficoStyles = `
  :host {
    display: block;
    position: relative;
    min-width: 0;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }
  .ui-eixo {
    fill: var(--muted);
    font-family: var(--font);
    font-size: 11px;
  }
  .ui-valor {
    fill: var(--ink);
    font-family: var(--font);
    font-size: 11px;
    font-weight: var(--font-weight-semibold);
  }
`;

/**
 * Tabela com todos os pontos do gráfico, escondida da tela e lida por leitor de tela. Fica ao lado
 * do `<svg role="img">`, porque um `role="img"` torna os filhos decorativos.
 */
@Component({
  selector: 'ui-grafico-tabela',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // A tabela é só para leitor de tela: o host a recorta, senão uma tabela larga alarga a página.
  styles: `
    :host {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
    }
  `,
  template: `
    <table class="ui-sr-only">
      <caption>
        {{
          legenda()
        }}
      </caption>
      <thead>
        <tr>
          @for (coluna of colunas(); track $index) {
            <th scope="col">{{ coluna }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (linha of linhas(); track $index) {
          <tr>
            @for (celula of linha; track $index) {
              @if ($first) {
                <th scope="row">{{ celula }}</th>
              } @else {
                <td>{{ celula }}</td>
              }
            }
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class GraficoTabela {
  readonly legenda = input.required<string>();
  readonly colunas = input.required<readonly string[]>();
  /** Valores já formatados; a primeira célula de cada linha é o rótulo. */
  readonly linhas = input.required<readonly (readonly string[])[]>();
}

/** Entradas e textos acessíveis dos gráficos de uma série (barras, rosca e linhas). */
@Directive()
export abstract class GraficoDeSerie {
  readonly dados = input.required<readonly PontoGrafico[]>();
  /** Formata cada valor exibido; as telas passam o pipe de moeda ou de número (T08). */
  readonly formatar = input<FormatarValor>(formatarPadrao);
  /** Texto do `aria-label` do gráfico; o pico da série é acrescentado a ele. */
  readonly resumo = input<string>();
  readonly mensagemVazia = input('Sem dados no período');
  /** Cabeçalhos da tabela acessível. */
  readonly colunaRotulo = input('Item');
  readonly colunaValor = input('Valor');

  protected abstract readonly nome: string;

  /** `formatar` à prova de dado inválido; é o que os gráficos usam para exibir. */
  protected readonly formato = computed(() => formatarSeguro(this.formatar()));
  protected readonly vazio = computed(() => this.dados().length === 0);
  protected readonly textoAlternativo = computed(() =>
    resumoDaSerie(this.resumo(), this.nome, this.dados(), this.formato()),
  );
  protected readonly colunas = computed(() => [this.colunaRotulo(), this.colunaValor()]);
  protected readonly linhasDaTabela = computed(() =>
    this.dados().map((p) => [p.rotulo, this.formato()(p.valor)]),
  );
}
