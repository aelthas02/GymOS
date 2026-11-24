import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CLIENTE_DA_API } from '@gymos/api-contracts';
import { CampoDeSenha, KeyboardSafe, mensagemVisivel, Validadores } from '@gymos/shared-forms';
import { Button, Field, FieldControl } from '@gymos/ui';
import { ESTILOS_DA_ENTRADA } from '../components/estilos-da-entrada';
import { LayoutDeEntrada } from '../components/layout-de-entrada';
import { mensagemDoErro } from '../utils/erro-da-api';

function senhasIguais(grupo: AbstractControl): ValidationErrors | null {
  return grupo.get('senha')?.value === grupo.get('confirmacao')?.value
    ? null
    : { divergente: true };
}

/** Nova senha pelo link do e-mail (`/redefinir-senha/:token`, sem referência visual). */
@Component({
  selector: 'app-redefinir-senha-page',
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
    <app-layout-de-entrada heading="Criar nova senha">
      @if (concluido()) {
        <div class="entrada__aviso entrada__aviso--ok" role="status">
          Senha alterada. Use a nova senha para entrar.
        </div>
        <ui-button variant="accent" size="xl" [block]="true" routerLink="/entrar">Entrar</ui-button>
      } @else {
        <form appKeyboardSafe novalidate [formGroup]="form" (ngSubmit)="salvar()">
          <ui-field label="Nova senha" [error]="erroDaSenha() ?? undefined">
            <input uiFieldControl appSenha="nova" class="entrada__campo" formControlName="senha" />
          </ui-field>
          <ui-field label="Repita a nova senha" [error]="erroDaConfirmacao() ?? undefined">
            <input
              uiFieldControl
              appSenha="nova"
              class="entrada__campo"
              formControlName="confirmacao"
            />
          </ui-field>
          @if (erro()) {
            <div class="entrada__aviso" role="alert">{{ erro() }}</div>
          }
          <ui-button type="submit" variant="accent" size="xl" [block]="true" [loading]="salvando()">
            Salvar senha
          </ui-button>
        </form>
        <a class="entrada__link" routerLink="/esqueci-senha">Pedir um novo link</a>
      }
    </app-layout-de-entrada>
  `,
})
export class RedefinirSenhaPage {
  private readonly api = inject(CLIENTE_DA_API);
  private readonly token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';

  protected readonly form = new FormGroup(
    {
      senha: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validadores.senhaForte],
      }),
      confirmacao: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: senhasIguais },
  );

  protected readonly enviado = signal(false);
  protected readonly salvando = signal(false);
  protected readonly concluido = signal(false);
  protected readonly erro = signal<string | null>(null);

  private readonly eventos = toSignal(this.form.events, { initialValue: null });
  protected readonly erroDaSenha = computed(() => {
    this.eventos();
    return mensagemVisivel(this.form.controls.senha, this.enviado());
  });
  protected readonly erroDaConfirmacao = computed(() => {
    this.eventos();
    const campo = this.form.controls.confirmacao;
    return (
      mensagemVisivel(campo, this.enviado()) ??
      (this.form.hasError('divergente') && (campo.touched || this.enviado())
        ? 'As senhas não são iguais.'
        : null)
    );
  });

  protected salvar(): void {
    this.enviado.set(true);
    this.erro.set(null);
    if (this.form.invalid || this.salvando()) {
      return;
    }
    this.salvando.set(true);
    this.api
      .post('/api/auth/staff/redefinir-senha', {
        token: this.token,
        senha: this.form.controls.senha.value,
      })
      .subscribe({
        next: () => this.concluido.set(true),
        error: (falha: unknown) => {
          this.salvando.set(false);
          this.erro.set(
            mensagemDoErro(falha, {
              410: 'Este link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".',
            }),
          );
        },
      });
  }
}
