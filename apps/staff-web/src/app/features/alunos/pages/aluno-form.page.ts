import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CampoDeEmail,
  KeyboardSafe,
  MascaraCpf,
  MascaraData,
  MascaraTelefone,
  mensagemVisivel,
  Trim,
  Validadores,
} from '@gymos/shared-forms';
import {
  Button,
  Checkbox,
  ErrorState,
  Field,
  FieldControl,
  NoPermissionState,
  PageHeader,
  Select,
  type SelectOption,
  Skeleton,
  ToastService,
} from '@gymos/ui';
import { AlunoFormStore, erroDeGravacao } from '../data-access/aluno-form.store';
import type { Aluno, Consentimento } from '../models/aluno';
import { dataDeIso, dataParaIso } from '../utils/datas';

type Finalidade = Consentimento['finalidade'];

/** Finalidades que o cadastro registra (T13c); cada uma é um aceite separado. */
const FINALIDADES: readonly { finalidade: Finalidade; rotulo: string }[] = [
  { finalidade: 'transacional', rotulo: 'Avisos de cobrança e do plano (transacional)' },
  { finalidade: 'marketing', rotulo: 'Novidades e promoções (marketing)' },
  { finalidade: 'dados_de_saude', rotulo: 'Uso de dados de saúde (restrições e avaliações)' },
  { finalidade: 'biometria', rotulo: 'Acesso por biometria' },
];

