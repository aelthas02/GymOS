import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type AgendaEstado =
  'livre' | 'realizada' | 'confirmada' | 'cancelada' | 'nao-compareceu' | 'aguardando' | 'almoco';

/** Variante visual de um estado: o rótulo exibido e a classe de estilo da célula. */
export interface AgendaVariante {
  readonly rotulo: string;
  readonly classe: string;
}

const variantes: Readonly<Record<AgendaEstado, AgendaVariante>> = {
  livre: { rotulo: 'Livre', classe: 'ui-agenda__celula--livre' },
  realizada: { rotulo: 'Realizada', classe: 'ui-agenda__celula--realizada' },
  confirmada: { rotulo: 'Confirmada', classe: 'ui-agenda__celula--confirmada' },
  cancelada: { rotulo: 'Cancelada', classe: 'ui-agenda__celula--cancelada' },
  'nao-compareceu': { rotulo: 'Não compareceu', classe: 'ui-agenda__celula--nao-compareceu' },
  aguardando: { rotulo: 'Aguardando', classe: 'ui-agenda__celula--aguardando' },
  almoco: { rotulo: 'Almoço', classe: 'ui-agenda__celula--almoco' },
};

export function agendaVarianteDe(estado: AgendaEstado): AgendaVariante {
  return variantes[estado];
}

export interface AgendaCelula {
  readonly estado: AgendaEstado;
  /** Quem está no horário; sem ele, a célula mostra só o rótulo do estado. */
  readonly nome?: string;
}

export interface AgendaDia {
  readonly label: string;
  readonly hoje?: boolean;
}

export interface AgendaLinha {
  readonly hora: string;
  /** Uma célula por dia, na ordem de `days`. */
  readonly celulas: readonly AgendaCelula[];
}

export interface AgendaSelecao {
  readonly dia: AgendaDia;
  readonly hora: string;
  readonly celula: AgendaCelula;
}

/**
 * Agenda por hora e por dia. Cada célula é Livre, Almoço (bloqueio) ou um atendimento com o
 * estado Realizada, Confirmada, Cancelada, Não compareceu ou Aguardando. Com `interactive`, os
 * horários livres e os atendimentos viram botões que emitem `cellSelected`.
 */
