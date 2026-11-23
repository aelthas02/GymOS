import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectIsActive } from '../router/active-link';

export interface TabItem {
  readonly label: string;
  /** Rota absoluta da aba. */
  readonly link: string;
  readonly count?: number;
}

/**
 * Abas como navegação por rota: cada aba é um link e a ativa vem do router, não de estado local.
 * Setas, Home e End movem o foco entre as abas; Enter abre a aba focada (ativação manual).
 */
@Component({
  selector: 'ui-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styles: `
    :host {
      display: block;
    }
    .ui-tabs {
      display: flex;
      gap: 6px;
      border-bottom: 1px solid var(--border);
      overflow-x: auto;
    }
    a {
      margin-bottom: -1px;
      padding: 10px 16px;
      border-bottom: 3px solid transparent;
      color: var(--muted);
      font-size: 14px;
      text-decoration: none;
      white-space: nowrap;
    }
    a[aria-selected='true'] {
      border-bottom-color: var(--accent);
      color: var(--ink);
      font-weight: var(--font-weight-bold);
    }
    a:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: -2px;
    }
    .ui-tabs__count {
      margin-left: 6px;
      opacity: 0.7;
    }
  `,
  template: `
    <div class="ui-tabs" role="tablist" [attr.aria-label]="label()">
      @for (item of items(); track item.link; let i = $index) {
        <a
          role="tab"
          [routerLink]="item.link"
          [attr.aria-selected]="ativa() === i"
          [attr.tabindex]="indiceDoTab() === i ? 0 : -1"
          (keydown)="teclado($event, i)"
        >
          {{ item.label }}
          @if (item.count !== undefined) {
            &ngsp;<span class="ui-tabs__count">{{ item.count }}</span>
          }
        </a>
      }
    </div>
  `,
})
export class Tabs {
  readonly items = input.required<readonly TabItem[]>();
  readonly label = input<string>();
  /** `true`: a aba só fica ativa com a rota igual; `false`: também em rotas filhas. */
  readonly exact = input(true);

  private readonly ehAtivo = injectIsActive();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Índice da aba que corresponde à rota atual, ou -1. */
  protected readonly ativa = computed(() =>
    this.items().findIndex((item) => this.ehAtivo(item.link, this.exact())),
  );

  /** Só uma aba entra na ordem do Tab: a ativa, ou a primeira quando nenhuma é. */
  protected readonly indiceDoTab = computed(() => Math.max(this.ativa(), 0));

  protected teclado(evento: KeyboardEvent, indice: number): void {
    const total = this.items().length;
    const destinos: Record<string, number> = {
      ArrowRight: (indice + 1) % total,
      ArrowLeft: (indice - 1 + total) % total,
      Home: 0,
      End: total - 1,
    };
    const destino = destinos[evento.key];

    if (destino === undefined) return;

    evento.preventDefault();
    this.host.nativeElement.querySelectorAll<HTMLElement>('[role=tab]')[destino]?.focus();
  }
}
