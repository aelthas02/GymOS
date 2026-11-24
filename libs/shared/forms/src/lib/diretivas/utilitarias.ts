import {
  afterNextRender,
  DestroyRef,
  Directive,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { NgControl } from '@angular/forms';

type CampoDeTexto = HTMLInputElement | HTMLTextAreaElement;

/** Troca o texto do campo e avisa o `FormControl` (quando há um). */
function substituirTexto(campo: CampoDeTexto, ngControl: NgControl | null, texto: string): void {
  campo.value = texto;
  ngControl?.control?.setValue(texto);
}

/** Foca o elemento assim que ele é renderizado. */
@Directive({ selector: '[appAutofocus]' })
export class Autofocus {
  constructor() {
    const elemento = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => elemento.focus());
  }
}

/** Tira os espaços das pontas ao sair do campo (hex da cor, SKU, e-mail). */
@Directive({
  selector: 'input[appTrim], textarea[appTrim]',
  host: { '(blur)': 'aparar()' },
})
export class Trim {
  private readonly campo = inject<ElementRef<CampoDeTexto>>(ElementRef).nativeElement;
  private readonly ngControl = inject(NgControl, { optional: true, self: true });

  protected aparar(): void {
    const aparado = this.campo.value.trim();
    if (aparado !== this.campo.value) {
      substituirTexto(this.campo, this.ngControl, aparado);
    }
  }
}

/** Só aceita dígitos (R/G/B, duração, parcelas, séries); o que não é dígito sai ao digitar ou colar. */
@Directive({
  selector: 'input[appOnlyNumbers]',
  host: { '(input)': 'filtrar()' },
})
export class OnlyNumbers {
  private readonly campo = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private readonly ngControl = inject(NgControl, { optional: true, self: true });

  protected filtrar(): void {
    const somenteDigitos = this.campo.value.replace(/\D/g, '');
    if (somenteDigitos !== this.campo.value) {
      substituirTexto(this.campo, this.ngControl, somenteDigitos);
    }
  }
}

const JANELA_PADRAO_EM_MS = 400;

/**
 * Evita clique duplo: o primeiro clique passa e os seguintes dentro da janela (em ms, 400 por
 * padrão) são ignorados. Escuta o clique do elemento e emite `appDebouncedClick`.
 */
@Directive({
  selector: '[appDebounceClick]',
  host: { '(click)': 'aoClicar($event)' },
})
export class DebounceClick {
  readonly appDebounceClick = input<number | ''>('');
  readonly appDebouncedClick = output<MouseEvent>();

  private ultimoClique = Number.NEGATIVE_INFINITY;

  protected aoClicar(evento: MouseEvent): void {
    const janela = this.appDebounceClick() || JANELA_PADRAO_EM_MS;
    const agora = Date.now();
    if (agora - this.ultimoClique < janela) {
      return;
    }
    this.ultimoClique = agora;
    this.appDebouncedClick.emit(evento);
  }
}

/** Emite quando o usuário clica fora do elemento (fechar menu, popover, painel). */
@Directive({ selector: '[appClickOutside]' })
export class ClickOutside {
  readonly appClickOutside = output<MouseEvent>();

  constructor() {
    const elemento = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const documento = inject(DOCUMENT);
    const aoClicar = (evento: MouseEvent): void => {
      if (evento.target instanceof Node && !elemento.contains(evento.target)) {
        this.appClickOutside.emit(evento);
      }
    };
    documento.addEventListener('click', aoClicar);
    inject(DestroyRef).onDestroy(() => documento.removeEventListener('click', aoClicar));
  }
}
