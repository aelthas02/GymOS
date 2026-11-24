import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  model,
  signal,
  viewChildren,
} from '@angular/core';

/** Um passo do tutorial: o bloco (`data-tutorial="<alvo>"`), o número exibido e a etiqueta curta. */
export interface PassoDeTutorial {
  readonly alvo: string;
  readonly numero: number;
  readonly texto: string;
}

/** Configuração de uma tela. O dono da tela a escreve; o overlay só a desenha. */
export interface ConfiguracaoDeTutorial {
  readonly passos: readonly PassoDeTutorial[];
}

interface Marca {
  readonly numero: number;
  readonly texto: string;
  readonly esquerda: number;
  readonly topo: number;
  readonly largura: number;
  readonly altura: number;
  readonly raio: string;
}

const RAIO_PADRAO = '18px';

function blocoDoTutorial(documento: Document, id: string): HTMLElement | null {
  const candidatos = documento.querySelectorAll<HTMLElement>('[data-tutorial]');
  for (const candidato of candidatos) {
    if (candidato.getAttribute('data-tutorial') === id) return candidato;
  }
  return null;
}

/**
 * Tutorial sobre a própria tela: contorno laranja numerado nos blocos marcados com
 * `data-tutorial="<id>"` e uma etiqueta curta acima de cada um. Abre pelo botão "?" do
 * `PageHeader` (`helpClick`); Esc ou clique fora fecham e o foco volta a quem abriu. Passo cujo
 * alvo não existe na tela é ignorado. Formato da configuração em `README.md` desta pasta.
 */
@Component({
  selector: 'ui-tutorial-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'teclado($event)',
    '(window:resize)': 'medir()',
  },
  styles: `
    .ui-tutorial {
      position: fixed;
      inset: 0;
      z-index: 90;
      animation: ui-tutorial-entrada 160ms ease-out;
    }
    @keyframes ui-tutorial-entrada {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .ui-tutorial {
        animation: none;
      }
    }
    .ui-tutorial__contorno {
      position: fixed;
      box-sizing: border-box;
      border: 3px solid var(--tutorial);
      pointer-events: none;
    }
    .ui-tutorial__haste {
      position: absolute;
      top: -17px;
      left: 25px;
      width: 3px;
      height: 14px;
      background: var(--tutorial);
    }
    ol {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .ui-tutorial__etiqueta {
      position: fixed;
      transform: translateY(-100%);
      display: flex;
      align-items: center;
      gap: 8px;
      box-sizing: border-box;
      max-width: calc(100vw - 32px);
      padding: 5px 14px 5px 5px;
      border-radius: 20px;
      background: var(--tutorial);
      color: var(--surface);
      font: var(--font-weight-semibold) 13px/1.3 var(--font);
      box-shadow: 0 2px 6px color-mix(in srgb, var(--ink) 18%, transparent);
    }
    .ui-tutorial__etiqueta:focus {
      outline: none;
    }
    .ui-tutorial__etiqueta:focus-visible {
      outline: 2px solid var(--ink);
      outline-offset: 2px;
    }
    .ui-tutorial__numero {
      display: flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--surface);
      color: var(--tutorial);
      font: var(--font-weight-bold) 14px var(--font);
    }
  `,
  template: `
    @if (open()) {
      <div class="ui-tutorial" role="presentation" (click)="aoClicarFora($event)">
        @for (marca of marcas(); track marca.numero) {
          <div
            class="ui-tutorial__contorno"
            aria-hidden="true"
            [style.left.px]="marca.esquerda"
            [style.top.px]="marca.topo"
            [style.width.px]="marca.largura"
            [style.height.px]="marca.altura"
            [style.border-radius]="marca.raio"
          >
            <span class="ui-tutorial__haste"></span>
          </div>
        }
        <div role="dialog" aria-label="Tutorial da tela">
          <ol aria-label="Passos do tutorial">
            @for (marca of marcas(); track marca.numero) {
              <li
                #etiqueta
                class="ui-tutorial__etiqueta"
                tabindex="0"
                [style.left.px]="marca.esquerda + 14"
                [style.top.px]="marca.topo - 14"
              >
                <span class="ui-tutorial__numero" aria-hidden="true">{{ marca.numero }}</span>
                <span
                  ><span class="ui-sr-only">Passo {{ marca.numero }}: </span>{{ marca.texto }}</span
                >
              </li>
            }
          </ol>
        </div>
      </div>
    }
  `,
})
export class TutorialOverlay {
  readonly config = input.required<ConfiguracaoDeTutorial>();
  readonly open = model(false);

  protected readonly marcas = signal<readonly Marca[]>([]);

  private readonly documento = inject(DOCUMENT);
  private readonly etiquetas = viewChildren<ElementRef<HTMLElement>>('etiqueta');
  private gatilho: HTMLElement | null = null;
  private estavaAberto = false;
  private focado = false;

  constructor() {
    effect((limpar) => {
      const aberto = this.open();
      this.config();

      if (!aberto) {
        if (this.estavaAberto) this.encerrar();
        return;
      }

      if (!this.estavaAberto) {
        this.estavaAberto = true;
        this.focado = false;
        this.gatilho = this.documento.activeElement as HTMLElement | null;
      }

      this.medir();
      const aoRolar = () => this.medir();
      this.documento.addEventListener('scroll', aoRolar, { capture: true, passive: true });
      limpar(() => this.documento.removeEventListener('scroll', aoRolar, { capture: true }));
    });

    effect(() => {
      const primeira = this.etiquetas()[0]?.nativeElement;
      if (this.open() && primeira && !this.focado) {
        this.focado = true;
        primeira.focus();
      }
    });
  }

  /** Recalcula os contornos a partir da posição atual dos blocos; passo sem alvo visível sai. */
  protected medir(): void {
    if (!this.open()) return;

    const marcas: Marca[] = [];
    for (const passo of this.config().passos) {
      const bloco = blocoDoTutorial(this.documento, passo.alvo);
      if (!bloco) continue;

      const caixa = bloco.getBoundingClientRect();
      if (caixa.width === 0 && caixa.height === 0) continue;

      const raio = this.documento.defaultView?.getComputedStyle(bloco).borderTopLeftRadius;
      marcas.push({
        numero: passo.numero,
        texto: passo.texto,
        esquerda: caixa.left,
        topo: caixa.top,
        largura: caixa.width,
        altura: caixa.height,
        raio: !raio || raio === '0px' ? RAIO_PADRAO : raio,
      });
    }
    this.marcas.set(marcas);
  }

  protected aoClicarFora(evento: MouseEvent): void {
    if (evento.target === evento.currentTarget) this.open.set(false);
  }

  protected teclado(evento: KeyboardEvent): void {
    if (!this.open()) return;

    if (evento.key === 'Escape') {
      this.open.set(false);
      return;
    }

    if (evento.key !== 'Tab') return;

    const itens = this.etiquetas().map((e) => e.nativeElement);
    const primeiro = itens[0];
    const ultimo = itens.at(-1);
    const atual = this.documento.activeElement;
    if (!primeiro || !ultimo) {
      evento.preventDefault();
      return;
    }

    if (evento.shiftKey && (atual === primeiro || !itens.includes(atual as HTMLElement))) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && (atual === ultimo || !itens.includes(atual as HTMLElement))) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  private encerrar(): void {
    this.estavaAberto = false;
    this.marcas.set([]);
    const gatilho = this.gatilho;
    this.gatilho = null;
    if (gatilho?.isConnected) gatilho.focus();
  }
}
