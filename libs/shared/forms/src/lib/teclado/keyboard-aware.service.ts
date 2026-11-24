import { computed, DestroyRef, DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { observarTeclado, publicarAltura, TECLADO_FECHADO, type EstadoDoTeclado } from './nucleo';

/**
 * Teclado virtual como signals (`visualViewport`). Também publica `--teclado-altura` no `<html>`
 * para os rodapés fixos subirem com o teclado. Sem teclado (desktop) fica tudo em repouso.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardAwareService {
  private readonly documento = inject(DOCUMENT);
  private readonly estado = signal<EstadoDoTeclado>(TECLADO_FECHADO);

  /** Altura do teclado sobre o layout, em px (0 no Android, onde o layout encolhe). */
  readonly alturaDoTeclado = computed(() => this.estado().alturaDoTeclado);
  /** Altura da área visível, em px. */
  readonly alturaVisivel = computed(() => this.estado().alturaVisivel);
  readonly aberto = computed(() => this.estado().aberto);

  constructor() {
    const janela = this.documento.defaultView;
    if (!janela) {
      return;
    }
    const parar = observarTeclado(janela, (novo) => {
      this.estado.set(novo);
      publicarAltura(this.documento, novo.alturaDoTeclado);
    });
    inject(DestroyRef).onDestroy(parar);
  }
}
