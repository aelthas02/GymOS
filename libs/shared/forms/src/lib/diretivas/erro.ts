import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Directive,
  effect,
  input,
  signal,
  type Signal,
} from '@angular/core';
import type { AbstractControl } from '@angular/forms';
import { mensagemDeErro } from '../mensagens';

let proximo = 0;

/** Mensagem a mostrar agora: só depois de `touched` ou do envio, e só se o controle for inválido. */
export function mensagemVisivel(control: AbstractControl, enviado: boolean): string | null {
  return control.invalid && (control.touched || enviado) ? mensagemDeErro(control.errors) : null;
}

/** Sinal da mensagem visível; recalcula a cada evento do controle (valor, estado, touched). */
function sinalDaMensagem(
  control: Signal<AbstractControl>,
  enviado: Signal<boolean>,
): Signal<string | null> {
  const versao = signal(0);
  effect((aoLimpar) => {
    const assinatura = control().events.subscribe(() => versao.update((v) => v + 1));
    aoLimpar(() => assinatura.unsubscribe());
  });
  return computed(() => {
    versao();
    return mensagemVisivel(control(), enviado());
  });
}

/**
 * Mensagem de erro do campo, ligada ao controle por `aria-describedby`:
 * `<app-field-error [control]="form.controls.cpf" [submitted]="enviado()" id="cpf-erro" />` e
 * `<input [appErrorFor]="form.controls.cpf" errorId="cpf-erro" />`.
 */
@Component({
  selector: 'app-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      font-size: 12px;
      font-weight: var(--font-weight-semibold);
      color: var(--badge-late-fg);
    }
  `,
  host: { '[attr.id]': 'id()', '[attr.role]': 'mensagem() ? "alert" : null' },
  template: `{{ mensagem() }}`,
})
export class FieldError {
  readonly control = input.required<AbstractControl>();
  /** `true` depois de tentar enviar o formulário. */
  readonly submitted = input(false);
  /** Id da mensagem; o campo o referencia em `aria-describedby`. */
  readonly id = input(`app-field-error-${++proximo}`);

  protected readonly mensagem = sinalDaMensagem(this.control, this.submitted);
}

/** No campo: `aria-invalid` e `aria-describedby` apontando para a mensagem enquanto ela aparece. */
@Directive({
  selector: '[appErrorFor]',
  host: {
    '[attr.aria-invalid]': 'mensagem() ? "true" : null',
    '[attr.aria-describedby]': 'mensagem() ? errorId() : null',
  },
})
export class ErrorFor {
  readonly appErrorFor = input.required<AbstractControl>();
  readonly submitted = input(false);
  /** Id do `app-field-error` que descreve este campo. */
  readonly errorId = input.required<string>();

  protected readonly mensagem = sinalDaMensagem(this.appErrorFor, this.submitted);
}
