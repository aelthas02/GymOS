import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../icon/icon';
import { injectIsActive } from '../router/active-link';

export interface BottomTab {
  readonly label: string;
  readonly link: string;
  readonly icon: string;
  /** `true` para o Início: só fica ativo na rota exata. */
  readonly exact?: boolean;
}

/** Barra de baixo do app do aluno: 5 abas, a ativa com a pílula do acento. */
@Component({
  selector: 'ui-bottom-tab-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  styles: `
    :host {
      display: block;
    }
    nav {
      display: flex;
      padding: 8px 8px max(22px, var(--safe-bottom));
      border-top: 1px solid var(--border);
      background: var(--surface);
    }
    a {
      display: flex;
      flex: 1;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      min-height: 52px;
      color: var(--muted);
      font-size: 11px;
      font-weight: var(--font-weight-medium);
      text-decoration: none;
    }
    a[aria-current='page'] {
      color: var(--ink);
      font-weight: var(--font-weight-bold);
    }
    a:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: -2px;
      border-radius: var(--radius-control);
    }
    .ui-tab-bar__pill {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 26px;
      border-radius: 13px;
      background: var(--accent);
      color: var(--accent-contrast);
    }
  `,
  template: `
    <nav aria-label="Menu do aluno">
      @for (aba of abas(); track aba.link) {
        <a [routerLink]="aba.link" [attr.aria-current]="aba.ativa ? 'page' : null">
          @if (aba.ativa) {
            <span class="ui-tab-bar__pill"><ui-icon [name]="aba.icon" [size]="18" /></span>
          } @else {
            <ui-icon [name]="aba.icon" [size]="22" />
          }
          {{ aba.label }}
        </a>
      }
    </nav>
  `,
})
export class BottomTabBar {
  readonly tabs = input.required<readonly BottomTab[]>();

  private readonly ehAtivo = injectIsActive();

  protected readonly abas = computed(() =>
    this.tabs().map((aba) => ({ ...aba, ativa: this.ehAtivo(aba.link, aba.exact ?? false) })),
  );
}
