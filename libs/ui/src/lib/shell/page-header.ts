import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Crumb {
  readonly label: string;
  /** Sem `link`, o item é só texto. O último item é sempre a página atual. */
  readonly link?: string;
}

/** Cabeçalho de tela: trilha, título, subtítulo, ações (slot `[actions]`) e o botão "?" do tutorial. */
@Component({
  selector: 'ui-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styles: `
    :host {
      display: block;
    }
    .ui-page-header {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .ui-page-header--help {
      padding-right: 56px;
    }
    ol {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 13px;
      color: var(--muted);
    }
    ol a {
      color: inherit;
    }
    ol [aria-current='page'] {
      color: var(--ink);
      font-weight: var(--font-weight-semibold);
    }
    .ui-page-header__row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
    }
    h1 {
      margin: 0;
      font-size: 26px;
      font-weight: var(--font-weight-bold);
    }
    p {
      margin: 4px 0 0;
      font-size: 14px;
      color: var(--muted);
    }
    .ui-page-header__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    .ui-page-header__help {
      position: absolute;
      top: 0;
      right: 0;
      width: 44px;
      height: 44px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-semibold) 15px var(--font);
      cursor: pointer;
    }
    .ui-page-header__help:focus-visible,
    ol a:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
  `,
  template: `
    <div class="ui-page-header" [class.ui-page-header--help]="help()">
      @if (breadcrumb().length > 0) {
        <nav aria-label="Você está em">
          <ol>
            @for (item of breadcrumb(); track $index; let ultimo = $last) {
              <li>
                @if (item.link && !ultimo) {
                  <a [routerLink]="item.link">{{ item.label }}</a>
                } @else {
                  <span [attr.aria-current]="ultimo ? 'page' : null">{{ item.label }}</span>
                }
                @if (!ultimo) {
                  <span aria-hidden="true"> /</span>
                }
              </li>
            }
          </ol>
        </nav>
      }
      <div class="ui-page-header__row">
        <div>
          <h1>{{ heading() }}</h1>
          @if (subtitle()) {
            <p>{{ subtitle() }}</p>
          }
        </div>
        <div class="ui-page-header__actions"><ng-content select="[actions]" /></div>
      </div>
      @if (help()) {
        <button
          type="button"
          class="ui-page-header__help"
          aria-label="Ajuda"
          (click)="helpClick.emit()"
        >
          ?
        </button>
      }
    </div>
  `,
})
export class PageHeader {
  readonly heading = input.required<string>();
  readonly subtitle = input<string>();
  readonly breadcrumb = input<readonly Crumb[]>([]);
  /** Mostra o botão "?" que abre o tutorial da tela (`helpClick`). */
  readonly help = input(true);
  readonly helpClick = output<void>();
}
