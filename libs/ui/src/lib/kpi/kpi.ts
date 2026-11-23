import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Card } from '../card/card';

export type KpiTrend = 'up' | 'down' | 'flat';

const trendText: Record<KpiTrend, string> = { up: 'subiu', down: 'caiu', flat: 'estável' };
const trendMark: Record<KpiTrend, string> = { up: '▲', down: '▼', flat: '■' };

/** Indicador: rótulo, valor grande, legenda e variação. Um gráfico pequeno entra pelo slot padrão. */
@Component({
  selector: 'ui-kpi',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card],
  styles: `
    :host {
      display: block;
    }
    .ui-kpi__label {
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
      color: var(--muted);
    }
    .ui-kpi__value {
      margin-top: 2px;
      font-size: 26px;
      font-weight: var(--font-weight-bold);
    }
    .ui-kpi__legend {
      font-size: 12px;
      color: var(--muted);
    }
    .ui-kpi__delta {
      display: inline-block;
      margin-top: 4px;
      font-size: 12px;
      font-weight: var(--font-weight-semibold);
    }
    .ui-kpi__delta--up {
      color: var(--badge-ok-fg);
    }
    .ui-kpi__delta--down {
      color: var(--badge-late-fg);
    }
    .ui-kpi__delta--flat {
      color: var(--muted);
    }
  `,
  template: `
    <ui-card [compact]="true">
      <div class="ui-kpi__label">{{ label() }}</div>
      <div class="ui-kpi__value">{{ value() }}</div>
      @if (legend()) {
        <div class="ui-kpi__legend">{{ legend() }}</div>
      }
      @if (delta()) {
        <span class="ui-kpi__delta ui-kpi__delta--{{ trend() }}">
          <span aria-hidden="true">{{ mark[trend()] }}</span>
          {{ delta() }}
          <span class="ui-sr-only">{{ text[trend()] }}</span>
        </span>
      }
      <ng-content />
    </ui-card>
  `,
})
export class Kpi {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly legend = input<string>();
  /** Variação já formatada ("+8,2%"); o sinal é decisão de quem calcula. */
  readonly delta = input<string>();
  readonly trend = input<KpiTrend>('flat');

  protected readonly text = trendText;
  protected readonly mark = trendMark;
}