@Component({
  selector: 'ui-agenda-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  styles: `
    :host {
      display: block;
      overflow-x: auto;
    }
    table {
      min-width: 640px;
      width: 100%;
      border-collapse: separate;
      border-spacing: 8px 6px;
      table-layout: fixed;
    }
    th.ui-agenda__hora {
      width: 56px;
      padding-top: 10px;
      color: var(--muted);
      font-size: 12px;
      font-weight: var(--font-weight-regular);
      text-align: left;
      vertical-align: top;
    }
    thead th {
      padding: 8px 0;
      border-radius: var(--radius-control);
      background: var(--divider);
      color: var(--ink);
      font-size: 13px;
      font-weight: var(--font-weight-bold);
    }
    thead th.ui-agenda__hoje {
      background: var(--ink);
      color: var(--on-ink);
    }
    .ui-agenda__marca {
      display: block;
      color: var(--accent);
      font-size: 11px;
      font-weight: var(--font-weight-semibold);
    }
    td {
      padding: 0;
      vertical-align: top;
    }
    .ui-agenda__celula {
      display: flex;
      flex-direction: column;
      justify-content: center;
      box-sizing: border-box;
      width: 100%;
      min-height: 40px;
      padding: 7px 10px;
      border: 0;
      border-left: 5px solid transparent;
      border-radius: var(--radius-control);
      font: inherit;
      font-size: 11px;
      text-align: left;
    }
    button.ui-agenda__celula {
      cursor: pointer;
    }
    button.ui-agenda__celula:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .ui-agenda__nome {
      font-size: 13px;
      font-weight: var(--font-weight-bold);
    }
    .ui-agenda__celula--livre,
    .ui-agenda__celula--almoco {
      align-items: center;
      border-left: 0;
      font-size: 12px;
    }
    .ui-agenda__celula--livre {
      border: 1px dashed var(--border-dashed);
      background: var(--surface);
      color: var(--muted);
    }
    .ui-agenda__celula--almoco {
      background: repeating-linear-gradient(
        45deg,
        var(--page),
        var(--page) 6px,
        var(--divider) 6px,
        var(--divider) 12px
      );
      color: var(--muted);
      font-size: 11px;
    }
    .ui-agenda__celula--realizada {
      border-left-color: var(--agenda-done-bar);
      background: var(--agenda-done-bg);
      color: var(--agenda-done-fg);
    }
    .ui-agenda__celula--confirmada {
      border-left-color: var(--agenda-confirmed-bar);
      background: var(--agenda-confirmed-bg);
      color: var(--agenda-confirmed-fg);
    }
    .ui-agenda__celula--cancelada {
      border-left-color: var(--agenda-cancelled-bar);
      background: var(--agenda-cancelled-bg);
      color: var(--agenda-cancelled-fg);
    }
    .ui-agenda__celula--cancelada .ui-agenda__nome {
      text-decoration: line-through;
    }
    .ui-agenda__celula--nao-compareceu {
      border-left-color: var(--agenda-noshow-bar);
      background: var(--agenda-noshow-bg);
      color: var(--agenda-noshow-fg);
    }
    .ui-agenda__celula--aguardando {
      border-left-color: var(--agenda-waiting-bar);
      background: var(--agenda-waiting-bg);
      color: var(--agenda-waiting-fg);
    }
  `,
  template: `
    <table [attr.aria-label]="label()">
      <thead>
        <tr>
          <td></td>
          @for (dia of days(); track dia.label) {
            <th scope="col" [class.ui-agenda__hoje]="dia.hoje">
              {{ dia.label }}
              @if (dia.hoje) {
                <span class="ui-agenda__marca">hoje</span>
              }
            </th>
          }
        </tr>
      </thead>
      <tbody>
        @for (linha of rows(); track linha.hora) {
          <tr>
            <th scope="row" class="ui-agenda__hora">{{ linha.hora }}</th>
            @for (celula of linha.celulas; track $index; let i = $index) {
              <td>
                @if (interativa(celula)) {
                  <button
                    type="button"
                    class="ui-agenda__celula"
                    [class]="variante(celula).classe"
                    [attr.aria-label]="descricao(celula, linha.hora, i)"
                    (click)="selecionar(celula, linha.hora, i)"
                  >
                    <ng-container *ngTemplateOutlet="conteudo; context: { $implicit: celula }" />
                  </button>
                } @else {
                  <div class="ui-agenda__celula" [class]="variante(celula).classe">
                    <ng-container *ngTemplateOutlet="conteudo; context: { $implicit: celula }" />
                  </div>
                }
              </td>
            }
          </tr>
        }
      </tbody>
    </table>

    <ng-template #conteudo let-celula>
      @if (celula.nome) {
        <span class="ui-agenda__nome">{{ celula.nome }}</span>
      }
      <span>{{ variante(celula).rotulo }}</span>
    </ng-template>
  `,
})
export class AgendaGrid {
  readonly days = input.required<readonly AgendaDia[]>();
  readonly rows = input.required<readonly AgendaLinha[]>();
  readonly interactive = input(false);
  readonly label = input<string>();

  readonly cellSelected = output<AgendaSelecao>();

  protected variante(celula: AgendaCelula): AgendaVariante {
    return agendaVarianteDe(celula.estado);
  }

  protected interativa(celula: AgendaCelula): boolean {
    return this.interactive() && celula.estado !== 'almoco';
  }

  protected selecionar(celula: AgendaCelula, hora: string, indice: number): void {
    const dia = this.days()[indice];
    if (dia) this.cellSelected.emit({ dia, hora, celula });
  }

  protected descricao(celula: AgendaCelula, hora: string, indice: number): string {
    const dia = this.days()[indice]?.label ?? '';
    const quem = celula.nome ? `${celula.nome}, ` : '';
    return `${dia}, ${hora}: ${quem}${this.variante(celula).rotulo}`;
  }
}
