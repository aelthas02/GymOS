import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../icon/icon';

/** Botão só de ícone: 36 px visuais dentro de uma área de toque de 44 px. O rótulo é obrigatório. */
@Component({
  selector: 'ui-icon-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--surface);
      color: var(--ink);
      cursor: pointer;
    }
    button:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
  `,
  template: `
    <button type="button" [attr.aria-label]="label()" [disabled]="disabled()">
      <ui-icon [name]="icon()" />
    </button>
  `,
})
export class IconButton {
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly disabled = input(false);
}
