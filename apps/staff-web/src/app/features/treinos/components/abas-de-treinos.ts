import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Abas "Fichas", "Modelos" e "Biblioteca", que as três telas de `/treinos` repetem. */
@Component({
  selector: 'app-abas-de-treinos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styles: `
    :host {
      display: block;
    }
    nav {
      display: flex;
      gap: 6px;
      border-bottom: 1px solid var(--border);
    }
    a {
      padding: 10px 16px;
      color: var(--muted);
      font-size: 14px;
      text-decoration: none;
    }
    a[aria-current='page'] {
      margin-bottom: -1px;
      border-bottom: 3px solid var(--accent);
      color: var(--ink);
      font-weight: var(--font-weight-bold);
    }
    a:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: -2px;
    }
  `,
  template: `
    <nav aria-label="Seções de treinos" data-tutorial="abas">
      <a routerLink="/treinos/fichas" [attr.aria-current]="ativa() === 'fichas' ? 'page' : null">
        Fichas
      </a>
      <a routerLink="/treinos/modelos" [attr.aria-current]="ativa() === 'modelos' ? 'page' : null">
        Modelos
      </a>
      <a
        routerLink="/treinos/biblioteca"
        [attr.aria-current]="ativa() === 'biblioteca' ? 'page' : null"
      >
        Biblioteca
      </a>
    </nav>
  `,
})
export class AbasDeTreinos {
  readonly ativa = input.required<'fichas' | 'modelos' | 'biblioteca'>();
}
