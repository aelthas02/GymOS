import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CLIENTE_DA_API, type Schemas } from '@gymos/api-contracts';
import { KeyboardSafe, Permission } from '@gymos/shared-forms';
import {
  Button,
  EmptyState,
  ErrorState,
  Modal,
  NoPermissionState,
  PageHeader,
  Select,
  Skeleton,
  ToastService,
  TutorialOverlay,
} from '@gymos/ui';
import { AbasDeTreinos } from '../components/abas-de-treinos';
import { EditorDeTreinos } from '../components/editor-de-treinos';
import { ModelosStore } from '../data-access/treinos.store';
import type { Divisao, Modelo } from '../models/treinos';
import {
  DIVISOES,
  FREQUENCIAS,
  mensagemDaApi,
  treinosEditaveis,
  treinosParaApi,
} from '../utils/apresentacao';
import { EdicaoDeTreinos } from '../utils/edicao-de-treinos';
import { TUTORIAL_MODELOS } from '../utils/tutorial';

type AlunoDaBusca = Schemas['ItemDaListaDeAlunosDto'];

/** Modelos de ficha (`/treinos/modelos`, `TreinosModelos.html`). */
@Component({
  selector: 'app-modelos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ModelosStore],
  imports: [
    KeyboardSafe,
    Permission,
    PageHeader,
    Button,
    Select,
    Skeleton,
    EmptyState,
    ErrorState,
    NoPermissionState,
    Modal,
    AbasDeTreinos,
    EditorDeTreinos,
    TutorialOverlay,
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
    .cartoes {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    .cartao {
      /* Como no protótipo: 280 px de conteúdo mais o recuo e a borda (content-box), 3 cartões por linha. */
      box-sizing: content-box;
      flex: 1 1 280px;
      padding: 18px;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
    }
    .cartao b {
      font-size: 16px;
    }
    .cartao__resumo {
      margin: 4px 0 14px;
      color: var(--muted);
      font-size: 13px;
    }
    .cartao__acoes {
      display: flex;
      gap: 8px;
    }
    .campo {
      width: 100%;
      height: 44px;
      padding: 0 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-regular) 14px var(--font);
    }
    .campo:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .rotulo {
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
    }
    .editor {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding-bottom: var(--teclado-altura, 0px);
    }
    .linha {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
    }
    .coluna {
      display: flex;
      flex: 1 1 180px;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    .pilulas {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .pilula {
      padding: 9px 16px;
      border: 1px solid var(--border);
      border-radius: 20px;
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-bold) 13px var(--font);
      cursor: pointer;
    }
    .pilula[aria-pressed='true'] {
      border-color: var(--ink);
      background: var(--ink);
      color: var(--on-ink);
    }
    .busca {
      display: flex;
      gap: 8px;
    }
    .resultados {
      display: flex;
      flex-direction: column;
      margin: 12px 0 0;
      padding: 0;
      list-style: none;
    }
    .resultados li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid var(--divider);
    }
    .erro {
      color: var(--badge-late-fg);
      font-size: 13px;
    }
    :host ::ng-deep .cartao__acoes ui-button button {
      min-height: 38px;
      padding: 0 15px;
    }
    :host ::ng-deep .cartao__acoes ui-button button.ui-button--outline {
      padding: 0 16px;
    }
    :host ::ng-deep ui-page-header ui-button button {
      min-height: 44px;
      padding: 0 15px;
    }
  `,
  template: `
    <ui-page-header
      heading="Treinos"
      data-tutorial="cabecalho"
      subtitle="Modelos prontos para criar fichas mais rápido."
      (helpClick)="tutorialAberto.set(true)"
    >
      <ui-button *appPermission="'treinos:criar'" actions size="lg" (click)="novo()">
        Novo modelo
      </ui-button>
    </ui-page-header>

    <app-abas-de-treinos ativa="modelos" />

    @switch (store.estado()) {
      @case ('carregando') {
        <div aria-busy="true">
          @for (linha of linhasDeEspera; track linha) {
            <ui-skeleton height="88px" />
          }
        </div>
      }
      @case ('erro') {
        <ui-error-state
          heading="Não foi possível carregar os modelos"
          description="Confira a conexão e tente de novo."
          (retry)="store.carregar()"
        />
      }
      @case ('sem-permissao') {
        <ui-no-permission-state />
      }
      @default {
        @if (store.modelos().length === 0) {
          <ui-empty-state
            heading="Nenhum modelo ainda"
            description="Crie um modelo para montar fichas mais rápido."
            [icon]="true"
          >
            <ui-button *appPermission="'treinos:criar'" actions (click)="novo()">
              Novo modelo
            </ui-button>
          </ui-empty-state>
        } @else {
          <div class="cartoes" data-tutorial="cartoes">
            @for (modelo of store.modelos(); track modelo.id) {
              <section class="cartao">
                <b>{{ modelo.nome }}</b>
                <div class="cartao__resumo">
                  {{ modelo.diasPorSemana }} dias · {{ modelo.totalDeExercicios }} exercícios
                </div>
                <div class="cartao__acoes">
                  <ui-button
                    *appPermission="'treinos:criar'"
                    variant="accent"
                    (click)="usar(modelo)"
                  >
                    Usar modelo
                  </ui-button>
                  <ui-button
                    *appPermission="'treinos:editar'"
                    variant="outline"
                    (click)="editar(modelo)"
                  >
                    Editar
                  </ui-button>
                </div>
              </section>
            }
          </div>
        }
      }
    }

    <ui-tutorial-overlay [config]="tutorial" [(open)]="tutorialAberto" />

    <ui-modal
      [open]="modeloParaUsar() !== null"
      [heading]="'Usar modelo ' + (modeloParaUsar()?.nome ?? '')"
      (openChange)="fecharUso($event)"
    >
      <form class="busca" (submit)="buscarAluno($event)">
        <input
          class="campo"
          type="search"
          aria-label="Buscar aluno"
          placeholder="Nome, CPF ou telefone do aluno"
          autocomplete="off"
          enterkeyhint="search"
          [value]="termo()"
          (input)="termo.set(texto($event))"
        />
        <ui-button type="submit" [loading]="buscando()">Buscar</ui-button>
      </form>
      @if (erroDaBusca()) {
        <p class="erro" role="alert">{{ erroDaBusca() }}</p>
      }
      <ul class="resultados">
        @for (aluno of alunos(); track aluno.id) {
          <li>
            <b>{{ aluno.nome }}</b>
            <ui-button size="sm" [loading]="store.processando()" (click)="criarFicha(aluno)">
              Criar ficha
            </ui-button>
          </li>
        }
      </ul>
      <ui-button footer variant="outline" (click)="modeloParaUsar.set(null)">Cancelar</ui-button>
    </ui-modal>

    <ui-modal
      [open]="editando()"
      [heading]="idDoModelo() ? 'Editar modelo' : 'Novo modelo'"
      (openChange)="fecharEdicao($event)"
    >
      <div class="editor" appKeyboardSafe>
        <div class="linha">
          <div class="coluna" style="flex: 2 1 220px">
            <label class="rotulo" for="modelo-nome">Nome do modelo</label>
            <input
              id="modelo-nome"
              class="campo"
              autocomplete="off"
              enterkeyhint="next"
              [value]="nome()"
              (input)="nome.set(texto($event))"
            />
          </div>
          <div class="coluna">
            <span class="rotulo">Dias por semana</span>
            <ui-select
              ariaLabel="Dias por semana"
              [options]="frequencias"
              [value]="dias()"
              (valueChange)="dias.set($event)"
            />
          </div>
        </div>
        <div class="coluna">
          <span class="rotulo" id="modelo-divisao">Divisão do treino</span>
          <div class="pilulas" role="group" aria-labelledby="modelo-divisao">
            @for (opcao of divisoes; track opcao.valor) {
              <button
                type="button"
                class="pilula"
                [attr.aria-pressed]="divisao() === opcao.valor"
                (click)="divisao.set(opcao.valor)"
              >
                {{ opcao.rotulo }}
              </button>
            }
          </div>
        </div>
        <app-editor-de-treinos [edicao]="edicao" />
        @if (erroAoSalvar()) {
          <p class="erro" role="alert">{{ erroAoSalvar() }}</p>
        }
      </div>
      <ui-button footer [loading]="store.processando()" (click)="salvar()">Salvar modelo</ui-button>
      <ui-button footer variant="outline" (click)="editando.set(false)">Cancelar</ui-button>
    </ui-modal>
  `,
})
export class ModelosPage {
  protected readonly store = inject(ModelosStore);
  private readonly api = inject(CLIENTE_DA_API);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly linhasDeEspera = [1, 2, 3];
  protected readonly tutorial = TUTORIAL_MODELOS;
  protected readonly tutorialAberto = signal(false);
  protected readonly frequencias = FREQUENCIAS;
  protected readonly divisoes = DIVISOES;

  // ---------- Usar modelo ----------
  protected readonly modeloParaUsar = signal<Modelo | null>(null);
  protected readonly termo = signal('');
  protected readonly alunos = signal<readonly AlunoDaBusca[]>([]);
  protected readonly buscando = signal(false);
  protected readonly erroDaBusca = signal<string | null>(null);

  // ---------- Editor do modelo ----------
  protected readonly edicao = new EdicaoDeTreinos();
  protected readonly editando = signal(false);
  protected readonly idDoModelo = signal<string | null>(null);
  protected readonly nome = signal('');
  protected readonly dias = signal('3');
  protected readonly divisao = signal<Divisao>('ABC');
  protected readonly erroAoSalvar = signal<string | null>(null);

  constructor() {
    this.store.carregar();
  }

  protected texto(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  protected usar(modelo: Modelo): void {
    this.termo.set('');
    this.alunos.set([]);
    this.erroDaBusca.set(null);
    this.modeloParaUsar.set(modelo);
  }

  protected fecharUso(aberto: boolean): void {
    if (!aberto) {
      this.modeloParaUsar.set(null);
    }
  }

  protected buscarAluno(evento: Event): void {
    evento.preventDefault();
    const busca = this.termo().trim();
    if (!busca) {
      return;
    }
    this.buscando.set(true);
    this.erroDaBusca.set(null);
    this.api.get('/api/alunos', { consulta: { busca, limite: 8 } }).subscribe({
      next: (pagina) => {
        this.alunos.set(pagina.itens);
        this.buscando.set(false);
        if (pagina.itens.length === 0) {
          this.erroDaBusca.set('Nenhum aluno encontrado.');
        }
      },
      error: (falha: unknown) => {
        this.buscando.set(false);
        this.erroDaBusca.set(mensagemDaApi(falha, 'Não foi possível buscar o aluno.'));
      },
    });
  }

  protected criarFicha(aluno: AlunoDaBusca): void {
    const modelo = this.modeloParaUsar();
    if (!modelo) {
      return;
    }
    this.store.usar(modelo.id, aluno.id).subscribe({
      next: () => {
        this.modeloParaUsar.set(null);
        void this.router.navigate(['/alunos', aluno.id, 'ficha-de-treino']);
      },
      error: (falha: unknown) =>
        this.erroDaBusca.set(mensagemDaApi(falha, 'Não foi possível criar a ficha.')),
    });
  }

  protected novo(): void {
    this.idDoModelo.set(null);
    this.nome.set('');
    this.dias.set('3');
    this.divisao.set('ABC');
    this.erroAoSalvar.set(null);
    this.edicao.iniciar();
    this.editando.set(true);
  }

  protected editar(modelo: Modelo): void {
    this.idDoModelo.set(modelo.id);
    this.nome.set(modelo.nome);
    this.dias.set(String(modelo.diasPorSemana));
    this.divisao.set(modelo.divisao);
    this.erroAoSalvar.set(null);
    this.edicao.definir(treinosEditaveis(modelo.treinos));
    this.editando.set(true);
  }

  protected fecharEdicao(aberto: boolean): void {
    if (!aberto) {
      this.editando.set(false);
    }
  }

  protected salvar(): void {
    this.erroAoSalvar.set(null);
    this.store
      .salvar(
        {
          nome: this.nome().trim(),
          divisao: this.divisao(),
          diasPorSemana: Number(this.dias()),
          treinos: treinosParaApi(this.edicao.treinos()),
        },
        this.idDoModelo(),
      )
      .subscribe({
        next: () => {
          this.editando.set(false);
          this.toast.show({ message: 'Modelo salvo.', tone: 'success' });
        },
        error: (falha: unknown) =>
          this.erroAoSalvar.set(mensagemDaApi(falha, 'Não foi possível salvar o modelo.')),
      });
  }
}
