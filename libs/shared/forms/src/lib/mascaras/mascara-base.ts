import {
  Directive,
  ElementRef,
  forwardRef,
  inject,
  type OnInit,
  type Provider,
  type Type,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

/** Atributos que a máscara põe no `input` quando o template não os declara. */
export type AtributosPadrao = Readonly<Record<string, string>>;

/** Atributos de campos de identificadores e segredos: o teclado não corrige nem capitaliza. */
export const SEM_AUTOCORRECAO: AtributosPadrao = {
  autocapitalize: 'off',
  autocorrect: 'off',
  spellcheck: 'false',
};

/** Liga a diretiva ao `ngModel`, `formControl` e `formControlName`. */
export function provedorDeMascara(tipo: () => Type<unknown>): Provider {
  return { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(tipo), multi: true };
}

/**
 * Base das máscaras: o `input` mostra o texto formatado e o `FormControl` guarda o valor cru.
 * A subclasse diz como formatar o que o usuário digitou (`formatar`), qual é o valor cru de um
 * texto formatado (`paraValor`) e como mostrar um valor vindo do modelo (`paraTexto`).
 */
@Directive({
  host: {
    '(input)': 'aoDigitar()',
    '(blur)': 'aoSair()',
    '(focus)': 'aoEntrar()',
  },
})
export abstract class MascaraBase<V = string> implements ControlValueAccessor, OnInit {
  protected readonly elemento = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

  /** `inputmode`, `type`, `autocomplete` e `enterkeyhint` da máscara; o template sobrescreve. */
  protected abstract readonly padrao: AtributosPadrao;

  /** Texto a exibir para o que o usuário digitou ou colou; `anterior` é o que estava no campo. */
  protected abstract formatar(texto: string, anterior: string): string;
  /** Valor cru do texto já formatado; `null` quando o campo está vazio. */
  protected abstract paraValor(exibido: string): V | null;
  /** Texto de um valor que veio do modelo. */
  protected abstract paraTexto(valor: V | null): string;

  /** Máscaras de valor (dinheiro) mantêm o cursor no fim; as demais preservam a posição. */
  protected readonly cursorNoFim: boolean = false;

  private ultimoExibido = '';
  private valorAtual: V | null = null;
  protected emFoco = false;

  private aoMudar: (valor: V | null) => void = () => undefined;
  private aoTocar: () => void = () => undefined;

  ngOnInit(): void {
    for (const [nome, valor] of Object.entries(this.padrao)) {
      if (!this.elemento.hasAttribute(nome)) {
        this.elemento.setAttribute(nome, valor);
      }
    }
  }

  writeValue(valor: V | null): void {
    this.valorAtual = valor ?? null;
    this.mostrar(this.paraTexto(this.valorAtual));
  }

  registerOnChange(fn: (valor: V | null) => void): void {
    this.aoMudar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.aoTocar = fn;
  }

  setDisabledState(desabilitado: boolean): void {
    this.elemento.disabled = desabilitado;
  }

  protected aoDigitar(): void {
    const texto = this.elemento.value;
    const cursor = this.elemento.selectionStart;
    const exibido = this.formatar(texto, this.ultimoExibido);
    const posicao =
      this.cursorNoFim || cursor === null
        ? exibido.length
        : this.formatar(texto.slice(0, cursor), this.ultimoExibido).length;
    this.mostrar(exibido, posicao);
    this.publicar(exibido);
  }

  protected aoEntrar(): void {
    this.emFoco = true;
  }

  protected aoSair(): void {
    this.emFoco = false;
    this.aoTocar();
  }

  /** Grava o valor cru e avisa o formulário. */
  protected publicar(exibido: string): void {
    this.valorAtual = this.paraValor(exibido);
    this.aoMudar(this.valorAtual);
  }

  /** Coloca o texto no campo; com `posicao`, o cursor vai para ela. */
  protected mostrar(exibido: string, posicao?: number): void {
    this.ultimoExibido = exibido;
    this.elemento.value = exibido;
    // `type="email"` e outros não aceitam seleção; o cursor só é movido onde ele existe.
    if (posicao !== undefined && this.elemento.selectionStart !== null) {
      this.elemento.setSelectionRange(posicao, posicao);
    }
  }

  protected get valor(): V | null {
    return this.valorAtual;
  }

  /** Para a subclasse que troca o valor sem passar por `aoDigitar` (colar). */
  protected definir(valor: V | null): void {
    this.valorAtual = valor;
    this.mostrar(this.paraTexto(valor));
    this.aoMudar(valor);
  }
}
