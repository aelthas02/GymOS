import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Permission } from '@gymos/shared-forms';
import { Avatar, Badge, Button, Icon, Table, TableCell, type TableColumn } from '@gymos/ui';
import type { ItemDaLista } from '../models/aluno';
import { nomeDoPlano, textoDaSituacao, variantDaSituacao } from '../utils/apresentacao';

/** Colunas de `Alunos.html` (as larguras são as da grade do protótipo). */
const COLUNAS: readonly TableColumn[] = [
  { key: 'aluno', label: 'Aluno', width: 'minmax(190px, 1.4fr)' },
  { key: 'plano', label: 'Plano', width: 'minmax(110px, 0.8fr)' },
  { key: 'situacao', label: 'Adimplência', width: 'minmax(140px, 1fr)' },
  { key: 'acoes', label: 'Ações', width: 'minmax(300px, 2fr)' },
];

/** Lista de alunos: mostra o que a API entregou e avisa qual ação o usuário pediu. */
@Component({
  selector: 'app-lista-de-alunos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Table, TableCell, Avatar, Badge, Button, Icon, RouterLink, Permission],
  styles: `
    :host {
      display: block;
    }
    .aluno {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .aluno b {
      font-weight: var(--font-weight-semibold);
    }
    .acoes {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    /* O protótipo não tem a borda transparente do botão: 13 px + 1 px de borda dão os 14 px da tela. */
    :host ::ng-deep .acoes ui-button button {
      padding: 0 13px;
    }
    :host ::ng-deep .ui-table__footer {
      padding-block: 14px;
    }
    .acoes__divisor {
      width: 1px;
      height: 24px;
      margin: 0 4px;
      background: var(--border);
    }
    .icone {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--surface);
      color: var(--ink);
      cursor: pointer;
    }
    .icone--whatsapp {
      border: 0;
      background: var(--accent);
      color: var(--accent-contrast);
    }
    .icone--excluir {
      border-color: var(--state-error-border);
      background: var(--badge-late-bg);
      color: var(--badge-late-fg);
    }
    .icone:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
  `,
  template: `
    <ui-table
      label="Alunos da academia"
      minWidth="860px"
      unit="alunos"
      [columns]="colunas"
      [rows]="linhas()"
      [total]="total()"
      [page]="pagina()"
      [pageSize]="porPagina()"
      (pageChange)="mudarPagina($event)"
    >
      <ng-template uiTableCell="aluno" let-linha>
        <div class="aluno">
          <ui-avatar [name]="linha.nome" [decorative]="true" />
          <b>{{ linha.nome }}</b>
        </div>
      </ng-template>
      <ng-template uiTableCell="situacao" let-linha>
        <ui-badge [variant]="linha.variante">{{ linha.situacao }}</ui-badge>
      </ng-template>
      <ng-template uiTableCell="acoes" let-linha>
        <div class="acoes">
          <ui-button size="sm" [routerLink]="['/alunos', linha.id, 'acompanhamento']">
            Acompanhamento
          </ui-button>
          <span class="acoes__divisor" aria-hidden="true"></span>
          <a
            *appPermission="'alunos:editar'"
            class="icone"
            title="Editar"
            aria-label="Editar"
            [routerLink]="['/alunos', linha.id]"
          >
            <ui-icon name="edit" [size]="18" />
          </a>
          <a
            class="icone"
            title="Ficha de treino"
            aria-label="Ficha de treino"
            [routerLink]="['/alunos', linha.id, 'ficha']"
          >
            <ui-icon name="list" [size]="18" />
          </a>
          <a
            class="icone icone--whatsapp"
            title="WhatsApp"
            aria-label="WhatsApp"
            [routerLink]="['/recepcao']"
            [queryParams]="{ aluno: linha.id }"
          >
            <ui-icon name="chat" [size]="18" />
          </a>
          <button
            *appPermission="'alunos:excluir'"
            type="button"
            class="icone icone--excluir"
            title="Excluir"
            aria-label="Excluir"
            (click)="excluir.emit(linha.item)"
          >
            <ui-icon name="trash" [size]="18" />
          </button>
        </div>
      </ng-template>
    </ui-table>
  `,
})
export class ListaDeAlunos {
  readonly itens = input.required<readonly ItemDaLista[]>();
  readonly total = input.required<number>();
  readonly pagina = input.required<number>();
  readonly porPagina = input.required<number>();

  readonly excluir = output<ItemDaLista>();
  readonly paginaMudou = output<number>();

  protected readonly colunas = COLUNAS;
  protected readonly linhas = computed(() =>
    this.itens().map((item) => ({
      id: item.id,
      nome: item.nome,
      plano: nomeDoPlano(item),
      situacao: textoDaSituacao(item),
      variante: variantDaSituacao(item.situacao),
      item,
    })),
  );

  protected mudarPagina(pagina: number): void {
    this.paginaMudou.emit(pagina);
  }
}
