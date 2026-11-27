import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Permission } from '@gymos/shared-forms';
import {
  Button,
  type ChipOption,
  Chips,
  EmptyState,
  ErrorState,
  Modal,
  NoPermissionState,
  PageHeader,
  Select,
  type SelectOption,
  Skeleton,
  ToastService,
  TutorialOverlay,
} from '@gymos/ui';
import { AbasDeAlunos } from '../components/abas-de-alunos';
import { ListaDeAlunos } from '../components/lista-de-alunos';
import { ALUNOS_POR_PAGINA, AlunosStore } from '../data-access/alunos.store';
import type { FiltroDeSituacao, ItemDaLista } from '../models/aluno';
import { dicaDaBusca, mensagemDaApi } from '../utils/apresentacao';
import { TUTORIAL_ALUNOS } from '../utils/tutorial';

const FILTROS: readonly { value: FiltroDeSituacao; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'em_dia', label: 'Em dia' },
  { value: 'a_vencer', label: 'A vencer' },
  { value: 'em_atraso', label: 'Em atraso' },
];

/** Lista de alunos (`/alunos`, `Alunos.html`). */
@Component({
  selector: 'app-alunos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AlunosStore],
  imports: [
    PageHeader,
    Button,
    Chips,
    Select,
    Skeleton,
    EmptyState,
    ErrorState,
    NoPermissionState,
    Modal,
    TutorialOverlay,
    Permission,
    RouterLink,
    AbasDeAlunos,
    ListaDeAlunos,
  ],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 22px;
    }
    .alunos__busca {
      display: flex;
      align-items: center;
      min-width: 260px;
      height: 44px;
      padding: 0 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
      /* Como no protótipo: a largura mínima e a altura valem só para o conteúdo. */
      box-sizing: content-box;
    }
    .alunos__busca:focus-within {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .alunos__busca input {
      width: 100%;
      min-width: 0;
      padding: 0;
      border: 0;
      outline: none;
      background: none;
      color: var(--ink);
      font: var(--font-weight-regular) 14px var(--font);
    }
    .alunos__busca input::placeholder {
      color: var(--muted);
      opacity: 1;
    }
    /* O protótipo não tem a borda transparente do botão: 15 px + 1 px de borda dão os 16 px da tela. */
    ui-button[actions] ::ng-deep button {
      padding: 0 15px;
    }
    .alunos__filtros {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
    }
    .alunos__plano {
      /* Como no protótipo: 200 px de conteúdo, 14 px de respiro dos dois lados e a borda. */
      min-width: 230px;
      height: 46px;
    }
    .alunos__lote {
      color: var(--muted);
      font-size: 14px;
      text-decoration: none;
    }
    .alunos__lote:hover {
      color: var(--ink);
    }
    .alunos__lote:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .alunos__cartao {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
    }
    .alunos__texto {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
    }
  `,
  template: `
    <ui-page-header
      data-tutorial="cabecalho"
      heading="Alunos"
      subtitle="Cadastro, planos e situação de pagamento."
      (helpClick)="tutorialAberto.set(true)"
    >
      <label actions class="alunos__busca">
        <input
          type="search"
          placeholder="Pesquisar por nome, CPF ou telefone"
          aria-label="Pesquisar por nome, CPF ou telefone"
          autocomplete="off"
          enterkeyhint="search"
          [value]="store.busca()"
          (input)="buscar($event)"
        />
      </label>
      <ui-button *appPermission="'alunos:criar'" actions size="lg" (click)="irPara('/alunos/novo')">
        Cadastrar aluno
      </ui-button>
    </ui-page-header>

    <app-abas-de-alunos data-tutorial="abas" ativa="lista">
      <a class="alunos__lote" routerLink="/alunos/lote">Ações em lote</a>
    </app-abas-de-alunos>

    <div class="alunos__filtros" data-tutorial="filtros">
      <ui-chips
        label="Situação de pagamento"
        [multiple]="false"
        [options]="chips()"
        [values]="[store.situacao()]"
        (valuesChange)="escolherSituacao($event)"
      />
      <div class="alunos__plano">
        <ui-select
          ariaLabel="Plano"
          [options]="planos()"
          [value]="store.planoId()"
          (valueChange)="store.escolherPlano($event)"
        />
      </div>
    </div>

    @switch (store.estado()) {
      @case ('carregando') {
        <div class="alunos__cartao" aria-busy="true">
          @for (linha of linhasDeEspera; track linha) {
            <ui-skeleton height="44px" />
          }
        </div>
      }
      @case ('erro') {
        <ui-error-state
          heading="Não foi possível carregar os alunos"
          description="Confira a conexão e tente de novo."
          (retry)="store.carregar()"
        />
      }
      @case ('sem-permissao') {
        <ui-no-permission-state />
      }
      @default {
        <div data-tutorial="lista">
          @if (store.semAlunos()) {
            <div class="alunos__cartao">
              <ui-empty-state
                heading="Nenhum aluno cadastrado ainda"
                description="Cadastre o primeiro aluno ou importe a planilha do sistema anterior."
                [icon]="true"
              >
                <ui-button *appPermission="'alunos:criar'" actions (click)="irPara('/alunos/novo')">
                  Cadastrar aluno
                </ui-button>
              </ui-empty-state>
            </div>
          } @else if (store.semResultado()) {
            <div class="alunos__cartao">
              <ui-empty-state
                heading="Nenhum aluno encontrado"
                [description]="dica() ?? 'Confira a grafia ou limpe os filtros.'"
              >
                <ui-button actions variant="outline" (click)="limparFiltros()">
                  Limpar filtros
                </ui-button>
              </ui-empty-state>
            </div>
          } @else {
            <app-lista-de-alunos
              [itens]="store.itens()"
              [total]="store.total()"
              [pagina]="store.pagina()"
              [porPagina]="porPagina"
              (excluir)="exclusao.set($event)"
              (paginaMudou)="mudarPagina($event)"
            />
          }
        </div>
      }
    }

    <ui-modal
      [open]="exclusao() !== null"
      heading="Excluir aluno"
      (openChange)="aoMudarModal($event)"
    >
      <p class="alunos__texto">
        Excluir {{ exclusao()?.nome }}? Essa ação não pode ser desfeita e o histórico do aluno segue
        as regras de retenção da LGPD.
      </p>
      <ui-button footer variant="danger" [loading]="store.processando()" (click)="excluir()">
        Excluir aluno
      </ui-button>
      <ui-button footer variant="outline" (click)="exclusao.set(null)">Cancelar</ui-button>
    </ui-modal>

    <ui-tutorial-overlay [config]="tutorial" [(open)]="tutorialAberto" />
  `,
})
export class AlunosPage {
  protected readonly store = inject(AlunosStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly tutorial = TUTORIAL_ALUNOS;
  protected readonly tutorialAberto = signal(false);
  protected readonly linhasDeEspera = [1, 2, 3, 4, 5, 6];
  protected readonly porPagina = ALUNOS_POR_PAGINA;
  protected readonly exclusao = signal<ItemDaLista | null>(null);

  protected readonly chips = computed<readonly ChipOption[]>(() => {
    const contadores = this.store.contadores();
    return FILTROS.map((filtro) => ({
      ...filtro,
      ...(contadores ? { count: contadores[filtro.value] } : {}),
    }));
  });
  protected readonly planos = computed<readonly SelectOption[]>(() => [
    { value: '', label: 'Plano: todos' },
    ...this.store.planos().map((plano) => ({ value: plano.id, label: plano.nome })),
  ]);
  protected readonly dica = computed(() => dicaDaBusca(this.store.busca()));

  constructor() {
    this.store.carregar();
  }

  protected buscar(evento: Event): void {
    this.store.buscar((evento.target as HTMLInputElement).value);
  }

  protected escolherSituacao(valores: readonly string[]): void {
    const escolhido = FILTROS.find((filtro) => filtro.value === valores[0]);
    this.store.escolherSituacao(escolhido?.value ?? 'todos');
  }

  protected limparFiltros(): void {
    this.store.escolherSituacao('todos');
    this.store.escolherPlano('');
    this.store.buscar('');
  }

  protected mudarPagina(pagina: number): void {
    if (pagina > this.store.pagina()) {
      this.store.proximaPagina();
    } else {
      this.store.paginaAnterior();
    }
  }

  protected irPara(rota: string): void {
    void this.router.navigateByUrl(rota);
  }

  protected aoMudarModal(aberto: boolean): void {
    if (!aberto) {
      this.exclusao.set(null);
    }
  }

  protected excluir(): void {
    const aluno = this.exclusao();
    if (!aluno || this.store.processando()) {
      return;
    }
    this.store.excluir(aluno).subscribe({
      next: () => {
        this.exclusao.set(null);
        this.toast.show({ message: 'Aluno excluído.', tone: 'success' });
      },
      error: (falha: unknown) => {
        this.exclusao.set(null);
        this.toast.show({
          message: mensagemDaApi(falha, 'Não foi possível excluir o aluno.'),
          tone: 'error',
        });
      },
    });
  }
}
