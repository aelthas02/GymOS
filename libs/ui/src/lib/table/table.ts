import { ScrollingModule } from '@angular/cdk/scrolling';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  Directive,
  inject,
  input,
  model,
  output,
  TemplateRef,
} from '@angular/core';
import { Icon } from '../icon/icon';

export interface TableColumn {
  readonly key: string;
  readonly label: string;
  readonly sortable?: boolean;
  /** Largura da coluna na grade, como no protótipo: `minmax(190px, 1.4fr)`. */
  readonly width?: string;
}

export type SortDirection = 'asc' | 'desc';

export interface TableSort {
  readonly column: string;
  readonly direction: SortDirection;
}

/** Acima deste número de linhas a tabela passa a usar o viewport virtual do CDK. */
export const TABLE_VIRTUAL_THRESHOLD = 100;

/** Template de uma célula: `<ng-template uiTableCell="nome" let-row let-valor="value">`. */
@Directive({ selector: 'ng-template[uiTableCell]' })
export class TableCell {
  readonly column = input.required<string>({ alias: 'uiTableCell' });
  readonly template = inject<TemplateRef<TableCellContext>>(TemplateRef);
}

export interface TableCellContext {
  $implicit: object;
  value: unknown;
}

const ariaSort = { asc: 'ascending', desc: 'descending' } as const;

/**
 * Tabela de dados. Ordenação e paginação são do servidor: o componente só emite `sortChange` e
 * `pageChange`. Acima de 100 linhas vira lista virtual; no tablet a rolagem horizontal fica numa
 * região focável, e a página em volta não rola para os lados.
 */
@Component({
  selector: 'ui-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, ScrollingModule, Icon],
  styles: `
    :host {
      display: block;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
    }
    .ui-table__scroll {
      overflow-x: auto;
    }
    .ui-table__scroll:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: -2px;
    }
    .ui-table {
      min-width: var(--ui-table-min-width, 860px);
    }
    .ui-table__row {
      display: grid;
      grid-template-columns: var(--ui-table-columns);
      gap: 12px;
      align-items: center;
      padding: 12px 16px;
      border-top: 1px solid var(--divider);
    }
    .ui-table__row--head {
      padding: 10px 16px;
      border-top: 0;
      font-size: 12px;
      font-weight: var(--font-weight-semibold);
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: var(--muted);
    }
    .ui-table__sort {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      letter-spacing: inherit;
      text-transform: inherit;
      cursor: pointer;
    }
    .ui-table__sort:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .ui-table__cell {
      min-width: 0;
      font-size: 14px;
    }
    cdk-virtual-scroll-viewport {
      height: var(--ui-table-max-height, 520px);
    }
    .ui-table__footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 16px;
      border-top: 1px solid var(--divider);
      font-size: 13px;
      color: var(--muted);
    }
    .ui-table__pager {
      display: flex;
      gap: 8px;
    }
    .ui-table__pager button {
      min-height: 40px;
      padding: 0 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-semibold) 13px var(--font);
      cursor: pointer;
    }
    .ui-table__pager button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
    .ui-table__pager button:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
  `,
  host: {
    '[style.--ui-table-columns]': 'grade()',
    '[style.--ui-table-min-width]': 'minWidth()',
    '[style.--ui-table-max-height]': 'maxHeight()',
  },
  template: `
    <div class="ui-table__scroll" role="region" tabindex="0" [attr.aria-label]="label()">
      <div
        class="ui-table"
        role="table"
        [attr.aria-label]="label()"
        [attr.aria-rowcount]="total() ?? rows().length"
      >
        <div class="ui-table__row ui-table__row--head" role="row">
          @for (coluna of columns(); track coluna.key) {
            <div role="columnheader" [attr.aria-sort]="ordem(coluna)">
              @if (coluna.sortable) {
                <button type="button" class="ui-table__sort" (click)="ordenar(coluna.key)">
                  {{ coluna.label }}
                  <ui-icon [name]="icone(coluna.key)" [size]="14" />
                </button>
              } @else {
                {{ coluna.label }}
              }
            </div>
          }
        </div>

        @if (virtual()) {
          <cdk-virtual-scroll-viewport [itemSize]="rowHeight()">
            <div *cdkVirtualFor="let linha of rows()" class="ui-table__row" role="row">
              <ng-container *ngTemplateOutlet="celulas; context: { $implicit: linha }" />
            </div>
          </cdk-virtual-scroll-viewport>
        } @else {
          @for (linha of rows(); track $index) {
            <div class="ui-table__row" role="row">
              <ng-container *ngTemplateOutlet="celulas; context: { $implicit: linha }" />
            </div>
          }
        }
      </div>
    </div>

    <ng-template #celulas let-linha>
      @for (coluna of columns(); track coluna.key) {
        <div class="ui-table__cell" role="cell">
          @if (slots().get(coluna.key); as slot) {
            <ng-container
              *ngTemplateOutlet="slot; context: { $implicit: linha, value: linha[coluna.key] }"
            />
          } @else {
            {{ linha[coluna.key] }}
          }
        </div>
      }
    </ng-template>

    @if (total() !== undefined) {
      <div class="ui-table__footer">
        <span>Mostrando {{ de() }} a {{ ate() }} de {{ total() }}</span>
        <div class="ui-table__pager">
          <button type="button" [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)">
            Anterior
          </button>
          <button
            type="button"
            [disabled]="ate() >= (total() ?? 0)"
            (click)="pageChange.emit(page() + 1)"
          >
            Próxima
          </button>
        </div>
      </div>
    }
  `,
})
export class Table {
  readonly columns = input.required<readonly TableColumn[]>();
  readonly rows = input.required<readonly object[]>();
  /** Nome da tabela para leitor de tela. */
  readonly label = input.required<string>();
  /** Ordem atual (a que o servidor aplicou). `sortChange` avisa quando o usuário pede outra. */
  readonly sort = model<TableSort | null>(null);

