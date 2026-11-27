import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ChaveDePeriodo } from '../models/financeiro';
import { PERIODOS_DO_FINANCEIRO } from '../utils/financeiro';

/** Os chips de período ("Hoje" a "Personalizado"); `personalizado` só aparece quando a tela o aceita. */
@Component({
  selector: 'app-chips-de-periodo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
    .chip {
      padding: 8px 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-semibold) 13px var(--font);
      white-space: nowrap;
      cursor: pointer;
    }
    .chip--ativo {
      border-color: var(--ink);
      background: var(--ink);
      color: var(--on-ink);
    }
    .chip:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
  `,
  template: `
    @for (periodo of periodos(); track periodo.chave) {
      <button
        type="button"
        class="chip"
        [class.chip--ativo]="periodo.chave === ativo()"
        [attr.aria-pressed]="periodo.chave === ativo()"
        (click)="escolher.emit(periodo.chave)"
      >
        {{ periodo.rotulo }}
      </button>
    }
  `,
})
export class ChipsDePeriodo {
  readonly ativo = input.required<ChaveDePeriodo>();
  readonly periodos = input(PERIODOS_DO_FINANCEIRO);
  readonly escolher = output<ChaveDePeriodo>();
}
