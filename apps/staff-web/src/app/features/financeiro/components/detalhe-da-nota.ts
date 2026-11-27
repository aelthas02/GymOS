import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { KeyboardSafe, MascaraBrl, MascaraCpf, Permission, Validadores } from '@gymos/shared-forms';
import { BrlPipe, DataBrPipe, PercentualPipe } from '@gymos/shared-pipes';
import { Badge, Button, Field, FieldControl } from '@gymos/ui';
import type { NotaFiscalDetalhe } from '../models/notas';
import { SITUACAO_DA_NOTA } from '../utils/notas';
import { ESTILOS_DO_FINANCEIRO } from './estilos-do-financeiro';

export interface CorrecaoPedida {
  cpf: string;
  descricao: string;
  valorCentavos: number;
}

/** Conteúdo do drawer "Ver" e "Corrigir" de uma nota: só apresentação, as ações sobem por output. */
@Component({
  selector: 'app-detalhe-da-nota',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Badge,
    Button,
    Field,
    FieldControl,
    MascaraCpf,
    MascaraBrl,
    KeyboardSafe,
    Permission,
    BrlPipe,
    DataBrPipe,
    PercentualPipe,
  ],
  styles: `
    ${ESTILOS_DO_FINANCEIRO}
    :host {
      gap: 16px;
    }
    .detalhe__topo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .detalhe__numero {
      font-size: 20px;
      font-weight: var(--font-weight-bold);
    }
    .detalhe__acoes {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .detalhe__campo {
      box-sizing: border-box;
      width: 100%;
      height: 44px;
      padding: 0 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      font-size: 14px;
    }
  `,
  template: `
    @let n = nota();
    <div class="detalhe__topo">
      <span class="detalhe__numero">{{ n.rotulo ?? n.tipoExibido }}</span>
      <ui-badge [variant]="situacao().variante">{{ situacao().rotulo }}</ui-badge>
    </div>
    @if (n.situacao === 'rejeitada' || n.situacao === 'cancelada') {
      <div class="fin-aviso" [class.fin-aviso--erro]="n.situacao === 'rejeitada'">
        {{ n.atencao }}
      </div>
    }
    <div>
      <div class="fin-linha-de-valor">
        <span>Cliente</span><span>{{ n.cliente }}</span>
      </div>
      <div class="fin-linha-de-valor">
        <span>CPF</span><span>{{ n.cpf ?? '—' }}</span>
      </div>
      <div class="fin-linha-de-valor">
        <span>Descrição</span><span>{{ n.descricao }}</span>
      </div>
      <div class="fin-linha-de-valor">
        <span>Tipo</span><span>{{ n.tipoExibido }} · {{ n.codigoDoServico }}</span>
      </div>
      <div class="fin-linha-de-valor">
        <span>Competência</span><span>{{ n.competenciaExibida }}</span>
      </div>
      <div class="fin-linha-de-valor">
        <span>Valor</span><span>{{ n.valorCentavos | brl }}</span>
      </div>
      <div class="fin-linha-de-valor">
        <span>ISS ({{ n.aliquotaIssPontosBase | percent }})</span
        ><span>{{ n.issCentavos | brl }}</span>
      </div>
      <div class="fin-linha-de-valor">
        <span>Retenções</span><span>{{ n.retencoesCentavos | brl }}</span>
      </div>
      <div class="fin-linha-de-valor">
        <span>{{ n.emitidaEm ? 'Emitida em' : 'Criada em' }}</span><span>{{
          n.data | dateBr: 'dataHora'
        }}</span>
      </div>
    </div>

    @if (n.situacao === 'rejeitada') {
      <form
        appKeyboardSafe
        novalidate
        [formGroup]="correcao"
        (ngSubmit)="enviarCorrecao()"
        *appPermission="'financeiro:criar'"
      >
        <ui-field label="CPF" [error]="erroDoCpf()">
          <input uiFieldControl appCpf class="detalhe__campo" formControlName="cpf" />
        </ui-field>
        <ui-field label="Descrição">
          <input uiFieldControl class="detalhe__campo" formControlName="descricao" />
        </ui-field>
        <ui-field label="Valor">
          <input uiFieldControl appBrl class="detalhe__campo" formControlName="valorCentavos" />
        </ui-field>
        <ui-button type="submit" variant="accent" [block]="true" [loading]="ocupado()">
          Corrigir e reenviar
        </ui-button>
      </form>
    } @else {
      <div class="detalhe__acoes">
        @if (n.temPdf) {
          <ui-button variant="outline" size="sm" (click)="abrirArquivo.emit('pdf')">PDF</ui-button>
        }
        @if (n.temXml) {
          <ui-button variant="outline" size="sm" (click)="abrirArquivo.emit('xml')">XML</ui-button>
        }
        @if (n.situacao === 'emitida') {
          <ng-container *appPermission="'financeiro:criar'">
            <ui-button variant="outline" size="sm" [loading]="ocupado()" (click)="enviar.emit()">
              Enviar ao aluno
            </ui-button>
          </ng-container>
        }
        @if (n.situacao === 'pendente' || n.situacao === 'processando') {
          <ng-container *appPermission="'financeiro:criar'">
            <ui-button variant="accent" size="sm" [loading]="ocupado()" (click)="reenviar.emit()">
              {{ n.situacao === 'pendente' ? 'Emitir' : 'Consultar o emissor' }}
            </ui-button>
          </ng-container>
        }
      </div>
      @if (n.situacao !== 'cancelada' && n.situacao !== 'processando') {
        <form
          novalidate
          [formGroup]="cancelamento"
          (ngSubmit)="enviarCancelamento()"
          *appPermission="'financeiro:excluir'"
        >
          <ui-field label="Motivo do cancelamento" [error]="erroDoMotivo()">
            <input uiFieldControl class="detalhe__campo" formControlName="motivo" />
          </ui-field>
          <ui-button type="submit" variant="danger" [loading]="ocupado()">Cancelar nota</ui-button>
        </form>
      }
    }
  `,
})
export class DetalheDaNota {
  readonly nota = input.required<NotaFiscalDetalhe>();
  readonly ocupado = input(false);

