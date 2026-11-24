import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CampoDeSenha, KeyboardSafe, mensagemVisivel, Validadores } from '@gymos/shared-forms';
import { Button, Field, FieldControl } from '@gymos/ui';
import { AuthStore } from '../../../core/sessao/auth.store';
import { PosLogin } from '../../../core/sessao/pos-login';
import { ESTILOS_DA_ENTRADA } from '../components/estilos-da-entrada';
import { LayoutDeEntrada } from '../components/layout-de-entrada';
import { mensagemDoErro } from '../utils/erro-da-api';

/** Aceitar convite (`/convite/:token`, sem referência visual): cria a senha e já entra no painel. */
@Component({
  selector: 'app-aceitar-convite-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LayoutDeEntrada,
    Field,
    FieldControl,
    Button,
    CampoDeSenha,
    KeyboardSafe,
  ],
  styles: ESTILOS_DA_ENTRADA,
  template: `
    <app-layout-de-entrada heading="Aceitar convite">
      <form appKeyboardSafe novalidate [formGroup]="form" (ngSubmit)="aceitar()">
        <ui-field label="Seu nome" [error]="erroDoNome() ?? undefined">
          <input
            uiFieldControl
            class="entrada__campo"
            formControlName="nome"
            autocomplete="name"
            enterkeyhint="next"
          />
        </ui-field>
        <ui-field
          label="Crie uma senha"
          hint="Use 8 caracteres ou mais, com letras e números."
          [error]="erroDaSenha() ?? undefined"
        >
          <input uiFieldControl appSenha="nova" class="entrada__campo" formControlName="senha" />
        </ui-field>
        @if (erro()) {
          <div class="entrada__aviso" role="alert">{{ erro() }}</div>
        }
        <ui-button type="submit" variant="accent" size="xl" [block]="true" [loading]="enviando()">
          Criar senha e entrar
        </ui-button>
      </form>
      <a class="entrada__link" routerLink="/entrar">Já tenho conta</a>
    </app-layout-de-entrada>
  `,
})
export class AceitarConvitePage {
  private readonly auth = inject(AuthStore);
  private readonly posLogin = inject(PosLogin);
  private readonly token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';

  protected readonly form = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    senha: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validadores.senhaForte],
    }),
  });

  protected readonly enviado = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  private readonly eventos = toSignal(this.form.events, { initialValue: null });
  protected readonly erroDoNome = computed(() => {
    this.eventos();
    return mensagemVisivel(this.form.controls.nome, this.enviado());
  });
  protected readonly erroDaSenha = computed(() => {
    this.eventos();
    return mensagemVisivel(this.form.controls.senha, this.enviado());
  });

  protected aceitar(): void {
    this.enviado.set(true);
    this.erro.set(null);
    if (this.form.invalid || this.enviando()) {
      return;
    }
    this.enviando.set(true);
    const { nome, senha } = this.form.getRawValue();
    this.auth.aceitarConvite(this.token, nome.trim(), senha).subscribe({
      next: () => this.posLogin.ir(),
      error: (falha: unknown) => {
        this.enviando.set(false);
        this.erro.set(
          mensagemDoErro(falha, {
            404: 'Convite não encontrado. Peça um novo ao administrador.',
            409: 'Já existe um usuário com este e-mail. Entre com a sua senha.',
            410: 'Este convite expirou ou já foi usado. Peça um novo ao administrador.',
          }),
        );
      },
    });
  }
}
