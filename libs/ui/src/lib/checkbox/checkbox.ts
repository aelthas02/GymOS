import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/**
 * Caixa de seleção nativa, com o texto projetado como rótulo. A cor de destaque é `--accent-text`
 * (o acento escurecido para 4,5:1 sobre branco, ADR-014) em vez do verde fixo do protótipo, para
 * seguir o tema da academia e manter o contraste mínimo de 3:1 de componentes de interface.
 */
@Component({
  selector: 'ui-checkbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: inline-flex;
    }
    label {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
      font-size: 14px;
      cursor: pointer;
    }
    input {
      flex: none;
      width: 22px;
      height: 22px;
      margin: 0;
      accent-color: var(--accent-text);
      cursor: inherit;
    }
    input:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    label:has(input:disabled) {
      cursor: not-allowed;
      opacity: 0.55;
    }
  `,
  template: `
    <label>
      <input
        type="checkbox"
        [checked]="checked()"
        [indeterminate]="indeterminate()"
        [disabled]="disabled()"
        (change)="alterar($event)"
      />
      <span><ng-content /></span>
    </label>
  `,
})
export class Checkbox {
  readonly checked = model(false);
  readonly indeterminate = model(false);
  readonly disabled = input(false);

  protected alterar(evento: Event): void {
    this.indeterminate.set(false);
    this.checked.set((evento.target as HTMLInputElement).checked);
  }
}
