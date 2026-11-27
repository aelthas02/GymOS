import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CLIENTE_DA_API } from '@gymos/api-contracts';
import { KeyboardSafe, MascaraData, Permission } from '@gymos/shared-forms';
import {
  Button,
  ErrorState,
  Field,
  FieldControl,
  Modal,
  NoPermissionState,
  PageHeader,
  Select,
  Skeleton,
  ToastService,
  TutorialOverlay,
  VideoEmbed,
  extrairIdDoYoutube,
} from '@gymos/ui';
import { EditorDeTreinos } from '../components/editor-de-treinos';
import { FichaStore } from '../data-access/ficha.store';
import type { Divisao, Exercicio, ExercicioEditavel, Nivel } from '../models/treinos';
import {
  DIVISOES,
  FREQUENCIAS,
  NIVEIS,
  dataBr,
  dataParaIso,
  editavelDe,
  mensagemDaApi,
} from '../utils/apresentacao';
import { TUTORIAL_FICHA } from '../utils/tutorial';

/** Ficha de treino do aluno (`/alunos/:id/ficha-de-treino`, `AlunosFicha.html`). */
@Component({
  selector: 'app-ficha-do-aluno-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [FichaStore],
  imports: [
    ReactiveFormsModule,
    KeyboardSafe,
    MascaraData,
    Permission,
    PageHeader,
    Button,
    Field,
    FieldControl,
    Select,
    Skeleton,
    ErrorState,
    NoPermissionState,
    Modal,
    VideoEmbed,
    TutorialOverlay,
    EditorDeTreinos,
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
    /* Trilha como no protótipo: texto simples com "›", a 22 px do título. */
    :host ::ng-deep .cabecalho .ui-page-header {
      gap: 22px;
    }
    :host ::ng-deep .cabecalho ol {
      gap: 4px;
    }
    :host ::ng-deep .cabecalho ol a {
      text-decoration: none;
    }
    :host ::ng-deep .cabecalho ol [aria-current='page'] {
      color: var(--muted);
      font-weight: var(--font-weight-regular);
    }
    :host ::ng-deep .cabecalho ol span[aria-hidden] {
      display: none;
    }
    :host ::ng-deep .cabecalho ol li:not(:last-child)::after {
      content: '›';
      margin-left: 4px;
    }
    ui-select {
      min-width: 0;
    }
    :host ::ng-deep .acoes-do-cabecalho button,
    :host ::ng-deep ui-page-header ui-button button {
      padding: 0 15px;
    }
    :host ::ng-deep ui-page-header ui-button button.ui-button--outline {
      padding: 0 16px;
    }
    :host ::ng-deep .banner ui-button button {
      padding: 0 15px;
    }
    :host ::ng-deep .banner ui-button button.ui-button--outline {
      padding: 0 16px;
    }
    :host ::ng-deep .movimento ui-button button {
      padding: 0 15px;
    }
    :host ::ng-deep .movimento ui-button button.ui-button--outline {
      padding: 0 16px;
    }
    .ficha {
      display: flex;
      flex-direction: column;
      gap: 22px;
      /* O rodapé do teclado virtual soma a altura do teclado, para o último campo poder ir ao centro. */
      padding-bottom: var(--teclado-altura, 0px);
    }
    .banner {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border: 1px solid var(--accent);
      border-radius: 14px;
      background: color-mix(in srgb, var(--accent) 12%, var(--surface));
      font-size: 14px;
      line-height: 1.4;
    }
    .banner__acoes {
      display: flex;
      gap: 8px;
    }
    .cartao {
      min-width: 0;
      padding: 20px;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
    }
    h2 {
      margin: 0 0 12px;
      font-size: 16px;
      font-weight: var(--font-weight-bold);
    }
    .dados {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      align-items: flex-end;
    }
    .dados > * {
      min-width: 0;
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
    .coluna,
    .divisao {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .divisao__opcoes {
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
      border-width: 0;
      border-color: var(--ink);
      background: var(--ink);
      color: var(--on-ink);
    }
    .pilula:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .restricoes {
      margin-top: 14px;
    }
    .corpo {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      align-items: flex-start;
    }
    app-editor-de-treinos {
      flex: 2 1 560px;
      align-self: flex-start;
    }
    .movimento {
      display: flex;
      flex: 1 1 260px;
      flex-direction: column;
      align-self: flex-start;
      gap: 12px;
      padding: 18px;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
    }
    .movimento h2 {
      margin: 0;
    }
    .movimento__capa {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 170px;
      border-radius: 12px;
      background: var(--ink);
    }
    .movimento__play {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--accent);
    }
    .movimento__play span {
      display: block;
      margin-left: 5px;
      border-style: solid;
      border-width: 10px 0 10px 17px;
      border-color: transparent transparent transparent var(--ink);
    }
    .movimento__nome {
      font-size: 16px;
      font-weight: var(--font-weight-bold);
    }
    .movimento__texto {
      margin-top: 2px;
      color: var(--muted);
      font-size: 13px;
    }
    .movimento__ajuda {
      margin: 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
    }
    .movimento__acoes {
      display: flex;
      gap: 8px;
    }
    .biblioteca {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 50vh;
      margin: 0;
      padding: 0;
      overflow-y: auto;
      list-style: none;
    }
    .biblioteca li {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--divider);
    }
    .biblioteca small {
      display: block;
      color: var(--muted);
    }
  `,
  template: `
    <ui-page-header
      class="cabecalho"
      heading="Ficha de treino"
      [breadcrumb]="trilha()"
      subtitle="Crie ou edite a ficha do aluno. A IA sugere, o professor aprova."
      (helpClick)="tutorialAberto.set(true)"
    >
      <ui-button
        *appPermission="'treinos:criar'"
        actions
        size="lg"
        variant="accent"
        [loading]="store.gerando()"
        (click)="gerar()"
      >
        Gerar com IA
      </ui-button>
      <ui-button actions size="lg" variant="outline" (click)="imprimir()">Imprimir</ui-button>
      <ui-button
        *appPermission="'treinos:editar'"
        actions
        size="lg"
        variant="outline"
        [loading]="store.processando()"
        (click)="salvar(false)"
      >
        Salvar rascunho
      </ui-button>
      <ui-button
        *appPermission="'treinos:editar'"
        actions
        size="lg"
        [loading]="store.processando()"
        (click)="salvar(true)"
      >
        Salvar e enviar ao aluno
      </ui-button>
    </ui-page-header>

    @switch (store.estado()) {
      @case ('carregando') {
        <div aria-busy="true">
          @for (linha of linhasDeEspera; track linha) {
            <ui-skeleton height="44px" />
          }
        </div>
      }
      @case ('erro') {
        <ui-error-state
          heading="Não foi possível carregar a ficha"
          description="Confira a conexão e tente de novo."
          (retry)="carregar()"
        />
      }
      @case ('sem-permissao') {
        <ui-no-permission-state />
      }
      @default {
        <div class="ficha" appKeyboardSafe>
          @if (store.aguardando()) {
            <div class="banner" role="status">
              <div>
                <b>Rascunho gerado com IA.</b> Revise os exercícios e aprove antes de enviar ao
                aluno.
              </div>
              <div class="banner__acoes">
                <ui-button
                  *appPermission="'treinos:editar'"
                  variant="accent"
                  [loading]="store.processando()"
                  (click)="aprovar()"
                >
                  Aprovar ficha
                </ui-button>
                <ui-button
                  *appPermission="'treinos:criar'"
                  variant="outline"
                  [loading]="store.gerando()"
                  (click)="gerar()"
                >
                  Gerar de novo
                </ui-button>
              </div>
            </div>
          }

          <section class="cartao" data-tutorial="dados">
            <h2>Dados da ficha</h2>
            <form class="dados" novalidate [formGroup]="form">
              <ui-field label="Aluno" style="flex: 1 1 200px">
                <input uiFieldControl class="campo" readonly [value]="store.alunoNome()" />
              </ui-field>
              <ui-field label="Objetivo" style="flex: 1 1 160px">
                <input
                  uiFieldControl
                  class="campo"
                  autocomplete="off"
                  enterkeyhint="next"
                  formControlName="objetivo"
                />
              </ui-field>
              <div class="coluna" style="flex: 1 1 140px">
                <span class="rotulo" id="rotulo-nivel">Nível</span>
                <ui-select
                  ariaLabel="Nível"
                  [options]="niveis"
                  [value]="nivel()"
                  (valueChange)="escolherNivel($event)"
                />
              </div>
              <div class="coluna" style="flex: 1 1 130px">
                <span class="rotulo" id="rotulo-frequencia">Frequência semanal</span>
                <ui-select
                  ariaLabel="Frequência semanal"
                  [options]="frequencias"
                  [value]="frequencia()"
                  (valueChange)="frequencia.set($event)"
                />
              </div>
              <div class="divisao" style="flex: 1 1 220px">
                <span class="rotulo" id="rotulo-divisao">Divisão do treino</span>
                <div class="divisao__opcoes" role="group" aria-labelledby="rotulo-divisao">
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
              <ui-field label="Válida até" style="flex: 1 1 130px">
                <input
                  uiFieldControl
                  appData
                  class="campo"
                  placeholder="dd/mm/aaaa"
                  enterkeyhint="next"
                  formControlName="validaAte"
                />
              </ui-field>
            </form>
            <div class="restricoes" [formGroup]="form">
              <ui-field label="Observações e restrições">
                <input
                  uiFieldControl
                  class="campo"
                  autocomplete="off"
                  enterkeyhint="done"
                  formControlName="restricoes"
                />
              </ui-field>
            </div>
          </section>

          <div class="corpo">
            <app-editor-de-treinos
              data-tutorial="treinos"
              [edicao]="store.edicao"
              (verMovimento)="store.edicao.selecionado.set($event)"
              (abrirBiblioteca)="abrirBiblioteca('adicionar')"
            />
            <aside class="movimento" aria-label="Visualizar movimento" data-tutorial="movimento">
              <h2>Visualizar movimento</h2>
              @if (selecionado(); as exercicio) {
                @if (idDoVideo(); as video) {
                  <ui-video-embed [video]="video" [title]="exercicio.nome || 'Exercício'" />
                } @else {
                  <div class="movimento__capa" aria-hidden="true">
                    <span class="movimento__play"><span></span></span>
                  </div>
                }
                <div>
                  <div class="movimento__nome">{{ exercicio.nome || 'Exercício' }}</div>
                  <div class="movimento__texto">{{ descricaoDoMovimento() }}</div>
                </div>
                <ui-field label="Link do vídeo">
                  <input
                    uiFieldControl
                    class="campo"
                    inputmode="url"
                    autocomplete="off"
                    enterkeyhint="done"
                    [value]="exercicio.videoUrl"
                    (input)="editarVideo(exercicio, $event)"
                  />
                </ui-field>
                <p class="movimento__ajuda">
                  Cole um link do YouTube ou escolha da biblioteca. O aluno vê o vídeo pelo player
                  oficial.
                </p>
                <div class="movimento__acoes">
                  <ui-button variant="outline" (click)="abrirBiblioteca('video')">
                    Trocar vídeo
                  </ui-button>
                  <ui-button variant="outline" (click)="removerVideo(exercicio)">Remover</ui-button>
                </div>
              } @else {
                <p class="movimento__texto">Escolha um exercício em "Ver movimento".</p>
              }
            </aside>
          </div>
        </div>
      }
    }

    <ui-tutorial-overlay [config]="tutorial" [(open)]="tutorialAberto" />

    <ui-modal
      [open]="modoDaBiblioteca() !== null"
      heading="Biblioteca de exercícios"
      (openChange)="fecharBiblioteca($event)"
    >
      <ul class="biblioteca">
        @for (item of biblioteca(); track item.id) {
          <li>
            <span>
              <b>{{ item.nome }}</b>
              <small>{{ item.grupoMuscular }} · {{ item.equipamento }}</small>
            </span>
            <ui-button size="sm" (click)="escolherDaBiblioteca(item)">
              {{ modoDaBiblioteca() === 'video' ? 'Usar vídeo' : 'Adicionar' }}
            </ui-button>
          </li>
        } @empty {
          <li>Nenhum exercício cadastrado na biblioteca.</li>
        }
      </ul>
      <ui-button footer variant="outline" (click)="modoDaBiblioteca.set(null)">Fechar</ui-button>
    </ui-modal>
  `,
})
export class FichaDoAlunoPage {
  protected readonly store = inject(FichaStore);
  private readonly api = inject(CLIENTE_DA_API);
  private readonly toast = inject(ToastService);
  private readonly rota = inject(ActivatedRoute);

  protected readonly niveis = NIVEIS;
  protected readonly frequencias = FREQUENCIAS;
  protected readonly divisoes = DIVISOES;
  protected readonly linhasDeEspera = [1, 2, 3, 4];
  protected readonly tutorial = TUTORIAL_FICHA;
  protected readonly tutorialAberto = signal(false);

  protected readonly form = new FormGroup({
    objetivo: new FormControl('', { nonNullable: true }),
    validaAte: new FormControl('', { nonNullable: true }),
    restricoes: new FormControl('', { nonNullable: true }),
  });
  protected readonly nivel = signal<Nivel>('intermediario');
  protected readonly frequencia = signal('3');
  protected readonly divisao = signal<Divisao>('ABC');

  protected readonly modoDaBiblioteca = signal<'adicionar' | 'video' | null>(null);
  protected readonly biblioteca = signal<readonly Exercicio[]>([]);

  protected readonly alunoId = toSignal(this.rota.paramMap, { requireSync: true });
  protected readonly selecionado = this.store.edicao.selecionado;
  protected readonly trilha = computed(() => [
    { label: 'Alunos', link: '/alunos' },
    { label: this.store.alunoNome() || 'Aluno' },
    { label: 'Ficha de treino' },
  ]);
  protected readonly idDoVideo = computed(() => {
    const video = this.selecionado()?.videoUrl ?? '';
    return video ? extrairIdDoYoutube(video) : null;
  });
  protected readonly descricaoDoMovimento = computed(() => {
    const exercicio = this.selecionado();
    if (!exercicio) {
      return '';
    }
    const daBiblioteca = this.biblioteca().find((item) => item.nome === exercicio.nome);
    const series = `${exercicio.series} séries de ${exercicio.repeticoes} repetições.`;
    return daBiblioteca?.instrucoes ? `${daBiblioteca.instrucoes} ${series}` : series;
  });

  constructor() {
    // Ao chegar a ficha (ou ao trocá-la), o formulário reflete os dados do servidor.
    effect(() => {
      const ficha = this.store.ficha();
      untracked(() => {
        if (ficha) {
          this.form.setValue({
            objetivo: ficha.objetivo,
            validaAte: ficha.validaAte ? dataBr(ficha.validaAte) : '',
            restricoes: ficha.restricoes ?? '',
          });
          this.nivel.set(ficha.nivel);
          this.frequencia.set(String(ficha.frequenciaSemanal));
          this.divisao.set(ficha.divisao);
        }
      });
    });
    this.carregar();
    this.api.get('/api/treinos/exercicios').subscribe({
      next: (itens) => this.biblioteca.set(itens),
      error: () => undefined,
    });
  }

  protected escolherNivel(valor: string): void {
    this.nivel.set(valor as Nivel);
  }

  protected carregar(): void {
    this.store.carregar(this.id());
  }

  private id(): string {
    return this.alunoId().get('id') ?? '';
  }

  private dados() {
    const { objetivo, validaAte, restricoes } = this.form.getRawValue();
    return {
      objetivo: objetivo.trim(),
      nivel: this.nivel(),
      frequenciaSemanal: Number(this.frequencia()),
      divisao: this.divisao(),
      validaAte: dataParaIso(validaAte),
      restricoes: restricoes.trim() || null,
    };
  }

  protected salvar(enviar: boolean): void {
    const dados = this.dados();
    if (!dados.objetivo) {
      this.toast.show({ message: 'Informe o objetivo da ficha.', tone: 'error' });
      return;
    }
    this.store.salvar(this.id(), { ...dados, nome: '', enviar }).subscribe({
      next: () =>
        this.toast.show({
          message: enviar ? 'Ficha enviada ao aluno.' : 'Rascunho salvo.',
          tone: 'success',
        }),
      error: (falha: unknown) =>
        this.toast.show({
          message: mensagemDaApi(falha, 'Não foi possível salvar a ficha.'),
          tone: 'error',
        }),
    });
  }

  protected gerar(): void {
    const { objetivo, nivel, frequenciaSemanal, divisao, restricoes, validaAte } = this.dados();
    if (!objetivo) {
      this.toast.show({ message: 'Informe o objetivo para a IA montar a ficha.', tone: 'error' });
      return;
    }
    this.store
      .gerar(this.id(), { objetivo, nivel, frequenciaSemanal, divisao, restricoes, validaAte })
      .subscribe({
        next: () =>
          this.toast.show({
            message: 'Rascunho gerado. Revise e aprove antes de enviar ao aluno.',
            tone: 'success',
          }),
        error: (falha: unknown) =>
          this.toast.show({
            message: mensagemDaApi(falha, 'Não foi possível gerar a ficha.'),
            tone: 'error',
          }),
      });
  }

  protected aprovar(): void {
    const ficha = this.store.ficha();
    if (!ficha) {
      return;
    }
    this.store.aprovar(ficha.id).subscribe({
      next: () => this.toast.show({ message: 'Ficha aprovada e enviada.', tone: 'success' }),
      error: (falha: unknown) =>
        this.toast.show({
          message: mensagemDaApi(falha, 'Não foi possível aprovar a ficha.'),
          tone: 'error',
        }),
    });
  }

  protected imprimir(): void {
    window.print();
  }

  protected editarVideo(exercicio: ExercicioEditavel, evento: Event): void {
    exercicio.videoUrl = (evento.target as HTMLInputElement).value;
    this.store.edicao.editou();
  }

  protected removerVideo(exercicio: ExercicioEditavel): void {
    exercicio.videoUrl = '';
    this.store.edicao.editou();
  }

  protected abrirBiblioteca(modo: 'adicionar' | 'video'): void {
    this.modoDaBiblioteca.set(modo);
  }

  protected fecharBiblioteca(aberto: boolean): void {
    if (!aberto) {
      this.modoDaBiblioteca.set(null);
    }
  }

  protected escolherDaBiblioteca(item: Exercicio): void {
    const selecionado = this.selecionado();
    if (this.modoDaBiblioteca() === 'video' && selecionado) {
      selecionado.videoUrl = item.videoUrl ?? '';
      this.store.edicao.editou();
    } else {
      const novo = editavelDe({
        exercicioId: item.id,
        nome: item.nome,
        series: 3,
        repeticoes: 12,
        cargaKg: null,
        descansoSegundos: 60,
        videoUrl: item.videoUrl,
      });
      this.store.edicao.adicionarExercicio(novo);
    }
    this.modoDaBiblioteca.set(null);
  }
}
