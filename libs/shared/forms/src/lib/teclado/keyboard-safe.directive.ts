import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { KeyboardAwareService } from './keyboard-aware.service';
import { rolarCampoFocadoParaOCentro } from './nucleo';

/**
 * Container de formulário: ao focar um campo com o teclado aberto, rola o campo para o centro da
 * área visível. O rodapé fixo usa `bottom: var(--teclado-altura, 0px)` (publicada pelo serviço).
 */
@Directive({ selector: '[appKeyboardSafe]' })
export class KeyboardSafe {
  constructor() {
    const servico = inject(KeyboardAwareService);
    const raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const desligar = rolarCampoFocadoParaOCentro(raiz, () => ({
      aberto: servico.aberto(),
      alturaDoTeclado: servico.alturaDoTeclado(),
      alturaVisivel: servico.alturaVisivel(),
    }));
    inject(DestroyRef).onDestroy(desligar);
  }
}
