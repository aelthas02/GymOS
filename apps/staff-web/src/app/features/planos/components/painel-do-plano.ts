import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { KeyboardSafe, MascaraBrl, mensagemVisivel, OnlyNumbers } from '@gymos/shared-forms';
import { centavos, formatarBrl } from '@gymos/shared-money';
import { Button, Chips, Field, FieldControl, Select, Toggle, type ChipOption } from '@gymos/ui';
import type {
  ConsultaDaPrevia,
  DadosDoPlano,
  FormaDeCobranca,
  Plano,
  PreviaDoPlano,
} from '../models/plano';
import { ACESSOS_POR_SEMANA, FORMAS_DE_COBRANCA, MODALIDADES } from '../utils/apresentacao';

const OPCOES_DE_MODALIDADE: readonly ChipOption[] = MODALIDADES.map((nome) => ({
  value: nome,
  label: nome,
}));

const inteiroPositivo = (texto: string): number | null => {
  const numero = Number(texto);
  return /^\d+$/.test(texto) && numero >= 1 ? numero : null;
};

/**
 * Painel "Novo plano" / "Editar plano". Não calcula nada: o valor da parcela e o texto explicativo
 * chegam da API (`previa`), e cada mudança nos três campos que os definem sai em `camposDaParcela`.
 */
