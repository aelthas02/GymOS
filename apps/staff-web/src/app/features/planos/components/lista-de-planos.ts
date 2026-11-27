import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { centavos, formatarBrl } from '@gymos/shared-money';
import { Permission } from '@gymos/shared-forms';
import { Badge, Button, Table, TableCell, type TableColumn } from '@gymos/ui';
import type { Plano } from '../models/plano';
import { textoDaDuracao, textoDasParcelas, textoDoQueInclui } from '../utils/apresentacao';

/** Colunas de `Planos.html` (as larguras são as da grade do protótipo). */
const COLUNAS: readonly TableColumn[] = [
  { key: 'nome', label: 'Plano', width: 'minmax(100px, 1fr)' },
  { key: 'valorTotal', label: 'Valor total', width: 'minmax(100px, 0.9fr)' },
  { key: 'duracao', label: 'Duração', width: '80px' },
  { key: 'parcelas', label: 'Parcelas', width: 'minmax(120px, 1fr)' },
  { key: 'inclui', label: 'Inclui', width: 'minmax(120px, 1.1fr)' },
  { key: 'alunos', label: 'Alunos', width: '56px' },
  { key: 'status', label: 'Status', width: '76px' },
  { key: 'acoes', label: 'Ações', width: 'minmax(150px, 1fr)' },
];

/** Lista de planos: só mostra o que a API entregou e avisa qual plano o usuário quer editar ou excluir. */
@Component({
  selector: 'app-lista-de-planos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Table, TableCell, Badge, Button, Permission],
  styles: `
    :host {
      display: block;
      --ui-table-gap: 10px;
    }
    .lista__acoes {
      display: flex;
      gap: 6px;
    }
  `,
  template: `
    <ui-table label="Planos da academia" minWidth="900px" [columns]="colunas" [rows]="linhas()">
      <ng-template uiTableCell="nome" let-linha
        ><b>{{ linha.nome }}</b></ng-template
      >
      <ng-template uiTableCell="status" let-linha>
        <ui-badge [variant]="linha.ativo ? 'ok' : 'off'">{{
          linha.ativo ? 'Ativo' : 'Inativo'
        }}</ui-badge>
      </ng-template>
      <ng-template uiTableCell="acoes" let-linha>
        <div class="lista__acoes">
          <ui-button
            *appPermission="'planos:editar'"
            variant="outline"
            size="sm"
            (click)="editar.emit(linha.plano)"
          >
            Editar
          </ui-button>
          <ui-button
            *appPermission="'planos:excluir'"
            variant="danger"
            size="sm"
            (click)="excluir.emit(linha.plano)"
          >
            Excluir
          </ui-button>
        </div>
      </ng-template>
    </ui-table>
  `,
})
export class ListaDePlanos {
  readonly planos = input.required<readonly Plano[]>();
  readonly editar = output<Plano>();
  readonly excluir = output<Plano>();

  protected readonly colunas = COLUNAS;
  protected readonly linhas = computed(() =>
    this.planos().map((plano) => ({
      nome: plano.nome,
      valorTotal: formatarBrl(centavos(plano.valorTotalCentavos)),
      duracao: textoDaDuracao(plano.duracaoMeses),
      parcelas: textoDasParcelas(plano),
      inclui: textoDoQueInclui(plano.modalidades),
      alunos: plano.alunosAtivos,
      ativo: plano.ativo,
      plano,
    })),
  );
}
