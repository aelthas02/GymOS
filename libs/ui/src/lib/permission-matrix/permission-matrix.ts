import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { Badge, type BadgeVariant } from '../badge/badge';

export type PermissionAction = 'ver' | 'criar' | 'editar' | 'excluir';

export const permissionActions: readonly {
  readonly action: PermissionAction;
  readonly label: string;
}[] = [
  { action: 'ver', label: 'Ver' },
  { action: 'criar', label: 'Criar' },
  { action: 'editar', label: 'Editar' },
  { action: 'excluir', label: 'Excluir' },
];

export interface PermissionRow {
  readonly id: string;
  readonly label: string;
  /** Ações liberadas neste módulo. */
  readonly granted: readonly PermissionAction[];
  /** Linha que o usuário não pode alterar (por exemplo, "Só administrador"). */
  readonly readOnly?: boolean;
  /** Selo ao lado do módulo ("Só administrador", "Parcial"). */
  readonly note?: { readonly text: string; readonly variant: BadgeVariant };
}

export interface PermissionChange {
  readonly id: string;
  readonly granted: readonly PermissionAction[];
}

/**
 * Matriz de permissões: módulo × Ver, Criar, Editar e Excluir. Sem "Ver" marcado, as outras ações
 * da linha ficam desabilitadas, e desmarcar "Ver" limpa as demais. Linhas `readOnly` só mostram.
 * Recebe os dados prontos (quais módulos e ações existem é regra de negócio de quem usa).
 */
@Component({
  selector: 'ui-permission-matrix',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Badge],
  styles: `
    :host {
      display: block;
      overflow-x: auto;
    }
    table {
      min-width: 560px;
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th {
      padding: 10px 16px;
      color: var(--muted);
      font-size: 12px;
      font-weight: var(--font-weight-semibold);
      letter-spacing: 0.8px;
      text-align: center;
      text-transform: uppercase;
    }
    th:first-child {
      text-align: left;
    }
    thead th:not(:first-child) {
      width: 78px;
    }
    tbody tr {
      border-top: 1px solid var(--divider);
    }
    tbody th {
      color: var(--ink);
      font-size: 14px;
      font-weight: var(--font-weight-semibold);
      letter-spacing: 0;
      text-transform: none;
    }
    td {
      padding: 10px 8px;
      text-align: center;
    }
    input {
      width: 22px;
      height: 22px;
      margin: 0;
      accent-color: var(--accent-text);
      cursor: pointer;
    }
    input:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
    input:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
  `,
  template: `
    <table [attr.aria-label]="label()">
      <thead>
        <tr>
          <th scope="col">Módulo</th>
          @for (coluna of colunas; track coluna.action) {
            <th scope="col">{{ coluna.label }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (linha of rows(); track linha.id) {
          <tr>
            <th scope="row">
              {{ linha.label }}
              @if (linha.note; as nota) {
                &ngsp;<ui-badge [variant]="nota.variant">{{ nota.text }}</ui-badge>
              }
            </th>
            @for (coluna of colunas; track coluna.action) {
              <td>
                <input
                  type="checkbox"
                  [checked]="linha.granted.includes(coluna.action)"
                  [disabled]="desabilitada(linha, coluna.action)"
                  [attr.aria-label]="linha.label + ', ' + coluna.label.toLowerCase()"
                  (change)="alternar(linha, coluna.action, $event)"
                />
              </td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class PermissionMatrix {
  readonly rows = model.required<readonly PermissionRow[]>();
  readonly label = input<string>();

  /** Emite a linha alterada; `rows` já recebe o novo valor quando usado com `[(rows)]`. */
  readonly rowChange = output<PermissionChange>();

  protected readonly colunas = permissionActions;

  protected desabilitada(linha: PermissionRow, acao: PermissionAction): boolean {
    return !!linha.readOnly || (acao !== 'ver' && !linha.granted.includes('ver'));
  }

  protected alternar(linha: PermissionRow, acao: PermissionAction, evento: Event): void {
    if (this.desabilitada(linha, acao)) return;

    const marcada = (evento.target as HTMLInputElement).checked;
    // Sem "Ver" não há o que criar, editar ou excluir.
    const granted = marcada
      ? permissionActions
          .map((a) => a.action)
          .filter((a) => a === acao || linha.granted.includes(a))
      : acao === 'ver'
        ? []
        : linha.granted.filter((a) => a !== acao);

    this.rows.update((linhas) => linhas.map((l) => (l.id === linha.id ? { ...l, granted } : l)));
    this.rowChange.emit({ id: linha.id, granted });
  }
}