@Component({
  selector: 'app-painel-do-plano',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Field,
    FieldControl,
    Select,
    Chips,
    Toggle,
    Button,
    MascaraBrl,
    OnlyNumbers,
    KeyboardSafe,
  ],
  styles: `
    :host {
      display: block;
    }
    section {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: var(--card-padding);
      border: 1px solid var(--accent);
      border-radius: var(--radius-card);
      background: var(--surface);
      box-sizing: border-box;
    }
    h2 {
      margin: 0;
      font-size: 16px;
      font-weight: var(--font-weight-bold);
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .painel__linha {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .painel__linha--base {
      align-items: flex-end;
    }
    .painel__linha > ui-field {
      flex: 1 1 120px;
    }
    .painel__campo {
      height: 44px;
      width: 100%;
      padding: 0 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-regular) 14px var(--font);
      box-sizing: border-box;
    }
    .painel__campo:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .painel__campo[aria-invalid='true'] {
      border-color: var(--badge-late-fg);
    }
    .painel__campo[readonly] {
      background: color-mix(in srgb, var(--page) 70%, var(--divider));
    }
    .painel__explicacao {
      margin: 0;
      padding: 10px 12px;
      border-radius: var(--radius-control);
      background: var(--page);
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }
    .painel__rotulo {
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
    }
    ui-select {
      min-width: 0;
    }
    .painel__chaves {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .painel__aviso {
      padding: 12px;
      border: 1px solid var(--state-error-border);
      border-radius: var(--radius-control);
      background: var(--badge-late-bg);
      color: var(--badge-late-fg);
      font-size: 13px;
      line-height: 1.5;
    }
    .painel__acoes {
      display: flex;
      gap: 10px;
      margin-top: 4px;
    }
    .painel__acoes ui-button:first-child {
      flex: 1;
    }
    /* O protótipo põe o rótulo à esquerda e o interruptor à direita; chips menores que o padrão. */
    :host ::ng-deep .painel__chave button {
      min-height: 24px;
      flex-direction: row-reverse;
      justify-content: space-between;
      width: 100%;
    }
    :host ::ng-deep .painel__chips .ui-chip {
      min-height: 0;
      padding: 6px 12px;
    }
    :host ::ng-deep .painel__chips .ui-chip--on {
      border-width: 0;
    }
    :host ::ng-deep .painel__chave .ui-toggle__track {
      width: 42px;
      height: 24px;
    }
    :host ::ng-deep .painel__chave .ui-toggle__thumb {
      width: 18px;
      height: 18px;
    }
    :host ::ng-deep .painel__chave [aria-checked='true'] .ui-toggle__track {
      background: var(--accent);
    }
    :host ::ng-deep .painel__chave [aria-checked='true'] .ui-toggle__thumb {
      background: var(--ink);
    }
  `,
  template: `
    <section aria-labelledby="painel-titulo" data-tutorial="painel">
      <h2 id="painel-titulo">{{ titulo() }}</h2>
      <form appKeyboardSafe novalidate [formGroup]="form" (ngSubmit)="enviar()">
        <ui-field label="Nome do plano" [error]="erroDoNome() ?? undefined">
          <input uiFieldControl class="painel__campo" formControlName="nome" autocomplete="off" />
        </ui-field>
        <div class="painel__linha">
          <ui-field label="Valor total (R$)" [error]="erroDoValor() ?? undefined">
            <input uiFieldControl class="painel__campo" appBrl formControlName="valorTotal" />
          </ui-field>
          <ui-field label="Duração (meses)" [error]="erroDaDuracao() ?? undefined">
            <input
              uiFieldControl
              class="painel__campo"
              appOnlyNumbers
              inputmode="numeric"
              autocomplete="off"
              formControlName="duracaoMeses"
            />
          </ui-field>
        </div>
        <div class="painel__linha painel__linha--base">
          <ui-field label="Parcelas" [error]="erroDasParcelas() ?? undefined">
            <input
              uiFieldControl
              class="painel__campo"
              appOnlyNumbers
              inputmode="numeric"
              autocomplete="off"
              formControlName="parcelas"
            />
          </ui-field>
          <ui-field label="Valor da parcela">
            <input
              uiFieldControl
              class="painel__campo"
              readonly
              [value]="valorDaParcela()"
              aria-live="polite"
            />
          </ui-field>
        </div>
        @if (previa()) {
          <p class="painel__explicacao">{{ previa()?.explicacao }}</p>
        }
        <ui-field label="Forma de cobrança">
          <ui-select [options]="formas" [value]="forma()" (valueChange)="escolherForma($event)" />
        </ui-field>
        <div>
          <div class="painel__rotulo" id="painel-modalidades">Modalidades incluídas</div>
          <div class="painel__chips">
            <ui-chips
              label="Modalidades incluídas"
              [options]="modalidadesDisponiveis"
              [(values)]="modalidades"
            />
          </div>
        </div>
        <ui-field label="Acessos por semana">
          <ui-select [options]="acessos" [(value)]="acessosPorSemana" />
        </ui-field>
        <div class="painel__chaves">
          <ui-toggle
            class="painel__chave"
            label="Renovação automática"
            [(checked)]="renovacaoAutomatica"
          />
          <ui-toggle class="painel__chave" label="Plano ativo para venda" [(checked)]="ativo" />
        </div>
        @if (erroAoSalvar()) {
          <div class="painel__aviso" role="alert">{{ erroAoSalvar() }}</div>
        }
        <div class="painel__acoes">
          <ui-button type="submit" variant="accent" size="lg" [block]="true" [loading]="salvando()">
            Salvar plano
          </ui-button>
          <ui-button size="lg" variant="outline" (click)="cancelar.emit()">Cancelar</ui-button>
        </div>
      </form>
    </section>
  `,
})
export class PainelDoPlano {
  /** Plano em edição; `null` é um plano novo. */
  readonly plano = input<Plano | null>(null);
  /** Muda para limpar o formulário (por exemplo, depois de salvar um plano novo). */
  readonly reinicio = input(0);
  readonly previa = input<PreviaDoPlano | null>(null);
  /** Erro da API sobre as parcelas (por exemplo, "parcelas acima da duração"). */
  readonly erroDaPrevia = input<string | null>(null);
  readonly erroAoSalvar = input<string | null>(null);
  readonly salvando = input(false);

  readonly salvar = output<DadosDoPlano>();
  readonly cancelar = output<void>();
  /** Os três campos que definem a parcela; `null` enquanto algum estiver incompleto. */
  readonly camposDaParcela = output<ConsultaDaPrevia | null>();

