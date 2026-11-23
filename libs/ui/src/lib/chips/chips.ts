import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface ChipOption {
  readonly value: string;
  readonly label: string;
  /** Contador do filtro ("Em dia 289"); zero também aparece. */
  readonly count?: number;
}

/** Filtros em pílulas com contador. Seleção múltipla por padrão; `multiple=false` troca a escolha. */
@Component({
  selector: 'ui-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .ui-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .ui-chip {
      min-height: 40px;
      padding: 0 16px;
      border: 1px solid var(--border);
      border-radius: 20px;
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-semibold) 13px var(--font);
      cursor: pointer;
    }
    .ui-chip--on {
      border-color: var(--ink);
      background: var(--ink);
      color: var(--on-ink);
    }
    .ui-chip:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .ui-chip__count {
      opacity: 0.7;
    }
  `,
  template: `
    <div class="ui-chips" role="group" [attr.aria-label]="label()">
      @for (opcao of options(); track opcao.value) {
        <button
          type="button"
          class="ui-chip"
          [class.ui-chip--on]="values().includes(opcao.value)"
          [attr.aria-pressed]="values().includes(opcao.value)"
          (click)="alternar(opcao.value)"
        >
          {{ opcao.label }}
          @if (opcao.count !== undefined) {
            &ngsp;<span class="ui-chip__count">{{ opcao.count }}</span>
          }
        </button>
      }
    </div>
  `,
})
export class Chips {
  readonly options = input.required<readonly ChipOption[]>();
  readonly values = model<readonly string[]>([]);
  readonly multiple = input(true);
  /** Nome do grupo para leitor de tela. */
  readonly label = input<string>();

  protected alternar(valor: string): void {
    const atual = this.values();

    if (!this.multiple()) {
      this.values.set([valor]);
    } else if (atual.includes(valor)) {
      this.values.set(atual.filter((item) => item !== valor));
    } else {
      this.values.set([...atual, valor]);
    }
  }
}
