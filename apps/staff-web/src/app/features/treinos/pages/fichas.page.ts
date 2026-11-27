import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Permission } from '@gymos/shared-forms';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  NoPermissionState,
  PageHeader,
  Skeleton,
  Table,
  TableCell,
  type TableColumn,
  ToastService,
  TutorialOverlay,
} from '@gymos/ui';
import { AbasDeTreinos } from '../components/abas-de-treinos';
import { FICHAS_POR_PAGINA, FichasStore } from '../data-access/treinos.store';
import type { LinhaDeFicha } from '../models/treinos';
import { dataBr, mensagemDaApi, primeiroNome, situacaoDaLinha } from '../utils/apresentacao';
import { TUTORIAL_TREINOS } from '../utils/tutorial';

/** Colunas de `TreinosFichas.html` (as larguras são as da grade do protótipo). */
const COLUNAS: readonly TableColumn[] = [
  { key: 'aluno', label: 'Aluno', width: '1.4fr' },
  { key: 'ficha', label: 'Ficha', width: '1.4fr' },
  { key: 'professor', label: 'Professor', width: '1fr' },
  { key: 'validade', label: 'Validade', width: '1fr' },
  { key: 'situacao', label: 'Situação', width: '1.3fr' },
  { key: 'acoes', label: '', width: '150px' },
];

