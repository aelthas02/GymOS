import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Abas "Lista de alunos" e "Importar alunos", que as quatro telas de `/alunos` repetem. */
@Component({
  selector: 'app-abas-de-alunos',
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
    .abas__extra {
      align-self: center;
      margin-left: auto;
      padding-right: 4px;
    }
    a:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: -2px;
    }
  `,
  template: `
    <nav aria-label="Seções de alunos">
      <a routerLink="/alunos" [attr.aria-current]="ativa() === 'lista' ? 'page' : null">
        Lista de alunos
      </a>
      <a routerLink="/alunos/importar" [attr.aria-current]="ativa() === 'importar' ? 'page' : null">
        Importar alunos
      </a>
      <span class="abas__extra"><ng-content /></span>
    </nav>
  `,
})
export class AbasDeAlunos {
  readonly ativa = input.required<'lista' | 'importar'>();
}
