import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'accent' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Botão do GymOS: primário (tinta), destaque (acento da academia), contorno e perigo.
 * Carregando bloqueia o clique e avisa com `aria-busy`.
 */
@Component({
  selector: 'ui-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: inline-flex;
    }
    :host(.ui-button--block) {
      display: flex;
    }
    :host(.ui-button--block) button {
      flex: 1;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 40px;
      padding: 0 16px;
      border: 1px solid transparent;
      border-radius: var(--radius-control);
      font: var(--font-weight-semibold) 13px var(--font);
      cursor: pointer;
      white-space: nowrap;
    }
    button:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
    .ui-button--primary {
      background: var(--ink);
      color: var(--on-ink);
    }
    .ui-button--accent {
      background: var(--accent);
      color: var(--accent-contrast);
    }
    .ui-button--outline {
      background: var(--surface);
      border-color: var(--border);
      color: var(--ink);
    }
    .ui-button--danger {
      background: var(--badge-late-bg);
      border-color: var(--state-error-border);
      color: var(--badge-late-fg);
    }
    .ui-button--sm {
      min-height: 36px;
      padding: 0 12px;
    }
    .ui-button--lg {
      min-height: 44px;
    }
    .ui-button--xl {
      min-height: 48px;
      font-size: 15px;
    }
    .ui-button__spinner {
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: ui-button-spin 0.8s linear infinite;
    }
    @keyframes ui-button-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
  host: {
    '[class.ui-button--block]': 'block()',
  },
  template: `
    <button
      [type]="type()"
      [class]="classes()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() ? 'true' : null"
    >
      @if (loading()) {
        <span class="ui-button__spinner" aria-hidden="true"></span>
      }
      <ng-content />
    </button>
  `,
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly loading = input(false);
  readonly disabled = input(false);
  /** Ocupa a largura toda do contêiner (botão de envio dos formulários de entrada). */
  readonly block = input(false);

  protected readonly classes = computed(
    () => `ui-button--${this.variant()} ui-button--${this.size()}`,
  );
}
