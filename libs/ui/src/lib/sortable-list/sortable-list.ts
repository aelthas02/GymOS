import { CdkDrag, CdkDragHandle, CdkDropList, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  contentChild,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  TemplateRef,
  viewChildren,
} from '@angular/core';

/** Contexto do `ng-template` de cada item: `let-item` e `let-i="index"`. */
export interface SortableItemContext<T> {
  readonly $implicit: T;
  readonly index: number;
}

/**
 * Lista reordenável. Arrasta-se pela alça com o ponteiro; no teclado, a alça focada move o item
 * com Alt+↑ e Alt+↓. A lista não muda sozinha: emite `orderChange` com a nova ordem e quem usa
 * atualiza `items`. O leitor de tela ouve a nova posição ("Supino reto, posição 2 de 5").
 * O conteúdo de cada item vem do `ng-template` projetado; os itens precisam ser distintos entre si.
 */
@Component({
  selector: 'ui-sortable-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropList, CdkDrag, CdkDragHandle, NgTemplateOutlet],
  styles: `
    :host {
      display: block;
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-top: 1px solid var(--divider);
      background: var(--surface);
    }
    .ui-sortable__alca {
      flex: none;
      width: 30px;
      min-height: 44px;
      padding: 0;
      border: 0;
      background: none;
      color: var(--muted);
      font-weight: var(--font-weight-bold);
      cursor: grab;
    }
    .ui-sortable__alca:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .ui-sortable__conteudo {
      flex: 1 1 auto;
      min-width: 0;
    }
    .cdk-drag-placeholder {
      opacity: 0.35;
    }
    .cdk-drop-list-dragging .ui-sortable__item:not(.cdk-drag-placeholder) {
      transition: transform 150ms ease;
    }
    .ui-sortable__anuncio {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
  template: `
    <ul
      cdkDropList
      cdkDropListLockAxis="y"
      [attr.aria-label]="label()"
      (cdkDropListDropped)="soltar($event)"
    >
      @for (item of items(); track item; let i = $index) {
        <li cdkDrag class="ui-sortable__item">
          <button
            #alca
            cdkDragHandle
            type="button"
            class="ui-sortable__alca"
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
            [attr.aria-label]="'Reordenar ' + nome(item) + '. Alt e setas movem o item.'"
            (keydown)="teclado($event, i)"
          >
            <span aria-hidden="true">&#8942;&#8942;</span>
          </button>
          <div class="ui-sortable__conteudo">
            <ng-container *ngTemplateOutlet="modelo(); context: { $implicit: item, index: i }" />
          </div>
        </li>
      }
    </ul>
    <div class="ui-sortable__anuncio" role="status" aria-live="polite">{{ anuncio() }}</div>
  `,
})
export class SortableList<T> {
  readonly items = input.required<readonly T[]>();
  /** Nome do item para o leitor de tela; sem ele, usa o texto do próprio item. */
  readonly itemLabel = input<(item: T) => string>((item) => String(item));
  readonly label = input<string>();

  readonly orderChange = output<readonly T[]>();

  protected readonly modelo =
    contentChild.required<TemplateRef<SortableItemContext<T>>>(TemplateRef);
  protected readonly anuncio = signal('');

  private readonly alcas = viewChildren<ElementRef<HTMLElement>>('alca');
  private readonly injector = inject(Injector);

  protected nome(item: T): string {
    return this.itemLabel()(item);
  }

  protected teclado(evento: KeyboardEvent, indice: number): void {
    if (!evento.altKey) return;

    const passo = evento.key === 'ArrowUp' ? -1 : evento.key === 'ArrowDown' ? 1 : 0;
    if (passo === 0) return;

    evento.preventDefault();
    this.mover(indice, indice + passo, true);
  }

  protected soltar(evento: CdkDragDrop<unknown>): void {
    this.mover(evento.previousIndex, evento.currentIndex, false);
  }

  private mover(de: number, para: number, devolverFoco: boolean): void {
    const itens = [...this.items()];
    const item = itens[de];

    if (item === undefined || para < 0 || para >= itens.length || para === de) return;

    itens.splice(de, 1);
    itens.splice(para, 0, item);
    this.anuncio.set(`${this.nome(item)}, posição ${para + 1} de ${itens.length}`);
    this.orderChange.emit(itens);

    if (devolverFoco) {
      // O foco acompanha o item depois que quem usa aplicar a nova ordem.
      afterNextRender(
        () => {
          if (this.items()[para] === item) this.alcas()[para]?.nativeElement.focus();
        },
        { injector: this.injector },
      );
    }
  }
}