/** Fichas de treino dos alunos (`/treinos/fichas`, `TreinosFichas.html`). */
@Component({
  selector: 'app-fichas-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [FichasStore],
  imports: [
    PageHeader,
    Button,
    Avatar,
    Badge,
    Table,
    TableCell,
    Skeleton,
    EmptyState,
    ErrorState,
    NoPermissionState,
    TutorialOverlay,
    Permission,
    RouterLink,
    AbasDeTreinos,
  ],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 22px;
    }
    /* Janelas e tutorial não ocupam lugar no fluxo (o gap do host não abre vazio ao fim da tela). */
    ui-modal,
    ui-tutorial-overlay {
      display: contents;
    }
    .indicadores {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
    }
    .indicador {
      flex: 1 1 200px;
      min-width: 0;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
    }
    .indicador__rotulo {
      color: var(--muted);
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
    }
    .indicador__valor {
      margin-top: 2px;
      font-size: 28px;
      font-weight: var(--font-weight-bold);
    }
    .indicador__valor--aviso {
      color: var(--badge-soon-fg);
    }
    .indicador__valor--alerta {
      color: var(--badge-late-fg);
    }
    .indicador__legenda {
      margin-top: 2px;
      color: var(--muted);
      font-size: 12px;
    }
    button.indicador__legenda {
      display: block;
      padding: 0;
      border: 0;
      background: none;
      font-family: inherit;
      cursor: pointer;
    }
    button.indicador__legenda:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .corpo {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      align-items: flex-start;
    }
    .tabela {
      flex: 1.7 1 560px;
      min-width: 0;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
    }
    .tabela__cabecalho {
      padding: 18px 20px 8px;
    }
    h2 {
      margin: 0;
      font-size: 16px;
      font-weight: var(--font-weight-bold);
    }
    .tabela__cabecalho p {
      margin: 3px 0 0;
      color: var(--muted);
      font-size: 13px;
    }
    .aluno {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .acoes {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sugeridas {
      flex: 1 1 300px;
      align-self: flex-start;
      min-width: 0;
      padding: 20px;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
    }
    .sugeridas__texto {
      margin: 12px 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }
    .sugerida {
      margin-bottom: 10px;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 12px;
    }
    .sugerida__resumo {
      margin: 2px 0 10px;
      color: var(--muted);
      font-size: 13px;
    }
    .sugerida__acoes {
      display: flex;
      gap: 8px;
    }
    .vazio {
      padding: 16px;
    }
    ui-table {
      /* A tabela mora dentro do cartão "Fichas dos alunos": sem borda própria. */
      --ui-table-gap: 10px;
      border: 0;
      border-radius: 0;
    }
    :host ::ng-deep .acoes ui-button button {
      min-height: 34px;
      padding: 0 11px;
    }
    :host ::ng-deep .acoes ui-button button.ui-button--outline {
      padding: 0 12px;
    }
    :host ::ng-deep .sugerida__acoes ui-button button {
      min-height: 36px;
      padding: 0 15px;
    }
    :host ::ng-deep .sugerida__acoes ui-button button.ui-button--outline {
      padding: 0 16px;
    }
    :host ::ng-deep ui-page-header ui-button button {
      min-height: 44px;
      padding: 0 15px;
    }
    :host ::ng-deep ui-page-header ui-button button.ui-button--outline {
      padding: 0 16px;
    }
  `,
  template: `
    <ui-page-header
      data-tutorial="cabecalho"
      heading="Treinos"
      subtitle="Fichas de treino, aprovações e validade."
      (helpClick)="tutorialAberto.set(true)"
    >
      <ui-button *appPermission="'treinos:criar'" actions size="lg" routerLink="/alunos">
        Nova ficha
      </ui-button>
    </ui-page-header>

    <app-abas-de-treinos ativa="fichas" />

    @switch (store.estado()) {
      @case ('carregando') {
        <div class="vazio" aria-busy="true">
          @for (linha of linhasDeEspera; track linha) {
            <ui-skeleton height="44px" />
          }
        </div>
      }
      @case ('erro') {
        <ui-error-state
          heading="Não foi possível carregar as fichas"
          description="Confira a conexão e tente de novo."
          (retry)="store.carregar()"
        />
      }
      @case ('sem-permissao') {
        <ui-no-permission-state />
      }
      @default {
        @if (painel(); as painel) {
          <div class="indicadores" data-tutorial="indicadores">
            <section class="indicador">
              <div class="indicador__rotulo">Fichas ativas</div>
              <div class="indicador__valor">{{ painel.kpis.ativas }}</div>
              <div class="indicador__legenda">Em uso pelos alunos</div>
            </section>
            <section class="indicador">
              <div class="indicador__rotulo">Aguardando aprovação</div>
              <div class="indicador__valor indicador__valor--aviso">
                {{ painel.kpis.aguardandoAprovacao }}
              </div>
              <div class="indicador__legenda">Sugeridas pela IA</div>
            </section>
            <section class="indicador">
              <div class="indicador__rotulo">Vencem em 30 dias</div>
              <div class="indicador__valor">{{ painel.kpis.vencemEm30Dias }}</div>
              <button
                *appPermission="'treinos:editar'"
                type="button"
                class="indicador__legenda"
                [disabled]="store.processando()"
                (click)="avisar()"
              >
                Avisar alunos
              </button>
            </section>
            <section class="indicador">
              <div class="indicador__rotulo">Sem ficha</div>
              <div class="indicador__valor indicador__valor--alerta">
                {{ painel.kpis.semFicha }}
              </div>
              <div class="indicador__legenda">Novos alunos</div>
            </section>
          </div>

          <div class="corpo">
            <section class="tabela" data-tutorial="lista">
              <div class="tabela__cabecalho">
                <h2>Fichas dos alunos</h2>
                <p>
                  {{ painel.alunosComFicha }} alunos com ficha ·
                  {{ painel.kpis.aguardandoAprovacao }} aguardando aprovação
                </p>
              </div>
              @if (linhas().length === 0) {
                <ui-empty-state
                  heading="Nenhuma ficha ainda"
                  description="Crie a primeira ficha pelo cadastro do aluno ou a partir de um modelo."
                  [icon]="true"
                >
                  <ui-button *appPermission="'treinos:criar'" actions routerLink="/treinos/modelos">
                    Ver modelos
                  </ui-button>
                </ui-empty-state>
              } @else {
                <ui-table
                  label="Fichas dos alunos"
                  minWidth="860px"
                  [rowHeight]="59"
                  unit="fichas"
                  [columns]="colunas"
                  [rows]="linhas()"
                  [total]="comPaginacao() ? painel.total : undefined"
                  [page]="store.pagina()"
                  [pageSize]="porPagina"
                  (pageChange)="store.carregar($event)"
                >
                  <ng-template uiTableCell="aluno" let-linha>
                    <div class="aluno">
                      <ui-avatar [name]="linha.alunoNome" [size]="34" [decorative]="true" />
                      <b>{{ linha.alunoNome }}</b>
                    </div>
                  </ng-template>
                  <ng-template uiTableCell="situacao" let-linha>
                    <ui-badge [variant]="linha.variante">{{ linha.textoDaSituacao }}</ui-badge>
                  </ng-template>
                  <ng-template uiTableCell="acoes" let-linha>
                    <div class="acoes">
                      <ui-button
                        size="sm"
                        variant="outline"
                        [routerLink]="['/alunos', linha.alunoId, 'ficha-de-treino']"
                      >
                        Abrir
                      </ui-button>
                      @if (linha.aguardando) {
                        <ui-button
                          *appPermission="'treinos:editar'"
                          size="sm"
                          variant="accent"
                          [loading]="store.processando()"
                          (click)="aprovar(linha.fichaId, linha.alunoNome)"
                        >
                          Aprovar
                        </ui-button>
                      }
                    </div>
                  </ng-template>
                </ui-table>
              }
            </section>

            <section class="sugeridas" data-tutorial="sugeridas">
              <h2>Fichas sugeridas pela IA</h2>
              <div class="sugeridas__texto">
                A IA monta o rascunho com base no objetivo e nas restrições. O professor revisa e
                aprova antes de o aluno ver.
              </div>
              @for (sugerida of painel.sugeridas; track sugerida.fichaId) {
                <div class="sugerida">
                  <b>{{ sugerida.alunoNome }}</b>
                  <div class="sugerida__resumo">{{ sugerida.resumo }}</div>
                  <div class="sugerida__acoes">
                    <ui-button
                      size="sm"
                      [routerLink]="['/alunos', sugerida.alunoId, 'ficha-de-treino']"
                    >
                      Revisar
                    </ui-button>
                    <ui-button
                      *appPermission="'treinos:editar'"
                      size="sm"
                      variant="outline"
                      [loading]="store.processando()"
                      (click)="recusar(sugerida.fichaId, sugerida.alunoNome)"
                    >
                      Recusar
                    </ui-button>
                  </div>
                </div>
              } @empty {
                <ui-empty-state
                  heading="Nenhuma ficha para revisar"
                  description="As fichas geradas pela IA aparecem aqui até o professor aprovar."
                />
              }
            </section>
          </div>
        }
      }
    }

    <ui-tutorial-overlay [config]="tutorial" [(open)]="tutorialAberto" />
  `,
})
export class FichasPage {
  protected readonly store = inject(FichasStore);
  private readonly toast = inject(ToastService);

  protected readonly tutorial = TUTORIAL_TREINOS;
  protected readonly tutorialAberto = signal(false);
  protected readonly linhasDeEspera = [1, 2, 3, 4, 5];
  protected readonly colunas = COLUNAS;
  protected readonly porPagina = FICHAS_POR_PAGINA;

  protected readonly painel = this.store.painel;
  protected readonly comPaginacao = computed(() => (this.painel()?.total ?? 0) > FICHAS_POR_PAGINA);
  protected readonly linhas = computed(() =>
    (this.painel()?.itens ?? []).map((linha: LinhaDeFicha) => {
      const situacao = situacaoDaLinha(linha);
      return {
        fichaId: linha.fichaId,
        alunoId: linha.alunoId,
        alunoNome: linha.alunoNome,
        ficha: linha.nome,
        professor: primeiroNome(linha.professorNome),
        validade: dataBr(linha.validaAte),
        textoDaSituacao: situacao.texto,
        variante: situacao.variante,
        aguardando: linha.situacao === 'aguardando_aprovacao',
      };
    }),
  );

  constructor() {
    this.store.carregar();
  }

  protected aprovar(fichaId: string, alunoNome: string): void {
    this.store.aprovar(fichaId).subscribe({
      next: () => this.toast.show({ message: `Ficha de ${alunoNome} aprovada.`, tone: 'success' }),
      error: (falha: unknown) =>
        this.toast.show({
          message: mensagemDaApi(falha, 'Não foi possível aprovar a ficha.'),
          tone: 'error',
        }),
    });
  }

  protected recusar(fichaId: string, alunoNome: string): void {
    this.store.recusar(fichaId).subscribe({
      next: () => this.toast.show({ message: `Ficha de ${alunoNome} recusada.`, tone: 'info' }),
      error: (falha: unknown) =>
        this.toast.show({
          message: mensagemDaApi(falha, 'Não foi possível recusar a ficha.'),
          tone: 'error',
        }),
    });
  }

  protected avisar(): void {
    this.store.avisarVencimentos().subscribe({
      next: ({ avisados }) =>
        this.toast.show({
          message:
            avisados === 0
              ? 'Nenhuma ficha vence nos próximos 30 dias.'
              : `${avisados} ${avisados === 1 ? 'aluno avisado' : 'alunos avisados'}.`,
          tone: 'success',
        }),
      error: (falha: unknown) =>
        this.toast.show({
          message: mensagemDaApi(falha, 'Não foi possível avisar os alunos.'),
          tone: 'error',
        }),
    });
  }
}
