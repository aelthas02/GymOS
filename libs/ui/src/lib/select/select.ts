import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { FieldControl } from '../field/field';
import { Icon } from '../icon/icon';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

/** Seletor nativo estilizado (acessível por padrão). Dentro de um `ui-field` herda rótulo e dica. */
@Component({
  selector: 'ui-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldControl, Icon],
  styles: `
    :host {
      position: relative;
      display: block;
      min-width: 200px;
    }
    select {
      width: 100%;
      height: 44px;
      padding: 0 40px 0 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-regular) 14px var(--font);
      appearance: none;
      cursor: pointer;
    }
    select:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    select[aria-invalid='true'] {
      border-color: var(--badge-late-fg);
    }
    select:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
    ui-icon {
      position: absolute;
      top: 50%;
      right: 14px;
      translate: 0 -50%;
      color: var(--muted);
      pointer-events: none;
    }
  `,
  template: `
    <select
      uiFieldControl
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel() ?? null"
      (change)="escolher($event)"
    >
      @if (placeholder() !== undefined) {
        <option value="" [selected]="value() === ''">{{ placeholder() }}</option>
      }
      @for (opcao of options(); track opcao.value) {
        <option
          [value]="opcao.value"
          [disabled]="opcao.disabled"
          [selected]="opcao.value === value()"
        >
          {{ opcao.label }}
        </option>
      }
    </select>
    <ui-icon name="chevron-down" [size]="18" />
  `,
})
export class Select {
  readonly options = input<readonly SelectOption[]>([]);
  readonly value = model('');
  /** Texto da opção vazia ("Todos"); sem ele, não há opção vazia. */
  readonly placeholder = input<string>();
  readonly disabled = input(false);
  /** Nome acessível quando não há `ui-field` com rótulo. */
  readonly ariaLabel = input<string>();

  protected escolher(evento: Event): void {
    this.value.set((evento.target as HTMLSelectElement).value);
  }
}