  readonly corrigir = output<CorrecaoPedida>();
  readonly cancelar = output<string>();
  readonly reenviar = output<void>();
  readonly enviar = output<void>();
  readonly abrirArquivo = output<'pdf' | 'xml'>();

  protected readonly situacao = computed(() => SITUACAO_DA_NOTA[this.nota().situacao]);

  protected readonly correcao = new FormGroup({
    cpf: new FormControl<string | null>(null, [Validators.required, Validadores.cpf]),
    descricao: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    valorCentavos: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
  });
  protected readonly cancelamento = new FormGroup({
    motivo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
  });

  private readonly tentouCorrigir = signal(false);
  private readonly tentouCancelar = signal(false);
  protected readonly erroDoCpf = computed(() =>
    this.tentouCorrigir() && this.correcao.controls.cpf.invalid ? 'CPF inválido.' : undefined,
  );
  protected readonly erroDoMotivo = computed(() =>
    this.tentouCancelar() && this.cancelamento.invalid ? 'Informe o motivo.' : undefined,
  );

  constructor() {
    effect(() => {
      const nota = this.nota();
      this.correcao.reset({
        cpf: nota.cpf?.replace(/\D/g, '') ?? null,
        descricao: nota.descricao,
        valorCentavos: nota.valorCentavos,
      });
      this.cancelamento.reset();
      this.tentouCorrigir.set(false);
      this.tentouCancelar.set(false);
    });
  }

  protected enviarCorrecao(): void {
    this.tentouCorrigir.set(true);
    const { cpf, descricao, valorCentavos } = this.correcao.getRawValue();
    if (this.correcao.invalid || !cpf || !valorCentavos) {
      return;
    }
    this.corrigir.emit({ cpf, descricao, valorCentavos });
  }

  protected enviarCancelamento(): void {
    this.tentouCancelar.set(true);
    if (this.cancelamento.valid) {
      this.cancelar.emit(this.cancelamento.controls.motivo.value.trim());
    }
  }
}
