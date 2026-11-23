import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { mediaQueries } from '../../../styles/breakpoints';
import { IconButton } from '../icon-button/icon-button';
import { Modal } from '../modal/modal';
import { SidebarNav, type NavSection } from './sidebar-nav';

export type ShellMode = 'desktop' | 'tablet' | 'mobile';

/**
 * Moldura do painel: menu lateral completo no desktop, recolhido em ícones no tablet e numa gaveta
 * no mobile. O conteúdo da tela entra no `<main>`.
 */
@Component({
  selector: 'ui-app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SidebarNav, IconButton, Modal],
  styles: `
    :host {
      display: flex;
      min-height: 100vh;
      min-height: 100dvh;
      background: var(--page);
      color: var(--ink);
    }
    :host(.ui-shell--mobile) {
      flex-direction: column;
    }
    .ui-shell__side {
      position: sticky;
      top: 0;
      flex: none;
      align-self: flex-start;
      height: 100vh;
      height: 100dvh;
    }
    .ui-shell__topbar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 12px;
      background: var(--ink);
      color: var(--on-ink);
      font-size: 18px;
      font-weight: var(--font-weight-bold);
    }
    main {
      display: flex;
      flex: 999 1 560px;
      flex-direction: column;
      gap: 22px;
      min-width: 0;
      padding: 24px var(--page-padding) var(--page-padding);
    }
    main:focus {
      outline: none;
    }
    :host(.ui-shell--mobile) main {
      padding: 16px;
    }
    .ui-shell__skip {
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 300;
      padding: 10px 16px;
      border: 0;
      border-radius: var(--radius-control);
      background: var(--ink);
      color: var(--on-ink);
      font: var(--font-weight-semibold) 14px var(--font);
      clip-path: inset(50%);
      width: 1px;
      height: 1px;
      overflow: hidden;
    }
    .ui-shell__skip:focus {
      clip-path: none;
      width: auto;
      height: auto;
    }
  `,
  host: {
    '[class.ui-shell--mobile]': 'modo() === "mobile"',
  },
  template: `
    <button type="button" class="ui-shell__skip" (click)="irParaOConteudo()">
      Ir para o conteúdo
    </button>

    @if (modo() === 'mobile') {
      <div class="ui-shell__topbar">
        <ui-icon-button icon="menu" label="Abrir menu" (click)="menuAberto.set(true)" />
        {{ brand() }}
      </div>
      <ui-modal [(open)]="menuAberto" variant="drawer" heading="Menu">
        <ui-sidebar-nav
          [sections]="sections()"
          [brand]="brand()"
          (navigate)="menuAberto.set(false)"
        />
      </ui-modal>
    } @else {
      <div class="ui-shell__side">
        <ui-sidebar-nav
          [sections]="sections()"
          [brand]="brand()"
          [collapsed]="modo() === 'tablet'"
        />
      </div>
    }

    <main #conteudo tabindex="-1"><ng-content /></main>
  `,
})
export class AppShell {
  readonly sections = input.required<readonly NavSection[]>();
  readonly brand = input('GymOS');

  protected readonly menuAberto = signal(false);
  protected readonly modo = toSignal(
    inject(BreakpointObserver)
      .observe([mediaQueries.mobile, mediaQueries.tablet])
      .pipe(
        map((estado): ShellMode => {
          if (estado.breakpoints[mediaQueries.mobile]) return 'mobile';
          return estado.breakpoints[mediaQueries.tablet] ? 'tablet' : 'desktop';
        }),
      ),
    { initialValue: 'desktop' as ShellMode },
  );

  private readonly conteudo = viewChild.required<ElementRef<HTMLElement>>('conteudo');

  constructor() {
    // A gaveta só existe no mobile: ao sair dele, ela volta fechada.
    effect(() => {
      if (this.modo() !== 'mobile') this.menuAberto.set(false);
    });
  }

  protected irParaOConteudo(): void {
    this.conteudo().nativeElement.focus();
  }
}
