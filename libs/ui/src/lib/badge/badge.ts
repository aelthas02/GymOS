import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cssVar } from '../../../styles/tokens';

export type BadgeVariant = 'ok' | 'late' | 'soon' | 'off';

/** Situação em uma palavra (Em dia, Em atraso...). O par de cores vem dos tokens `--badge-*`. */
@Component({
  selector: 'ui-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.background-color]': 'pair().bg',
    '[style.color]': 'pair().fg',
  },
  styles: `
    :host {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: var(--font-weight-semibold);
      white-space: nowrap;
    }
  `,
  template: `<ng-content />`,
})
export class Badge {
  readonly variant = input<BadgeVariant>('off');

  protected readonly pair = computed(() => ({
    bg: cssVar(`badge-${this.variant()}-bg`),
    fg: cssVar(`badge-${this.variant()}-fg`),
  }));
}
