import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Permission, PERMISSION_CHECKER } from '@gymos/shared-forms';
import {
  Button,
  EmptyState,
  ErrorState,
  Modal,
  NoPermissionState,
  PageHeader,
  Skeleton,
  ToastService,
  TutorialOverlay,
} from '@gymos/ui';
import { ListaDePlanos } from '../components/lista-de-planos';
import { PainelDoPlano } from '../components/painel-do-plano';
import { PlanosStore } from '../data-access/planos.store';
import type { ConsultaDaPrevia, DadosDoPlano, Plano } from '../models/plano';
import { mensagemDaApi } from '../utils/apresentacao';
import { TUTORIAL_PLANOS } from '../utils/tutorial';

interface Exclusao {
  readonly plano: Plano;
  /** `excluir` apaga; `inativar` é o caminho de quem tem alunos ativos. */
  readonly modo: 'excluir' | 'inativar';
}

/** Planos vendidos pela academia (`/planos`, `Planos.html`). */
@Component({
  selector: 'app-planos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PlanosStore],
  imports: [
    PageHeader,
    Button,
    Skeleton,
    EmptyState,
    ErrorState,
    NoPermissionState,
    Modal,
    TutorialOverlay,
    Permission,
    ListaDePlanos,
    PainelDoPlano,
  ],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 22px;
    }
    .planos__busca {
      display: flex;
      align-items: center;
      min-width: 220px;
      height: 44px;
      padding: 0 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
      /* Como no protótipo: a largura mínima e a altura valem só para o conteúdo. */
      box-sizing: content-box;
    }
    .planos__busca:focus-within {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .planos__busca input {
      width: 100%;
      min-width: 0;
      padding: 0;
      border: 0;
      outline: none;
      background: none;
      color: var(--ink);
      font: var(--font-weight-regular) 14px var(--font);
    }
    .planos__busca input::placeholder {
      color: var(--muted);
      opacity: 1;
    }
    .planos__corpo {
      display: flex;
      flex-wrap: wrap;
      gap: var(--gap);
      align-items: flex-start;
    }
    .planos__lista {
      /* 560 px de conteúdo mais as bordas do cartão no protótipo (content-box): 562 px de base. */
      flex: 1.7 1 562px;
      min-width: 0;
      border-radius: var(--radius-card);
    }
    app-painel-do-plano {
      flex: 1 1 320px;
      min-width: 0;
    }
    .planos__cartao {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
    }
    .planos__texto {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
    }
  `,
  template: `
    <ui-page-header
      data-tutorial="cabecalho"
      heading="Planos"
      subtitle="Cadastre, edite e ative os planos vendidos pela academia."
      (helpClick)="tutorialAberto.set(true)"
    >
      <label actions class="planos__busca">
        <input
          type="search"
          placeholder="Pesquisar plano"
          aria-label="Pesquisar plano"
          autocomplete="off"
          enterkeyhint="search"
          [value]="store.busca()"
          (input)="buscar($event)"
        />
      </label>
      <ui-button *appPermission="'planos:criar'" actions size="lg" (click)="novo()">
        Novo plano
      </ui-button>
    </ui-page-header>

    @switch (store.estado()) {
      @case ('carregando') {
        <div class="planos__corpo" aria-busy="true">
          <div class="planos__lista planos__cartao">
            @for (linha of linhasDeEspera; track linha) {
              <ui-skeleton height="44px" />
            }
          </div>
        </div>
      }
      @case ('erro') {
        <ui-error-state
          heading="Não foi possível carregar os planos"
          description="Confira a conexão e tente de novo."
          (retry)="store.carregar()"
        />
      }
      @case ('sem-permissao') {
        <ui-no-permission-state />
      }
      @default {
        <div class="planos__corpo">
          <div class="planos__lista" data-tutorial="lista">
            @if (store.semPlanos()) {
              <div class="planos__cartao">
                <ui-empty-state
                  heading="Nenhum plano cadastrado ainda"
                  description="Crie o primeiro plano da academia pelo painel ao lado."
                  [icon]="true"
                >
                  <ui-button *appPermission="'planos:criar'" actions (click)="novo()">
                    Cadastrar plano
                  </ui-button>
                </ui-empty-state>
              </div>
            } @else if (store.semResultado()) {
              <div class="planos__cartao">
                <ui-empty-state
                  [heading]="'Nada encontrado para &quot;' + store.busca() + '&quot;'"
                  description="Confira a grafia ou limpe a busca."
                >
                  <ui-button actions variant="outline" (click)="limparBusca()">
                    Limpar busca
                  </ui-button>
                </ui-empty-state>
              </div>
            } @else {
              <app-lista-de-planos
                [planos]="store.planos()"
                (editar)="editar($event)"
                (excluir)="pedirExclusao($event)"
              />
            }
          </div>
          @if (podeGravar()) {
            <app-painel-do-plano
              [plano]="emEdicao()"
              [reinicio]="reinicio()"
              [previa]="store.previa()"
              [erroDaPrevia]="store.erroDaPrevia()"
              [erroAoSalvar]="store.erroAoSalvar()"
              [salvando]="store.salvando()"
              (camposDaParcela)="pedirPrevia($event)"
              (salvar)="salvar($event)"
              (cancelar)="novo()"
            />
          }
        </div>
      }
    }

    <ui-modal
      [open]="exclusao() !== null"
      [heading]="tituloDaExclusao()"
      (openChange)="aoMudarModal($event)"
    >
      <p class="planos__texto">{{ textoDaExclusao() }}</p>
      @if (podeInativar()) {
        <ui-button footer [loading]="store.processando()" (click)="inativar()">
          Inativar plano
        </ui-button>
      }
      @if (exclusao()?.modo === 'excluir') {
        <ui-button footer variant="danger" [loading]="store.processando()" (click)="excluir()">
          Excluir plano
        </ui-button>
      }
      <ui-button footer variant="outline" (click)="exclusao.set(null)">Cancelar</ui-button>
    </ui-modal>

    <ui-tutorial-overlay [config]="tutorial" [(open)]="tutorialAberto" />
  `,
})
export class PlanosPage {
  protected readonly store = inject(PlanosStore);
  private readonly permissoes = inject(PERMISSION_CHECKER);
  private readonly toast = inject(ToastService);

  protected readonly tutorial = TUTORIAL_PLANOS;
  protected readonly tutorialAberto = signal(false);
  protected readonly linhasDeEspera = [1, 2, 3, 4, 5, 6];

  protected readonly emEdicao = signal<Plano | null>(null);
  protected readonly reinicio = signal(0);
  protected readonly exclusao = signal<Exclusao | null>(null);

  protected readonly podeGravar = computed(
    () => this.permissoes.pode('planos:criar') || this.permissoes.pode('planos:editar'),
  );
  protected readonly podeInativar = computed(() => {
    const exclusao = this.exclusao();
    return (
      exclusao?.modo === 'inativar' && exclusao.plano.ativo && this.permissoes.pode('planos:editar')
    );
  });
  protected readonly tituloDaExclusao = computed(() =>
    this.exclusao()?.modo === 'inativar' ? 'Este plano tem alunos ativos' : 'Excluir plano',
  );
  protected readonly textoDaExclusao = computed(() => {
    const exclusao = this.exclusao();
    if (!exclusao) {
      return '';
    }
    const { plano, modo } = exclusao;
    if (modo === 'excluir') {
      return `Excluir o plano ${plano.nome}? Essa ação não pode ser desfeita.`;
    }
    const alunos =
      plano.alunosAtivos === 1 ? '1 aluno ativo' : `${plano.alunosAtivos} alunos ativos`;
    return plano.ativo
      ? `O plano ${plano.nome} tem ${alunos} e não pode ser excluído. Inative o plano para parar de vendê-lo; os contratos atuais continuam.`
      : `O plano ${plano.nome} tem ${alunos} e não pode ser excluído enquanto houver contratos vigentes.`;
  });

  constructor() {
    this.store.carregar();
  }

  protected buscar(evento: Event): void {
    this.store.buscar((evento.target as HTMLInputElement).value);
  }

  protected limparBusca(): void {
    this.store.buscar('');
  }

  protected novo(): void {
    this.emEdicao.set(null);
    this.reinicio.update((valor) => valor + 1);
    this.store.limparPrevia();
  }

  protected editar(plano: Plano): void {
    this.store.limparPrevia();
    this.emEdicao.set(plano);
  }

  protected pedirPrevia(consulta: ConsultaDaPrevia | null): void {
    this.store.pedirPrevia(consulta);
  }

  protected salvar(dados: DadosDoPlano): void {
    const editando = this.emEdicao();
    this.store.salvar(dados, editando?.id ?? null).subscribe({
      next: (plano) => {
        this.toast.show({ message: 'Plano salvo.', tone: 'success' });
        if (editando) {
          this.emEdicao.set(plano);
        } else {
          this.novo();
        }
      },
      // O motivo já está no painel (`erroAoSalvar`).
      error: () => undefined,
    });
  }

  protected pedirExclusao(plano: Plano): void {
    this.exclusao.set({ plano, modo: plano.alunosAtivos > 0 ? 'inativar' : 'excluir' });
  }

  protected aoMudarModal(aberto: boolean): void {
    if (!aberto) {
      this.exclusao.set(null);
    }
  }

  protected excluir(): void {
    const plano = this.exclusao()?.plano;
    if (!plano || this.store.processando()) {
      return;
    }
    this.store.excluir(plano).subscribe({
      next: () => {
        this.exclusao.set(null);
        this.toast.show({ message: 'Plano excluído.', tone: 'success' });
        if (this.emEdicao()?.id === plano.id) {
          this.novo();
        }
      },
      error: (falha: unknown) => {
        if (falha instanceof HttpErrorResponse && falha.status === 409) {
          // Ganhou alunos ativos desde que a lista carregou: oferece inativar.
          this.exclusao.set({ plano, modo: 'inativar' });
          return;
        }
        this.exclusao.set(null);
        this.toast.show({
          message: mensagemDaApi(falha, 'Não foi possível excluir o plano.'),
          tone: 'error',
        });
      },
    });
  }

  protected inativar(): void {
    const plano = this.exclusao()?.plano;
    if (!plano || this.store.processando()) {
      return;
    }
    this.store.inativar(plano).subscribe({
      next: (inativo) => {
        this.exclusao.set(null);
        this.toast.show({ message: 'Plano inativado.', tone: 'success' });
        if (this.emEdicao()?.id === plano.id) {
          this.emEdicao.set(inativo);
        }
      },
      error: (falha: unknown) => {
        this.exclusao.set(null);
        this.toast.show({
          message: mensagemDaApi(falha, 'Não foi possível inativar o plano.'),
          tone: 'error',
        });
      },
    });
  }
}
