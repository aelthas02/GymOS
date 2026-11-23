import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Cartão branco com borda (padrão) ou de tinta (`inverse`, como "Hoje na academia"). */
@Component({
  selector: 'ui-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ui-card--inverse]': 'inverse()',
    '[class.ui-card--compact]': 'compact()',
  },
  styles: `
    :host {
      display: block;
      min-width: 0;
      padding: var(--card-padding);
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
      color: var(--ink);
    }
    :host(.ui-card--compact) {
      padding: 16px;
    }
    :host(.ui-card--inverse) {
      border-color: var(--ink);
      background: var(--ink);
      color: var(--on-ink);
    }
  `,
  template: `<ng-content />`,
})
export class Card {
  readonly inverse = input(false);
  readonly compact = input(false);
}
