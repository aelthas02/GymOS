import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CampoDeEmail,
  CampoDeSenha,
  KeyboardSafe,
  mensagemVisivel,
  Validadores,
} from '@gymos/shared-forms';
import { Button, Field, FieldControl } from '@gymos/ui';
import { AuthStore } from '../../../core/sessao/auth.store';
import { PosLogin } from '../../../core/sessao/pos-login';
import { ESTILOS_DA_ENTRADA } from '../components/estilos-da-entrada';
import { LayoutDeEntrada } from '../components/layout-de-entrada';
import { mensagemDoErro } from '../utils/erro-da-api';

/** Entrar no painel (`/entrar`, `Login.html`). */
@Component({
  selector: 'app-entrar-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LayoutDeEntrada,
    Field,
    FieldControl,
    Button,
    CampoDeEmail,
    CampoDeSenha,
    KeyboardSafe,
  ],
  styles: ESTILOS_DA_ENTRADA,
  template: `
    <app-layout-de-entrada heading="Entrar no painel">
      <form appKeyboardSafe novalidate [formGroup]="form" (ngSubmit)="entrar()">
        <ui-field label="E-mail" [error]="erroDoEmail() ?? undefined">
          <input uiFieldControl appEmail class="entrada__campo" formControlName="email" />
        </ui-field>
        <ui-field label="Senha" [error]="erroDaSenha() ?? undefined">
          <input uiFieldControl appSenha class="entrada__campo" formControlName="senha" />
        </ui-field>
        <a class="entrada__link" routerLink="/esqueci-senha">Esqueci minha senha</a>
        @if (erro()) {
          <div class="entrada__aviso" role="alert">{{ erro() }}</div>
        }
        <ui-button type="submit" variant="accent" size="xl" [block]="true" [loading]="entrando()">
          Entrar
        </ui-button>
        <div class="entrada__rodape">
          Primeiro acesso? Use o link do convite enviado ao seu e-mail pelo administrador.
        </div>
      </form>
    </app-layout-de-entrada>
  `,
})
export class EntrarPage {
  private readonly auth = inject(AuthStore);
  private readonly posLogin = inject(PosLogin);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validadores.email],
    }),
    senha: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly enviado = signal(false);
  protected readonly entrando = signal(false);
  protected readonly erro = signal<string | null>(null);

  private readonly eventos = toSignal(this.form.events, { initialValue: null });
  protected readonly erroDoEmail = computed(() => {
    this.eventos();
    return mensagemVisivel(this.form.controls.email, this.enviado());
  });
  protected readonly erroDaSenha = computed(() => {
    this.eventos();
    return mensagemVisivel(this.form.controls.senha, this.enviado());
  });

  protected entrar(): void {
    this.enviado.set(true);
    this.erro.set(null);
    if (this.form.invalid || this.entrando()) {
      return;
    }
    this.entrando.set(true);
    const { email, senha } = this.form.getRawValue();
    this.auth.entrar(email.trim(), senha).subscribe({
      next: () => this.posLogin.ir(),
      error: (falha: unknown) => {
        this.entrando.set(false);
        // Mensagem única para e-mail inexistente ou senha errada: não revela se a conta existe.
        this.erro.set(mensagemDoErro(falha, { 401: 'E-mail ou senha incorretos.' }));
      },
    });
  }
}