  /** Total de registros no servidor; sem ele não há rodapé de paginação. */
  readonly total = input<number>();
  readonly page = input(1);
  readonly pageSize = input(20);
  readonly pageChange = output<number>();

  /** Altura de cada linha, necessária ao viewport virtual. */
  readonly rowHeight = input(61);
  readonly virtualThreshold = input(TABLE_VIRTUAL_THRESHOLD);
  readonly minWidth = input('860px');
  readonly maxHeight = input('520px');

  private readonly cells = contentChildren(TableCell);

  protected readonly slots = computed(
    () => new Map(this.cells().map((cell) => [cell.column(), cell.template] as const)),
  );
  protected readonly virtual = computed(() => this.rows().length > this.virtualThreshold());
  protected readonly grade = computed(() =>
    this.columns()
      .map((coluna) => coluna.width ?? 'minmax(0, 1fr)')
      .join(' '),
  );

  protected readonly de = computed(() =>
    this.total() ? (this.page() - 1) * this.pageSize() + 1 : 0,
  );
  protected readonly ate = computed(() =>
    Math.min(this.page() * this.pageSize(), this.total() ?? 0),
  );

  protected ordem(coluna: TableColumn): 'ascending' | 'descending' | 'none' | null {
    if (!coluna.sortable) return null;
    const atual = this.sort();
    return atual?.column === coluna.key ? ariaSort[atual.direction] : 'none';
  }

  protected icone(chave: string): string {
    const atual = this.sort();
    if (atual?.column !== chave) return 'sort';
    return atual.direction === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  protected ordenar(coluna: string): void {
    const atual = this.sort();
    const direction: SortDirection =
      atual?.column === coluna && atual.direction === 'asc' ? 'desc' : 'asc';
    this.sort.set({ column: coluna, direction });
  }
}
