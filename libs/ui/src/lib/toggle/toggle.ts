import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/**
 * Interruptor (`role="switch"`). Espaço alterna e o clique também; o `keyup` do Espaço é cancelado
 * para o navegador não gerar um segundo clique depois do `keydown` tratado.
 */
@Component({
  selector: 'ui-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: inline-flex;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
      padding: 0;
      border: 0;
      background: none;
      color: var(--ink);
      font: var(--font-weight-regular) 14px var(--font);
      cursor: pointer;
    }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
    button:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
      border-radius: var(--radius-pill);
    }
    .ui-toggle__track {
      position: relative;
      flex: none;
      width: 44px;
      height: 26px;
      border-radius: var(--radius-pill);
      background: var(--muted);
      transition: background-color 0.15s;
    }
    .ui-toggle__thumb {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--surface);
      transition: translate 0.15s;
    }
    [aria-checked='true'] .ui-toggle__track {
      background: var(--accent-text);
    }
    [aria-checked='true'] .ui-toggle__thumb {
      translate: 18px 0;
    }
  `,
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="checked()"
      [disabled]="disabled()"
      (click)="alternar()"
      (keydown.space)="espaco($event)"
      (keyup.space)="$event.preventDefault()"
    >
      <span class="ui-toggle__track"><span class="ui-toggle__thumb"></span></span>
      <span [class.ui-sr-only]="hideLabel()">{{ label() }}</span>
    </button>
  `,
})
export class Toggle {
  readonly checked = model(false);
  readonly label = input.required<string>();
  readonly disabled = input(false);
  /** Rótulo só para leitores de tela, quando o texto visível fica ao lado (linha de configuração). */
  readonly hideLabel = input(false);

  protected alternar(): void {
    if (!this.disabled()) this.checked.update((valor) => !valor);
  }

  protected espaco(evento: Event): void {
    evento.preventDefault();
    this.alternar();
  }
}
