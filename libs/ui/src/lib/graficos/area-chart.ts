import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { type FormatarValor, type PontoGrafico, formatarPadrao } from './escala';
import { LineChart } from './line-chart';

/** `LineChart` com a área preenchida; mesmas entradas. */
@Component({
  selector: 'ui-area-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LineChart],
  template: `
    <ui-line-chart
      [area]="true"
      [dados]="dados()"
      [formatar]="formatar()"
      [resumo]="resumo()"
      [mensagemVazia]="mensagemVazia()"
      [colunaRotulo]="colunaRotulo()"
      [colunaValor]="colunaValor()"
      [baseZero]="baseZero()"
    />
  `,
})
export class AreaChart {
  readonly dados = input.required<readonly PontoGrafico[]>();
  readonly formatar = input<FormatarValor>(formatarPadrao);
  readonly resumo = input<string>();
  readonly mensagemVazia = input('Sem dados no período');
  readonly colunaRotulo = input('Item');
  readonly colunaValor = input('Valor');
  readonly baseZero = input(true);
}
