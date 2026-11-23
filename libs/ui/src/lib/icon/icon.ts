import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { icons, type IconName } from './icons';

/** Ícone do conjunto próprio. Sem `label` é decorativo; com `label` vira imagem nomeada. */
@Component({
  selector: 'ui-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
  },
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
    svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
  template: `
    <svg viewBox="0 0 24 24" focusable="false">
      @for (d of paths(); track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
})
export class Icon {
  /** Nome no conjunto `icons`; nome desconhecido não desenha nada. */
  readonly name = input.required<IconName | (string & {})>();
  readonly label = input<string>();
  readonly size = input(20);

  protected readonly paths = computed<readonly string[]>(
    () => (icons as Record<string, readonly string[]>)[this.name()] ?? [],
  );
}
