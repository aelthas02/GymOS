import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  model,
  viewChild,
} from '@angular/core';
import { IconButton } from '../icon-button/icon-button';

export type ModalVariant = 'modal' | 'drawer';

const focaveis =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let proximo = 0;

/**
 * Janela modal ou gaveta lateral. Prende o foco, fecha com Esc (e com clique no fundo, se
 * `dismissable`), trava a rolagem da página e devolve o foco a quem abriu. Conteúdo no slot padrão;
 * ações no slot `[footer]`.
 */
@Component({
  selector: 'ui-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButton],
  host: {
    '(document:keydown)': 'teclado($event)',
    '(document:focusin)': 'focoMudou($event)',
  },
  styles: `
    .ui-modal__backdrop {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: color-mix(in srgb, var(--ink) 55%, transparent);
    }
    .ui-modal__backdrop--drawer {
      justify-content: flex-end;
      padding: 0;
    }
    .ui-modal__panel {
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: min(520px, 100%);
      max-height: 100%;
      overflow: auto;
      padding: 22px;
      border-radius: var(--radius-card);
      background: var(--surface);
      color: var(--ink);
    }
    .ui-modal__panel--drawer {
      width: min(440px, 100%);
      height: 100%;
      border-radius: var(--radius-card) 0 0 var(--radius-card);
    }
    .ui-modal__panel:focus {
      outline: none;
    }
    .ui-modal__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: var(--font-weight-bold);
    }
    .ui-modal__footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    .ui-modal__footer:empty {
      display: none;
    }
  `,
  template: `
    @if (open()) {
      <div
        class="ui-modal__backdrop"
        role="presentation"
        [class.ui-modal__backdrop--drawer]="variant() === 'drawer'"
        (click)="aoClicarNoFundo($event)"
      >
        <div
          #painel
          class="ui-modal__panel"
          [class.ui-modal__panel--drawer]="variant() === 'drawer'"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          [attr.aria-labelledby]="tituloId"
        >
          <div class="ui-modal__header">
            <h2 [id]="tituloId">{{ heading() }}</h2>
            @if (dismissable()) {
              <ui-icon-button icon="close" label="Fechar" (click)="fechar()" />
            }
          </div>
          <div><ng-content /></div>
          <div class="ui-modal__footer"><ng-content select="[footer]" /></div>
        </div>
      </div>
    }
  `,
})
export class Modal {
  readonly open = model(false);
  readonly heading = input.required<string>();
  readonly variant = input<ModalVariant>('modal');
  /** `false` para fluxos que exigem uma resposta: Esc, fundo e o X deixam de fechar. */
  readonly dismissable = input(true);

  protected readonly tituloId = `ui-modal-${++proximo}-titulo`;

  private readonly documento = inject(DOCUMENT);
  private readonly painel = viewChild<ElementRef<HTMLElement>>('painel');
  private gatilho: HTMLElement | null = null;
  private estavaAberto = false;

  constructor() {
    effect(() => {
      const aberto = this.open();
      const painel = this.painel()?.nativeElement;

      if (aberto && painel && !this.estavaAberto) {
        this.estavaAberto = true;
        this.gatilho = this.documento.activeElement as HTMLElement | null;
        this.documento.body.style.overflow = 'hidden';
        (painel.querySelector<HTMLElement>(focaveis) ?? painel).focus();
      } else if (!aberto && this.estavaAberto) {
        this.encerrar();
      }
    });

    inject(DestroyRef).onDestroy(() => {
      if (this.estavaAberto) this.encerrar();
    });
  }

  protected fechar(): void {
    this.open.set(false);
  }

  protected aoClicarNoFundo(evento: MouseEvent): void {
    if (this.dismissable() && evento.target === evento.currentTarget) this.fechar();
  }

  protected teclado(evento: KeyboardEvent): void {
    const painel = this.painel()?.nativeElement;
    if (!this.open() || !painel) return;

    if (evento.key === 'Escape') {
      if (this.dismissable()) this.fechar();
      return;
    }

    if (evento.key !== 'Tab') return;

    const itens = [...painel.querySelectorAll<HTMLElement>(focaveis)];
    const primeiro = itens[0];
    const ultimo = itens.at(-1);
    const atual = this.documento.activeElement;
    if (!primeiro || !ultimo) {
      evento.preventDefault();
      return;
    }

    if (evento.shiftKey && (atual === primeiro || atual === painel)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && atual === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  protected focoMudou(evento: Event): void {
    const painel = this.painel()?.nativeElement;
    const alvo = this.documento.activeElement;
    if (!this.open() || !painel || (alvo && painel.contains(alvo))) return;

    evento.stopPropagation();
    (painel.querySelector<HTMLElement>(focaveis) ?? painel).focus();
  }

  private encerrar(): void {
    this.estavaAberto = false;
    this.documento.body.style.overflow = '';
    this.gatilho?.focus();
    this.gatilho = null;
  }
}
