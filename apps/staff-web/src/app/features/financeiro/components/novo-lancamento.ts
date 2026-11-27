import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { KeyboardSafe, MascaraBrl, MascaraData, mensagemVisivel } from '@gymos/shared-forms';
import { Button, Field, FieldControl, Modal, Select, type SelectOption } from '@gymos/ui';
import type { NovoLancamento } from '../models/financeiro';

const TIPOS: readonly SelectOption[] = [
  { value: 'despesa', label: 'Despesa' },
  { value: 'receita', label: 'Receita avulsa' },
];
const CATEGORIAS: readonly SelectOption[] = [
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'contas', label: 'Contas' },
  { value: 'outros', label: 'Outros' },
];
const SETORES: readonly SelectOption[] = [
  { value: 'musculacao', label: 'Planos de musculação' },
  { value: 'aulas', label: 'Aulas coletivas' },
  { value: 'lutas', label: 'Lutas' },
  { value: 'loja', label: 'Loja' },
  { value: 'personal', label: 'Personal' },
  { value: 'nutricao', label: 'Nutrição' },
];

/** `19/11/2026` → `2026-11-19`; texto incompleto ou inexistente vira `null`. */
export function dataParaIso(texto: string): string | null {
  const achado = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!achado) {
    return null;
  }
  const [, dia = '', mes = '', ano = ''] = achado;
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  const confere =
    data.getUTCFullYear() === Number(ano) &&
    data.getUTCMonth() === Number(mes) - 1 &&
    data.getUTCDate() === Number(dia);
  return confere ? `${ano}-${mes}-${dia}` : null;
}

/** Cadastro de despesa ou receita avulsa. A folha não entra aqui: vem do custo do funcionário. */
@Component({
  selector: 'app-novo-lancamento',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Modal,
    Button,
    Field,
    FieldControl,
    Select,
    KeyboardSafe,
    MascaraBrl,
    MascaraData,
  ],
  styles: `
    form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .lancamento__campo {
      box-sizing: border-box;
      width: 100%;
      height: 44px;
      padding: 0 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-regular) 14px var(--font);
    }
    .lancamento__campo:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .lancamento__linha {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .lancamento__rodape {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .lancamento__falha {
      margin: 0;
      font-size: 13px;
      color: var(--badge-late-fg);
    }
  `,
  template: `
    <ui-modal heading="Novo lançamento" [(open)]="aberto">
      <form [formGroup]="form" appKeyboardSafe (ngSubmit)="enviar()" novalidate>
        <div class="lancamento__linha">
          <ui-field label="Tipo">
            <ui-select [options]="tipos" [value]="tipo()" (valueChange)="escolherTipo($event)" />
          </ui-field>
          <ui-field label="Categoria">
            <ui-select
              [options]="categorias"
              [value]="categoria()"
              (valueChange)="categoria.set($event)"
            />
          </ui-field>
        </div>
        <ui-field
          label="Setor"
          [hint]="tipo() === 'despesa' ? 'Sem setor, a despesa fica geral.' : undefined"
          [error]="erros().setor"
        >
          <ui-select
            [options]="setores()"
            [value]="setor()"
            (valueChange)="setor.set($event)"
            placeholder="Escolha o setor"
          />
        </ui-field>
        <div class="lancamento__linha">
          <ui-field label="Valor" [error]="erros().valor">
            <input
              uiFieldControl
              appBrl
              class="lancamento__campo"
              formControlName="valorCentavos"
              enterkeyhint="next"
            />
          </ui-field>
          <ui-field label="Data" [error]="erros().data">
            <input
              uiFieldControl
              appData
              class="lancamento__campo"
              formControlName="data"
              enterkeyhint="next"
            />
          </ui-field>
        </div>
        <ui-field label="Descrição (opcional)">
          <input
            uiFieldControl
            class="lancamento__campo"
            formControlName="descricao"
            maxlength="200"
            autocomplete="off"
            enterkeyhint="done"
          />
        </ui-field>
        @if (falha()) {
          <p class="lancamento__falha" role="alert">{{ falha() }}</p>
        }
        <div class="lancamento__rodape">
          <ui-button variant="outline" type="button" (click)="aberto.set(false)"
            >Cancelar</ui-button
          >
          <ui-button type="submit" [loading]="salvando()">Salvar lançamento</ui-button>
        </div>
      </form>
    </ui-modal>
  `,
})
export class NovoLancamentoModal {
  readonly aberto = model(false);
  readonly salvando = input(false);
  readonly falha = input<string | null>(null);
  readonly salvar = output<NovoLancamento>();

  protected readonly tipos = TIPOS;
  protected readonly categorias = CATEGORIAS;
  protected readonly tipo = signal('despesa');
  protected readonly categoria = signal('aluguel');
  protected readonly setor = signal('');
  private readonly enviado = signal(false);

  protected readonly form = new FormGroup({
    valorCentavos: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    data: new FormControl('', [Validators.required]),
    descricao: new FormControl(''),
  });
  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  /** Despesa aceita "sem setor" (geral); a receita avulsa precisa do setor que a recebe. */
  protected readonly setores = computed<readonly SelectOption[]>(() =>
    this.tipo() === 'despesa' ? [{ value: '', label: 'Geral (sem setor)' }, ...SETORES] : SETORES,
  );

  protected readonly erros = computed(() => {
    const enviado = this.enviado();
    this.valores();
    const { valorCentavos, data } = this.form.controls;
    return {
      valor: mensagemVisivel(valorCentavos, enviado) ? 'Informe o valor.' : undefined,
      data:
        enviado && dataParaIso(data.value ?? '') === null ? 'Informe uma data válida.' : undefined,
      setor:
        enviado && this.tipo() === 'receita' && !this.setor()
          ? 'Escolha o setor da receita.'
          : undefined,
    };
  });

  protected escolherTipo(tipo: string): void {
    this.tipo.set(tipo);
    if (tipo === 'receita' && !this.setor()) {
      this.setor.set(SETORES[0]?.value ?? '');
    }
  }

  protected enviar(): void {
    this.enviado.set(true);
    const { valorCentavos, data, descricao } = this.form.getRawValue();
    const iso = dataParaIso(data ?? '');
    if (!valorCentavos || iso === null || (this.tipo() === 'receita' && !this.setor())) {
      return;
    }
    this.salvar.emit({
      tipo: this.tipo() as NovoLancamento['tipo'],
      categoria: this.categoria() as NovoLancamento['categoria'],
      setor: (this.setor() || null) as NovoLancamento['setor'],
      valorCentavos,
      data: iso,
      descricao: descricao?.trim() || null,
    });
  }

  /** Limpa o formulário depois de salvar. */
  limpar(): void {
    this.enviado.set(false);
    this.tipo.set('despesa');
    this.categoria.set('aluguel');
    this.setor.set('');
    this.form.reset({ valorCentavos: null, data: '', descricao: '' });
  }
}
