import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Bloco cinza enquanto o dado carrega. Decorativo: quem carrega marca `aria-busy` no contêiner. */
@Component({
  selector: 'ui-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class.ui-skeleton--circle]': 'shape() === "circle"',
    '[style.width]': 'largura()',
    '[style.height]': 'height()',
  },
  styles: `
    :host {
      display: block;
      border-radius: 6px;
      background: linear-gradient(90deg, var(--divider) 25%, var(--page) 50%, var(--divider) 75%);
      background-size: 200% 100%;
      animation: ui-skeleton-shimmer 1.4s ease-in-out infinite;
    }
    :host(.ui-skeleton--circle) {
      border-radius: 50%;
    }
    @keyframes ui-skeleton-shimmer {
      to {
        background-position: -200% 0;
      }
    }
  `,
  template: ``,
})
export class Skeleton {
  readonly width = input('100%');
  readonly height = input('16px');
  readonly shape = input<'line' | 'circle'>('line');

  /** No círculo, a largura acompanha a altura. */
  protected readonly largura = computed(() =>
    this.shape() === 'circle' ? this.height() : this.width(),
  );
}
