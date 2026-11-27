import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../icon/icon';
import { injectIsActive } from '../router/active-link';

export interface NavItem {
  readonly label: string;
  readonly link: string;
  /** Ícone mostrado no menu recolhido (tablet). */
  readonly icon: string;
  /** `true`: ativo só na rota exata (o Início). Padrão: também nas rotas filhas. */
  readonly exact?: boolean;
  /** `false` esconde o item. Quem monta a lista resolve as flags e as permissões. */
  readonly visible?: boolean;
}

export interface NavSection {
  readonly title?: string;
  readonly items: readonly NavItem[];
}

/**
 * Menu lateral escuro do painel. Recebe a lista pronta (já filtrada por flags e permissões, ou com
 * `visible: false`) e não consulta flag nenhuma. Recolhido, mostra só os ícones.
 */
@Component({
  selector: 'ui-sidebar-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .ui-nav {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: var(--sidebar-width);
      height: 100%;
      padding: 24px 16px;
      background: var(--ink);
      color: var(--nav-fg);
    }
    .ui-nav--collapsed {
      width: 72px;
      padding-inline: 12px;
      align-items: center;
    }
    .ui-nav__brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 8px 18px;
      font-size: 18px;
      font-weight: var(--font-weight-bold);
      color: var(--on-ink);
    }
    .ui-nav__logo {
      flex: none;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: var(--accent);
    }
    .ui-nav__link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 11px 12px;
      border-radius: var(--radius-control);
      color: inherit;
      font-size: 14px;
      text-decoration: none;
    }
    .ui-nav--collapsed .ui-nav__link {
      justify-content: center;
      width: 44px;
      min-height: 44px;
      padding: 0;
    }
    .ui-nav__link--active {
      background: var(--accent);
      color: var(--accent-contrast);
      font-weight: var(--font-weight-semibold);
    }
    .ui-nav__link:focus-visible {
      outline: 2px solid var(--on-ink);
      outline-offset: 2px;
    }
    .ui-nav__section {
      margin: 14px 12px 6px;
      font-size: 11px;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: var(--nav-muted);
    }
    .ui-nav__divider {
      width: 28px;
      margin: 10px 0;
      border-top: 1px solid var(--nav-card-bg);
    }
    .ui-nav__help {
      margin-top: auto;
      padding: 14px 12px;
      border-radius: 12px;
      background: var(--nav-card-bg);
      color: var(--nav-card-fg);
      font-size: 13px;
      line-height: 1.4;
    }
    .ui-nav__help b {
      color: var(--on-ink);
    }
  `,
  template: `
    <nav class="ui-nav" [class.ui-nav--collapsed]="collapsed()" aria-label="Menu principal">
      <div class="ui-nav__brand">
        <span class="ui-nav__logo" aria-hidden="true"></span>
        <span [class.ui-sr-only]="collapsed()">{{ brand() }}</span>
      </div>

      @for (grupo of grupos(); track $index) {
        @if (grupo.title) {
          @if (collapsed()) {
            <div class="ui-nav__divider" aria-hidden="true"></div>
          } @else {
            <div class="ui-nav__section">{{ grupo.title }}</div>
          }
        }
        @for (item of grupo.itens; track item.link) {
          <a
            class="ui-nav__link"
            [class.ui-nav__link--active]="item.ativo"
            [routerLink]="item.link"
            [attr.aria-current]="item.ativo ? 'page' : null"
            [attr.title]="collapsed() ? item.label : null"
            (click)="navigate.emit()"
          >
            @if (collapsed()) {
              <ui-icon [name]="item.icon" [size]="20" />
            }
            <span [class.ui-sr-only]="collapsed()">{{ item.label }}</span>
          </a>
        }
      }

      @if (!collapsed()) {
        <div class="ui-nav__help">
          <b>{{ helpTitle() }}</b><br />{{ helpText() }}
        </div>
      }
    </nav>
  `,
})
export class SidebarNav {
  readonly sections = input.required<readonly NavSection[]>();
  readonly collapsed = input(false);
  readonly brand = input('GymOS');
  readonly helpTitle = input('Precisa de ajuda?');
  readonly helpText = input('Toque em "?" em qualquer tela para ver um mini tutorial.');
  /** Um item foi escolhido (a gaveta do mobile fecha por aqui). */
  readonly navigate = output<void>();

  private readonly ehAtivo = injectIsActive();

  protected readonly grupos = computed(() =>
    this.sections()
      .map((secao) => ({
        title: secao.title,
        itens: secao.items
          .filter((item) => item.visible !== false)
          .map((item) => ({ ...item, ativo: this.ehAtivo(item.link, item.exact ?? false) })),
      }))
      .filter((grupo) => grupo.itens.length > 0),
  );
}
