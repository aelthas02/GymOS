import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { KeyboardSafe, Permission } from '@gymos/shared-forms';
import {
  Button,
  EmptyState,
  ErrorState,
  NoPermissionState,
  PageHeader,
  Select,
  type SelectOption,
  Skeleton,
  ToastService,
  TutorialOverlay,
  VideoEmbed,
  extrairIdDoYoutube,
} from '@gymos/ui';
import { AbasDeTreinos } from '../components/abas-de-treinos';
import { BibliotecaStore } from '../data-access/treinos.store';
import { GRUPOS_MUSCULARES, mensagemDaApi } from '../utils/apresentacao';
import { TUTORIAL_BIBLIOTECA } from '../utils/tutorial';

const EQUIPAMENTOS = ['Barra', 'Barra W', 'Halteres', 'Máquina', 'Polia', 'Peso do corpo'];
const opcoes = (valores: readonly string[]): SelectOption[] =>
  valores.map((valor) => ({ value: valor, label: valor }));

/** Biblioteca de exercícios com vídeo (`/treinos/biblioteca`, `TreinosBiblioteca.html`). */
@Component({
  selector: 'app-biblioteca-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [BibliotecaStore],
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
    VideoEmbed,
    TutorialOverlay,
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
    .corpo {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      align-items: flex-start;
    }
    .lista {
      display: flex;
      flex: 2 1 560px;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
    }
    .filtros {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .filtro {
      padding: 8px 14px;
      border: 1px solid var(--border);
      border-radius: 20px;
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-semibold) 13px var(--font);
      white-space: nowrap;
      cursor: pointer;
    }
    .filtro[aria-pressed='true'] {
      border-width: 0;
      border-color: var(--ink);
      background: var(--ink);
      color: var(--on-ink);
    }
    .filtro:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .cartoes {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    .cartao {
      flex: 1 1 220px;
      max-width: 300px;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
    }
    .cartao__video {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 110px;
      background: var(--divider);
      color: var(--muted);
      font-size: 13px;
    }
    .cartao__video img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .cartao__texto {
      padding: 14px;
    }
    .cartao__texto small {
      display: block;
      margin-top: 2px;
      color: var(--muted);
      font-size: 12px;
    }
    .painel {
      flex: 1 1 320px;
      align-self: flex-start;
      min-width: 0;
      padding: 20px;
      border: 1px solid var(--accent);
      border-radius: var(--radius-card);
      background: var(--surface);
    }
    h2 {
      margin: 0 0 12px;
      font-size: 16px;
      font-weight: var(--font-weight-bold);
    }
    .painel__campos {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-bottom: var(--teclado-altura, 0px);
    }
    .par {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .coluna {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    .par .coluna {
      flex: 1 1 120px;
    }
    ui-select {
      min-width: 0;
    }
    .rotulo {
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
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
    .previa {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 110px;
      border-radius: 12px;
      background: var(--divider);
      color: var(--muted);
      font-size: 13px;
    }
    .acoes {
      display: flex;
      gap: 10px;
    }
    .acoes ui-button:first-child {
      flex: 1;
    }
    :host ::ng-deep .acoes ui-button button {
      padding: 0 15px;
    }
    :host ::ng-deep .acoes ui-button button.ui-button--outline {
      padding: 0 16px;
    }
    :host ::ng-deep ui-page-header ui-button button {
      padding: 0 15px;
    }
    .erro {
      margin: 0;
      color: var(--badge-late-fg);
      font-size: 13px;
    }
  `,
  template: `
    <ui-page-header
      heading="Treinos"
      data-tutorial="cabecalho"
      subtitle="Exercícios com vídeo para montar as fichas."
      (helpClick)="tutorialAberto.set(true)"
    >
      <ui-button *appPermission="'treinos:criar'" actions size="lg" (click)="novo()">
        Novo exercício
      </ui-button>
    </ui-page-header>

    <app-abas-de-treinos ativa="biblioteca" />

    <div class="corpo">
      <div class="lista">
        <div class="filtros" role="group" aria-label="Grupo muscular" data-tutorial="filtros">
          @for (grupo of grupos; track grupo.valor) {
            <button
              type="button"
              class="filtro"
              [attr.aria-pressed]="store.grupo() === grupo.valor"
              (click)="store.carregar(grupo.valor)"
            >
              {{ grupo.rotulo }}
            </button>
          }
        </div>
        @switch (store.estado()) {
          @case ('carregando') {
            <div aria-busy="true">
              <ui-skeleton height="110px" />
            </div>
          }
          @case ('erro') {
            <ui-error-state
              heading="Não foi possível carregar a biblioteca"
              description="Confira a conexão e tente de novo."
              (retry)="store.carregar()"
            />
          }
          @case ('sem-permissao') {
            <ui-no-permission-state />
          }
          @default {
            @if (cartoes().length === 0) {
              <ui-empty-state
                heading="Nenhum exercício aqui"
                description="Cadastre um exercício com vídeo para usar nas fichas."
                [icon]="true"
              />
            } @else {
              <div class="cartoes">
                @for (exercicio of cartoes(); track exercicio.id) {
                  <section class="cartao">
                    <div class="cartao__video">
                      Vídeo
                      @if (exercicio.capa) {
                        <img [src]="exercicio.capa" alt="" loading="lazy" />
                      }
                    </div>
                    <div class="cartao__texto">
                      <b>{{ exercicio.nome }}</b>
                      <small>{{ exercicio.grupoMuscular }} · {{ exercicio.equipamento }}</small>
                    </div>
                  </section>
                }
              </div>
            }
          }
        }
      </div>

      <section class="painel" aria-label="Cadastrar exercício" data-tutorial="painel">
        <h2>Cadastrar exercício</h2>
        <div class="painel__campos" appKeyboardSafe>
          <div class="coluna">
            <label class="rotulo" for="exercicio-nome">Nome</label>
            <input
              id="exercicio-nome"
              class="campo"
              autocomplete="off"
              enterkeyhint="next"
              [value]="nome()"
              (input)="nome.set(texto($event))"
            />
          </div>
          <div class="par">
            <div class="coluna">
              <span class="rotulo">Grupo muscular</span>
              <ui-select
                ariaLabel="Grupo muscular"
                [options]="gruposDoCadastro"
                [value]="grupo()"
                (valueChange)="grupo.set($event)"
              />
            </div>
            <div class="coluna">
              <span class="rotulo">Equipamento</span>
              <ui-select
                ariaLabel="Equipamento"
                [options]="equipamentos"
                [value]="equipamento()"
                (valueChange)="equipamento.set($event)"
              />
            </div>
          </div>
          <div class="coluna">
            <label class="rotulo" for="exercicio-video">Link do vídeo (YouTube)</label>
            <input
              id="exercicio-video"
              class="campo"
              inputmode="url"
              autocomplete="off"
              enterkeyhint="next"
              placeholder="https://youtube.com/watch?v=..."
              [value]="video()"
              (input)="video.set(texto($event))"
            />
          </div>
          @if (idDoVideo(); as id) {
            <ui-video-embed [video]="id" [title]="nome() || 'Prévia do exercício'" />
          } @else {
            <div class="previa">Prévia do vídeo no player do YouTube</div>
          }
          <div class="coluna">
            <label class="rotulo" for="exercicio-instrucoes">Instruções</label>
            <input
              id="exercicio-instrucoes"
              class="campo"
              autocomplete="off"
              enterkeyhint="done"
              [value]="instrucoes()"
              (input)="instrucoes.set(texto($event))"
            />
          </div>
          @if (erro()) {
            <p class="erro" role="alert">{{ erro() }}</p>
          }
          <div class="acoes">
            <ui-button
              *appPermission="'treinos:criar'"
              variant="accent"
              size="lg"
              [block]="true"
              [loading]="store.salvando()"
              (click)="salvar()"
            >
              Salvar exercício
            </ui-button>
            <ui-button variant="outline" size="lg" (click)="limpar()">Cancelar</ui-button>
          </div>
        </div>
      </section>
    </div>

    <ui-tutorial-overlay [config]="tutorial" [(open)]="tutorialAberto" />
  `,
})
export class BibliotecaPage {
  protected readonly store = inject(BibliotecaStore);
  private readonly toast = inject(ToastService);

  protected readonly grupos = [
    { valor: '', rotulo: 'Todos' },
    ...GRUPOS_MUSCULARES.map((grupo) => ({ valor: grupo, rotulo: grupo })),
  ];
  protected readonly gruposDoCadastro = opcoes(GRUPOS_MUSCULARES);
  protected readonly equipamentos = opcoes(EQUIPAMENTOS);

  protected readonly tutorial = TUTORIAL_BIBLIOTECA;
  protected readonly tutorialAberto = signal(false);
  protected readonly nome = signal('');
  protected readonly grupo = signal('Peito');
  protected readonly equipamento = signal('Barra');
  protected readonly video = signal('');
  protected readonly instrucoes = signal('');
  protected readonly erro = signal<string | null>(null);

  protected readonly idDoVideo = computed(() => extrairIdDoYoutube(this.video()));
  protected readonly cartoes = computed(() =>
    this.store.exercicios().map((exercicio) => {
      const id = exercicio.videoUrl ? extrairIdDoYoutube(exercicio.videoUrl) : null;
      return { ...exercicio, capa: id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null };
    }),
  );

  constructor() {
    this.store.carregar();
  }

  protected texto(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  protected novo(): void {
    this.limpar();
    document.getElementById('exercicio-nome')?.focus();
  }

  protected limpar(): void {
    this.nome.set('');
    this.grupo.set('Peito');
    this.equipamento.set('Barra');
    this.video.set('');
    this.instrucoes.set('');
    this.erro.set(null);
  }

  protected salvar(): void {
    this.erro.set(null);
    this.store
      .cadastrar({
        nome: this.nome().trim(),
        grupoMuscular: this.grupo() as never,
        equipamento: this.equipamento(),
        videoUrl: this.video().trim() || null,
        instrucoes: this.instrucoes().trim() || null,
      })
      .subscribe({
        next: () => {
          this.limpar();
          this.toast.show({ message: 'Exercício cadastrado.', tone: 'success' });
        },
        error: (falha: unknown) =>
          this.erro.set(mensagemDaApi(falha, 'Não foi possível salvar o exercício.')),
      });
  }
}
