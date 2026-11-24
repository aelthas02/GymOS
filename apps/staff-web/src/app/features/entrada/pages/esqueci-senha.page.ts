import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CLIENTE_DA_API } from '@gymos/api-contracts';
import { CampoDeEmail, KeyboardSafe, mensagemVisivel, Validadores } from '@gymos/shared-forms';
import { Button, Field, FieldControl } from '@gymos/ui';
import { ESTILOS_DA_ENTRADA } from '../components/estilos-da-entrada';
import { LayoutDeEntrada } from '../components/layout-de-entrada';
import { mensagemDoErro } from '../utils/erro-da-api';

/** Esqueci minha senha (`/esqueci-senha`, sem referência visual): pede o e-mail e envia o link. */
@Component({
  selector: 'app-esqueci-senha-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LayoutDeEntrada,
    Field,
    FieldControl,
    Button,
    CampoDeEmail,
    KeyboardSafe,
  ],
  styles: ESTILOS_DA_ENTRADA,
  template: `
    <app-layout-de-entrada heading="Esqueci minha senha">
      @if (concluido()) {
        <div class="entrada__aviso entrada__aviso--ok" role="status">
          Se o e-mail tiver uma conta, enviamos o link para criar uma nova senha. Confira a caixa de
          entrada.
        </div>
      } @else {
        <form appKeyboardSafe novalidate [formGroup]="form" (ngSubmit)="enviar()">
          <ui-field label="E-mail" [error]="erroDoEmail() ?? undefined">
            <input uiFieldControl appEmail class="entrada__campo" formControlName="email" />
          </ui-field>
          @if (erro()) {
            <div class="entrada__aviso" role="alert">{{ erro() }}</div>
          }
          <ui-button type="submit" variant="accent" size="xl" [block]="true" [loading]="enviando()">
            Enviar link
          </ui-button>
        </form>
      }
      <a class="entrada__link" routerLink="/entrar">Voltar para entrar</a>
    </app-layout-de-entrada>
  `,
})
export class EsqueciSenhaPage {
  private readonly api = inject(CLIENTE_DA_API);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validadores.email],
    }),
  });

  protected readonly enviado = signal(false);
  protected readonly enviando = signal(false);
  protected readonly concluido = signal(false);
  protected readonly erro = signal<string | null>(null);

  private readonly eventos = toSignal(this.form.events, { initialValue: null });
  protected readonly erroDoEmail = computed(() => {
    this.eventos();
    return mensagemVisivel(this.form.controls.email, this.enviado());
  });

  protected enviar(): void {
    this.enviado.set(true);
    this.erro.set(null);
    if (this.form.invalid || this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.api
      .post('/api/auth/staff/esqueci-senha', { email: this.form.controls.email.value.trim() })
      .subscribe({
        next: () => this.concluido.set(true),
        error: (falha: unknown) => {
          this.enviando.set(false);
          this.erro.set(mensagemDoErro(falha));
        },
      });
  }
}
