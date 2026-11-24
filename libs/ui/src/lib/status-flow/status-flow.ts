import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface StatusStep {
  readonly label: string;
}

/**
 * Cadeia de situações pela qual um contrato passa (Ativo › A vencer › Tolerância 7 dias ›
 * Encerrado). Só mostra: a situação atual fica em destaque.
 */
@Component({
  selector: 'ui-status-flow',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    ol {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 13px;
    }
    li {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    li + li::before {
      content: '›';
      color: var(--muted);
    }
    .ui-status-flow__step {
      padding: 4px 12px;
      border-radius: var(--radius-pill);
      background: var(--badge-off-bg);
      color: var(--badge-off-fg);
      font-weight: var(--font-weight-semibold);
    }
    .ui-status-flow__step--current {
      background: var(--ink);
      color: var(--on-ink);
    }
  `,
  template: `
    <ol [attr.aria-label]="label()">
      @for (passo of steps(); track $index; let i = $index) {
        <li [attr.aria-current]="i === current() ? 'step' : null">
          <span
            class="ui-status-flow__step"
            [class.ui-status-flow__step--current]="i === current()"
          >
            {{ passo.label }}
          </span>
        </li>
      }
    </ol>
  `,
})
export class StatusFlow {
  readonly steps = input.required<readonly StatusStep[]>();
  /** Índice da situação atual; -1 quando nenhuma está em destaque. */
  readonly current = input(-1);
  readonly label = input<string>();
}