/** Cadastro e edição de aluno (`/alunos/novo` e `/alunos/:id`; tela sem referência visual). */
@Component({
  selector: 'app-aluno-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AlunoFormStore],
  imports: [
    ReactiveFormsModule,
    PageHeader,
    Field,
    FieldControl,
    Select,
    Checkbox,
    Button,
    Skeleton,
    ErrorState,
    NoPermissionState,
    MascaraCpf,
    MascaraTelefone,
    MascaraData,
    CampoDeEmail,
    Trim,
    KeyboardSafe,
  ],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 22px;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 18px;
      max-width: 760px;
      padding: var(--card-padding);
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
      box-sizing: border-box;
    }
    h2 {
      margin: 0;
      font-size: 16px;
      font-weight: var(--font-weight-bold);
    }
    .form__linha {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
    }
    .form__linha > ui-field,
    .form__linha > .form__coluna {
      flex: 1 1 220px;
      min-width: 0;
    }
    .form__campo {
      width: 100%;
      height: 44px;
      padding: 0 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-regular) 14px var(--font);
      box-sizing: border-box;
    }
    textarea.form__campo {
      height: auto;
      min-height: 84px;
      padding: 10px 12px;
      resize: vertical;
    }
    .form__campo:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .form__campo[aria-invalid='true'] {
      border-color: var(--badge-late-fg);
    }
    .form__consentimentos {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .form__dica {
      margin: 0;
      font-size: 12px;
      color: var(--muted);
    }
    .form__aviso {
      padding: 12px;
      border: 1px solid var(--state-error-border);
      border-radius: var(--radius-control);
      background: var(--badge-late-bg);
      color: var(--badge-late-fg);
      font-size: 13px;
      line-height: 1.5;
    }
    .form__acoes {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
  `,
  template: `
    <ui-page-header
      [heading]="titulo()"
      [subtitle]="subtitulo()"
      [breadcrumb]="migalhas()"
      [help]="false"
    />

    @switch (store.estado()) {
      @case ('carregando') {
        <div aria-busy="true">
          <ui-skeleton height="320px" />
        </div>
      }
      @case ('erro') {
        <ui-error-state
          heading="Não foi possível carregar o aluno"
          description="Confira a conexão e tente de novo."
          (retry)="carregar()"
        />
      }
      @case ('sem-permissao') {
        <ui-no-permission-state />
      }
      @default {
        <form appKeyboardSafe novalidate [formGroup]="form" (ngSubmit)="enviar()">
          <h2>Dados do aluno</h2>
          <div class="form__linha">
            <ui-field label="Nome completo" [error]="erroDe('nome')">
              <input
                uiFieldControl
                appTrim
                class="form__campo"
                autocomplete="name"
                enterkeyhint="next"
                formControlName="nome"
              />
            </ui-field>
            <ui-field label="CPF" [error]="erroDoCpf()">
              <input uiFieldControl appCpf class="form__campo" formControlName="cpf" />
            </ui-field>
          </div>
          <div class="form__linha">
            <ui-field label="Telefone (WhatsApp)" [error]="erroDe('telefone')">
              <input uiFieldControl appTelefone class="form__campo" formControlName="telefone" />
            </ui-field>
            <ui-field label="E-mail" [error]="erroDe('email')">
              <input uiFieldControl appEmail class="form__campo" formControlName="email" />
            </ui-field>
          </div>
          <div class="form__linha">
            <ui-field label="Data de nascimento" [error]="erroDe('dataNascimento')">
              <input
                uiFieldControl
                appData
                class="form__campo"
                placeholder="dd/mm/aaaa"
                formControlName="dataNascimento"
              />
            </ui-field>
            <ui-field label="Meta">
              <input
                uiFieldControl
                appTrim
                class="form__campo"
                autocomplete="off"
                enterkeyhint="next"
                placeholder="Ex.: hipertrofia"
                formControlName="meta"
              />
            </ui-field>
          </div>
          <div class="form__linha">
            <ui-field
              label="Restrições ou lesões"
              hint="Dado de saúde: fica cifrado e cada leitura é registrada."
            >
              <textarea
                uiFieldControl
                appTrim
                class="form__campo"
                rows="3"
                autocomplete="off"
                formControlName="restricoes"
              ></textarea>
            </ui-field>
          </div>
          <div class="form__linha">
            <ui-field label="Professor">
              <ui-select
                ariaLabel="Professor"
                [options]="professores()"
                [value]="professorId()"
                (valueChange)="professorId.set($event)"
              />
            </ui-field>
            @if (!editando()) {
              <ui-field label="Plano" hint="Com plano, o cadastro já cria o contrato.">
                <ui-select
                  ariaLabel="Plano"
                  [options]="planos()"
                  [value]="planoId()"
                  (valueChange)="planoId.set($event)"
                />
              </ui-field>
            }
          </div>
          @if (!editando() && planoId() !== '') {
            <div class="form__linha">
              <ui-field label="Início do contrato" [error]="erroDe('inicioDoContrato')">
                <input
                  uiFieldControl
                  appData
                  class="form__campo"
                  placeholder="dd/mm/aaaa (padrão: hoje)"
                  formControlName="inicioDoContrato"
                />
              </ui-field>
            </div>
          }

          @if (!editando()) {
            <div class="form__consentimentos">
              <h2>Consentimentos</h2>
              <p class="form__dica">
                Cada finalidade é um aceite separado, que o aluno pode revogar depois.
              </p>
              @for (item of finalidades; track item.finalidade) {
                <ui-checkbox
                  [checked]="aceites().has(item.finalidade)"
                  (checkedChange)="alternarAceite(item.finalidade, $event)"
                >
                  {{ item.rotulo }}
                </ui-checkbox>
              }
            </div>
          }

          @if (erroAoSalvar()) {
            <div class="form__aviso" role="alert">{{ erroAoSalvar() }}</div>
          }
          <div class="form__acoes">
            <ui-button type="submit" variant="accent" size="lg" [loading]="store.salvando()">
              {{ editando() ? 'Salvar alterações' : 'Cadastrar aluno' }}
            </ui-button>
            <ui-button size="lg" variant="outline" (click)="cancelar()">Cancelar</ui-button>
          </div>
        </form>
      }
    }
  `,
})
export class AlunoFormPage {
  protected readonly store = inject(AlunoFormStore);
  private readonly rota = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly id = this.rota.snapshot.paramMap.get('id');
  /** Lead de origem (`?lead=<id>`): o cadastro o grava em `leadId`. */
  private readonly leadId = this.rota.snapshot.queryParamMap.get('lead');
  protected readonly editando = computed(() => this.id !== null);
  protected readonly titulo = computed(() =>
    this.editando() ? 'Editar aluno' : 'Cadastrar aluno',
  );
  protected readonly subtitulo = computed(() =>
    this.editando()
      ? 'Atualize os dados cadastrais do aluno.'
      : 'Preencha os dados e, se quiser, já escolha o plano.',
  );
  protected readonly migalhas = computed(() => [
    { label: 'Alunos', link: '/alunos' },
    { label: this.titulo() },
  ]);
  protected readonly finalidades = FINALIDADES;

  protected readonly form = new FormGroup({
    nome: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    cpf: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validadores.cpf],
    }),
    telefone: new FormControl('', { nonNullable: true, validators: [Validadores.telefone()] }),
    email: new FormControl('', { nonNullable: true, validators: [Validadores.email] }),
    dataNascimento: new FormControl('', { nonNullable: true, validators: [Validadores.data] }),
    meta: new FormControl('', { nonNullable: true }),
    restricoes: new FormControl('', { nonNullable: true }),
    inicioDoContrato: new FormControl('', { nonNullable: true, validators: [Validadores.data] }),
  });
  protected readonly professorId = signal('');
  protected readonly planoId = signal('');
  protected readonly aceites = signal<ReadonlySet<Finalidade>>(new Set());

  protected readonly professores = computed<readonly SelectOption[]>(() => [
    { value: '', label: 'Sem professor' },
    ...this.store.profissionais().map((item) => ({ value: item.id, label: item.nome })),
  ]);
  protected readonly planos = computed<readonly SelectOption[]>(() => [
    { value: '', label: 'Sem plano agora' },
    ...this.store.planosAtivos().map((plano) => ({ value: plano.id, label: plano.nome })),
  ]);

  protected readonly enviado = signal(false);
  private readonly eventos = toSignal(this.form.events, { initialValue: null });
  private readonly erroDaApiNoCpf = signal<string | null>(null);
  protected readonly erroAoSalvar = signal<string | null>(null);
  protected readonly erroDoCpf = computed(() => this.erroDaApiNoCpf() ?? this.erroDe('cpf'));

  constructor() {
    this.carregar();
    effect(() => {
      const aluno = this.store.aluno();
      untracked(() => {
        if (aluno) {
          this.preencher(aluno);
        }
      });
    });
    // Mudou o CPF depois do erro da API: o erro sai do campo.
    this.form.controls.cpf.valueChanges.subscribe(() => this.erroDaApiNoCpf.set(null));
  }

  protected carregar(): void {
    this.store.carregar(this.id);
  }

  protected erroDe(
    campo: 'nome' | 'cpf' | 'telefone' | 'email' | 'dataNascimento' | 'inicioDoContrato',
  ): string | undefined {
    this.eventos();
    return mensagemVisivel(this.form.controls[campo], this.enviado()) ?? undefined;
  }

  protected alternarAceite(finalidade: Finalidade, aceito: boolean): void {
    const novo = new Set(this.aceites());
    if (aceito) {
      novo.add(finalidade);
    } else {
      novo.delete(finalidade);
    }
    this.aceites.set(novo);
  }

  protected enviar(): void {
    this.enviado.set(true);
    this.erroAoSalvar.set(null);
    this.erroDaApiNoCpf.set(null);
    if (this.form.invalid || this.store.salvando()) {
      return;
    }
    const campos = this.form.getRawValue();
    const dados = {
      nome: campos.nome.trim(),
      cpf: campos.cpf,
      telefone: campos.telefone || null,
      email: campos.email.trim() || null,
      dataNascimento: dataParaIso(campos.dataNascimento),
      meta: campos.meta.trim() || null,
      restricoes: campos.restricoes.trim() || null,
      professorId: this.professorId() || null,
    };
    const aoFalhar = (falha: unknown): void => {
      const erro = erroDeGravacao(falha);
      this.erroDaApiNoCpf.set(erro.cpf);
      this.erroAoSalvar.set(erro.geral);
    };
    if (this.id) {
      this.store.editar(this.id, dados).subscribe({
        next: () => {
          this.toast.show({ message: 'Aluno salvo.', tone: 'success' });
          void this.router.navigateByUrl('/alunos');
        },
        error: aoFalhar,
      });
      return;
    }
    const planoId = this.planoId();
    const inicio = dataParaIso(campos.inicioDoContrato);
    this.store
      .cadastrar({
        ...dados,
        ...(this.leadId ? { leadId: this.leadId } : {}),
        ...(planoId ? { planoId } : {}),
        ...(planoId && inicio ? { inicioDoContrato: inicio } : {}),
        consentimentos: [...this.aceites()].map((finalidade) => ({
          finalidade,
          decisao: 'aceite' as const,
        })),
      })
      .subscribe({
        next: () => {
          this.toast.show({ message: 'Aluno cadastrado.', tone: 'success' });
          void this.router.navigateByUrl('/alunos');
        },
        error: aoFalhar,
      });
  }

  protected cancelar(): void {
    void this.router.navigateByUrl('/alunos');
  }

  private preencher(aluno: Aluno): void {
    this.enviado.set(false);
    this.form.reset({
      nome: aluno.nome,
      cpf: aluno.cpf,
      telefone: aluno.telefone ?? '',
      email: aluno.email ?? '',
      dataNascimento: dataDeIso(aluno.dataNascimento),
      meta: aluno.meta ?? '',
      restricoes: aluno.restricoes ?? '',
      inicioDoContrato: '',
    });
    this.professorId.set(aluno.professorId ?? '');
  }
}
