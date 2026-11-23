import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Directive,
  inject,
  input,
} from '@angular/core';

let proximo = 0;

/**
 * Campo de formulário: rótulo, dica e erro em volta de um controle. O controle projetado leva
 * `uiFieldControl`, que liga o `id` ao rótulo e o `aria-describedby` à dica e ao erro.
 */
@Component({
  selector: 'ui-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    .ui-field__label {
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
    }
    .ui-field__hint {
      font-size: 12px;
      color: var(--muted);
    }
    .ui-field__error {
      font-size: 12px;
      font-weight: var(--font-weight-semibold);
      color: var(--badge-late-fg);
    }
  `,
  template: `
    <label class="ui-field__label" [attr.for]="controlId">{{ label() }}</label>
    <ng-content />
    @if (hint()) {
      <div class="ui-field__hint" [id]="hintId">{{ hint() }}</div>
    }
    @if (error()) {
      <div class="ui-field__error" role="alert" [id]="errorId">{{ error() }}</div>
    }
  `,
})
export class Field {
  readonly label = input.required<string>();
  readonly hint = input<string>();
  readonly error = input<string>();

  private readonly base = `ui-field-${++proximo}`;
  readonly controlId = `${this.base}-control`;
  readonly hintId = `${this.base}-hint`;
  readonly errorId = `${this.base}-error`;

  /** Ids das mensagens que descrevem o controle agora, separados por espaço. */
  readonly describedBy = computed(
    () =>
      [this.hint() ? this.hintId : '', this.error() ? this.errorId : '']
        .filter(Boolean)
        .join(' ') || null,
  );
}

/** Liga um controle nativo (`input`, `select`, `textarea`) ao `ui-field` que o envolve. */
@Directive({
  selector: '[uiFieldControl]',
  host: {
    '[attr.id]': 'field?.controlId ?? null',
    '[attr.aria-describedby]': 'field?.describedBy() ?? null',
    '[attr.aria-invalid]': 'field?.error() ? "true" : null',
  },
})
export class FieldControl {
  protected readonly field = inject(Field, { optional: true });
}
