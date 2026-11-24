import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type WeekGridVariant = 'colunas' | 'cartoes';

export interface WeekItemLine {
  readonly text: string;
  readonly tone?: 'muted' | 'danger';
}

export interface WeekItem {
  readonly id: string;
  readonly title: string;
  readonly time?: string;
  readonly lines?: readonly WeekItemLine[];
  /** Fundo do cartão: qualquer cor CSS, de preferência um token (`var(--chart-2)`). */
  readonly color: string;
  /** Contorno de alerta, para o que precisa de atenção (aula sem professor). */
  readonly alert?: boolean;
}

export interface WeekDay {
  readonly label: string;
  readonly items: readonly WeekItem[];
}

/**
 * Semana em cartões por dia. `colunas` é a grade de aulas (cabeçalho sublinhado e cartões
 * empilhados); `cartoes` é o calendário de marketing (um quadro por dia). Com `interactive`, cada
 * cartão é um botão que emite `itemSelected`.
 */
@Component({
  selector: 'ui-week-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  styles: `
    :host {
      display: block;
    }
    .ui-week {
      display: flex;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .ui-week__dia {
      flex: 1 1 80px;
      min-width: 0;
    }
    .ui-week__titulo {
      color: var(--muted);
      font-size: 12px;
      font-weight: var(--font-weight-bold);
    }
    .ui-week--colunas .ui-week__titulo {
      padding-bottom: 4px;
      border-bottom: 1px solid var(--border);
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .ui-week--cartoes {
      flex-wrap: wrap;
    }
    .ui-week--cartoes .ui-week__dia {
      flex-basis: 110px;
      min-height: 130px;
      padding: 10px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
    }
    .ui-week__itens {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .ui-week__item {
      display: block;
      box-sizing: border-box;
      width: 100%;
      margin-top: 8px;
      padding: 8px 10px;
      border: 0;
      border-radius: 10px;
      color: var(--ink);
      font: inherit;
      text-align: left;
    }
    .ui-week--cartoes .ui-week__item {
      margin-top: 6px;
      padding: 6px 8px;
      border-radius: 8px;
      font-size: 12px;
    }
    .ui-week__item--alerta {
      outline: 2px solid color-mix(in srgb, var(--chart-negative) 60%, var(--surface));
    }
    button.ui-week__item {
      cursor: pointer;
    }
    button.ui-week__item:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .ui-week__hora {
      font-size: 12px;
      font-weight: var(--font-weight-bold);
    }
    .ui-week__nome {
      font-size: 13px;
      font-weight: var(--font-weight-bold);
    }
    .ui-week--cartoes .ui-week__nome {
      font-size: 12px;
      font-weight: var(--font-weight-semibold);
    }
    .ui-week__linha {
      color: var(--muted);
      font-size: 11px;
    }
    .ui-week--cartoes .ui-week__linha {
      color: var(--ink);
      font-size: 12px;
    }
    .ui-week__linha--perigo {
      color: var(--badge-late-fg);
      font-weight: var(--font-weight-bold);
    }
  `,
  template: `
    <ng-template #cartao let-item>
      @if (item.time) {
        <div class="ui-week__hora">{{ item.time }}</div>
      }
      <div class="ui-week__nome">{{ item.title }}</div>
      @for (linha of item.lines ?? []; track $index) {
        <div class="ui-week__linha" [class.ui-week__linha--perigo]="linha.tone === 'danger'">
          {{ linha.text }}
        </div>
      }
    </ng-template>

    <ul class="ui-week" [class]="'ui-week--' + variant()" [attr.aria-label]="label()">
      @for (dia of days(); track dia.label; let i = $index) {
        <li class="ui-week__dia">
          <div class="ui-week__titulo" [id]="'ui-week-dia-' + i">{{ dia.label }}</div>
          <ul class="ui-week__itens" [attr.aria-labelledby]="'ui-week-dia-' + i">
            @for (item of dia.items; track item.id) {
              <li>
                @if (interactive()) {
                  <button
                    type="button"
                    class="ui-week__item"
                    [class.ui-week__item--alerta]="item.alert"
                    [style.background-color]="item.color"
                    (click)="itemSelected.emit(item)"
                  >
                    <ng-container *ngTemplateOutlet="cartao; context: { $implicit: item }" />
                  </button>
                } @else {
                  <div
                    class="ui-week__item"
                    [class.ui-week__item--alerta]="item.alert"
                    [style.background-color]="item.color"
                  >
                    <ng-container *ngTemplateOutlet="cartao; context: { $implicit: item }" />
                  </div>
                }
              </li>
            }
          </ul>
        </li>
      }
    </ul>
  `,
})
export class WeekGrid {
  readonly days = input.required<readonly WeekDay[]>();
  readonly variant = input<WeekGridVariant>('colunas');
  readonly interactive = input(false);
  readonly label = input<string>();

  readonly itemSelected = output<WeekItem>();
}