  protected readonly formas = FORMAS_DE_COBRANCA;
  protected readonly acessos = ACESSOS_POR_SEMANA;
  protected readonly modalidadesDisponiveis = OPCOES_DE_MODALIDADE;

  protected readonly form = new FormGroup({
    nome: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    valorTotal: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    duracaoMeses: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    parcelas: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly forma = signal<FormaDeCobranca>('cartao_ou_pix');
  protected readonly modalidades = signal<readonly string[]>([]);
  protected readonly acessosPorSemana = signal('');
  protected readonly renovacaoAutomatica = signal(true);
  protected readonly ativo = signal(true);

  protected readonly titulo = computed(() => (this.plano() ? 'Editar plano' : 'Novo plano'));
  protected readonly valorDaParcela = computed(() => {
    const previa = this.previa();
    return previa ? formatarBrl(centavos(previa.parcelaCentavos)) : '';
  });

  private readonly enviado = signal(false);
  private readonly eventos = toSignal(this.form.events, { initialValue: null });
  protected readonly erroDoNome = computed(() => this.erroDe('nome'));
  protected readonly erroDoValor = computed(() => this.erroDe('valorTotal'));
  protected readonly erroDaDuracao = computed(() => this.erroDe('duracaoMeses'));
  protected readonly erroDasParcelas = computed(
    () => this.erroDaPrevia() ?? this.erroDe('parcelas'),
  );

  constructor() {
    effect(() => {
      this.reinicio();
      const plano = this.plano();
      untracked(() => this.preencher(plano));
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.camposDaParcela.emit(this.consulta());
    });
  }

  protected escolherForma(valor: string): void {
    const forma = FORMAS_DE_COBRANCA.find((item) => item.value === valor);
    if (forma) {
      this.forma.set(forma.value);
    }
  }

  protected enviar(): void {
    this.enviado.set(true);
    if (this.form.invalid || this.salvando()) {
      return;
    }
    const { nome, valorTotal, duracaoMeses, parcelas } = this.form.getRawValue();
    const acessos = this.acessosPorSemana();
    this.salvar.emit({
      nome: nome.trim(),
      valorTotalCentavos: valorTotal ?? 0,
      duracaoMeses: Number(duracaoMeses),
      parcelas: Number(parcelas),
      formaDeCobranca: this.forma(),
      modalidades: [...this.modalidades()],
      acessosPorSemana: acessos === '' ? null : Number(acessos),
      renovacaoAutomatica: this.renovacaoAutomatica(),
      ativo: this.ativo(),
    });
  }

  private erroDe(campo: 'nome' | 'valorTotal' | 'duracaoMeses' | 'parcelas'): string | null {
    this.eventos();
    return mensagemVisivel(this.form.controls[campo], this.enviado());
  }

  private consulta(): ConsultaDaPrevia | null {
    const { valorTotal, duracaoMeses, parcelas } = this.form.getRawValue();
    const duracao = inteiroPositivo(duracaoMeses);
    const quantidade = inteiroPositivo(parcelas);
    if (!valorTotal || valorTotal < 1 || duracao === null || quantidade === null) {
      return null;
    }
    return { valorTotalCentavos: valorTotal, duracaoMeses: duracao, parcelas: quantidade };
  }

  private preencher(plano: Plano | null): void {
    this.enviado.set(false);
    this.form.reset({
      nome: plano?.nome ?? '',
      valorTotal: plano?.valorTotalCentavos ?? null,
      duracaoMeses: plano ? String(plano.duracaoMeses) : '',
      parcelas: plano ? String(plano.parcelas) : '',
    });
    this.forma.set(plano?.formaDeCobranca ?? 'cartao_ou_pix');
    this.modalidades.set(plano?.modalidades ?? []);
    this.acessosPorSemana.set(plano?.acessosPorSemana ? String(plano.acessosPorSemana) : '');
    this.renovacaoAutomatica.set(plano?.renovacaoAutomatica ?? true);
    this.ativo.set(plano?.ativo ?? true);
  }
}
