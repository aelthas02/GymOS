import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type StepperOrientation = 'vertical' | 'horizontal';

export interface StepItem {
  readonly label: string;
}

/**
 * Passos numerados de um fluxo. `current` é o índice do passo atual; os anteriores aparecem com ✓.
 * Vertical é a lista lateral de Primeiros passos e da importação; horizontal cabe em telas estreitas.
 */
@Component({
  selector: 'ui-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.orientation]': 'orientation()' },
  styles: `
    :host {
      display: block;
    }
    ol {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border: 1px solid transparent;
      border-radius: 12px;
      color: var(--muted);
      font-size: 14px;
      font-weight: var(--font-weight-medium);
    }
    .ui-stepper__marker {
      display: flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--divider);
      color: var(--ink);
      font-size: 13px;
      font-weight: var(--font-weight-bold);
    }
    .ui-stepper__sr {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    li.ui-stepper__step--done,
    li.ui-stepper__step--current {
      color: var(--ink);
    }
    li.ui-stepper__step--done .ui-stepper__marker,
    li.ui-stepper__step--current .ui-stepper__marker {
      background: var(--accent);
      color: var(--accent-contrast);
    }
    li.ui-stepper__step--current {
      border-color: var(--accent);
      background: color-mix(in srgb, var(--accent) 10%, var(--surface));
      font-weight: var(--font-weight-bold);
    }
    :host([orientation='horizontal']) ol {
      flex-direction: row;
      gap: 0;
      overflow-x: auto;
    }
    :host([orientation='horizontal']) li {
      position: relative;
      flex: 1 1 0;
      flex-direction: column;
      gap: 6px;
      min-width: 88px;
      padding: 0 8px;
      border: 0;
      background: none;
      text-align: center;
    }
    :host([orientation='horizontal']) li.ui-stepper__step--current {
      background: none;
    }
    :host([orientation='horizontal']) li + li::before {
      content: '';
      position: absolute;
      top: 14px;
      right: calc(50% + 20px);
      left: calc(-50% + 20px);
      height: 2px;
      background: var(--divider);
    }
    :host([orientation='horizontal']) li.ui-stepper__step--done::before,
    :host([orientation='horizontal']) li.ui-stepper__step--current::before {
      background: var(--accent);
    }
  `,
  template: `
    <ol [attr.aria-label]="label()">
      @for (passo of steps(); track $index; let i = $index) {
        <li
          [class.ui-stepper__step--done]="i < current()"
          [class.ui-stepper__step--current]="i === current()"
          [attr.aria-current]="i === current() ? 'step' : null"
        >
          <span class="ui-stepper__marker" aria-hidden="true">{{
            i < current() ? '&#10003;' : i + 1
          }}</span>
          <span>
            {{ passo.label }}
            @if (i < current()) {
              <span class="ui-stepper__sr">, concluído</span>
            }
          </span>
        </li>
      }
    </ol>
  `,
})
export class Stepper {
  readonly steps = input.required<readonly StepItem[]>();
  /** Índice (a partir de 0) do passo atual. */
  readonly current = input(0);
  readonly orientation = input<StepperOrientation>('vertical');
  readonly label = input<string>();
}
