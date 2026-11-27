import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Permission } from '@gymos/shared-forms';
import { validarModelo } from '@gymos/shared-templates';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Modal,
  NoPermissionState,
  PageHeader,
  Skeleton,
  ToastService,
} from '@gymos/ui';
import { AbasDeAlunos } from '../components/abas-de-alunos';
import { LoteStore, type ModoDoLote } from '../data-access/lote.store';
import {
  baixarTexto,
  celulaDeCsv,
  mensagemDaApi,
  nomeDoPlano,
  textoDaSituacao,
  variantDaSituacao,
} from '../utils/apresentacao';

/** Modelo que `AlunosLote.html` mostra (as variáveis são trocadas por aluno, T13d). */
const MODELO_INICIAL =
  'Olá, {nome}! Sua mensalidade do plano {plano} está em aberto. Pague pelo app ou pelo PIX: {link}';

/** Ações em lote (`/alunos/lote`, `AlunosLote.html`). */
@Component({
  selector: 'app-alunos-lote-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LoteStore],
  imports: [
    PageHeader,
    Button,
    Badge,
    Skeleton,
    EmptyState,
    ErrorState,
    NoPermissionState,
    Modal,
    Permission,
    AbasDeAlunos,
  ],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 22px;
    }
    .lote__barra {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-radius: 14px;
      background: var(--ink);
      color: var(--on-ink);
    }
    .lote__barra b {
      font-size: 14px;
    }
    .lote__barra-acoes {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .lote__corpo {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      align-items: flex-start;
    }
    /* O protótipo não tem a borda transparente do botão: 15 px + 1 px de borda dão os 16 px da tela. */
    ui-button ::ng-deep button {
      padding-inline: 15px;
    }
    .lote__lista {
      flex: 1.3 1 480px;
      min-width: 0;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
    }
    .lote__filtros {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 14px 16px;
    }
    .lote__filtro {
      padding: 7px 14px;
      border: 1px solid var(--border);
      border-radius: 20px;
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-semibold) 13px var(--font);
      cursor: pointer;
    }
    .lote__filtro[aria-pressed='true'] {
      border-width: 0;
      background: var(--ink);
      color: var(--on-ink);
    }
    .lote__filtro:focus-visible,
    .lote__marca:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .lote__rolagem {
      overflow-x: auto;
      border-top: 1px solid var(--divider);
    }
    .lote__grade {
      min-width: 520px;
    }
    .lote__linha {
      display: grid;
      grid-template-columns: 40px minmax(170px, 1.4fr) minmax(100px, 0.8fr) minmax(140px, 1fr);
      gap: 10px;
      align-items: center;
      padding: 12px 16px;
      border-top: 1px solid var(--divider);
      font-size: 14px;
    }
    .lote__linha--titulo {
      padding: 10px 16px;
      border-top: 0;
      color: var(--muted);
      font-size: 12px;
      font-weight: var(--font-weight-semibold);
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .lote__linha--marcada {
      background: color-mix(in srgb, var(--accent) 10%, var(--surface));
    }
    .lote__marca {
      width: 22px;
      height: 22px;
      accent-color: var(--accent-text);
    }
    .lote__mais {
      display: flex;
      justify-content: center;
      padding: 12px;
      border-top: 1px solid var(--divider);
    }
    .lote__mensagem {
      display: flex;
      flex: 1 1 320px;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      padding: 20px;
      border: 1px solid var(--accent);
      border-radius: var(--radius-card);
      background: var(--surface);
      box-sizing: border-box;
    }
    h2 {
      margin: 0;
      font-size: 16px;
      font-weight: var(--font-weight-bold);
    }
    .lote__texto {
      width: 100%;
      min-height: 96px;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: color-mix(in srgb, var(--page) 60%, var(--surface));
      color: var(--ink);
      font: var(--font-weight-regular) 14px/1.5 var(--font);
      box-sizing: border-box;
      resize: none;
    }
    .lote__texto:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .lote__texto[aria-invalid='true'] {
      border-color: var(--badge-late-fg);
    }
    .lote__dica {
      margin: 0;
      font-size: 12px;
      line-height: 1.4;
      color: var(--muted);
    }
    .lote__erros {
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 12px;
      font-weight: var(--font-weight-semibold);
      color: var(--badge-late-fg);
    }
    .lote__envio {
      display: flex;
      gap: 10px;
    }
    .lote__envio ui-button:last-child {
      flex: 1;
    }
    .lote__cartao {
      padding: 16px;
    }
    .lote__previa {
      margin: 0;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: color-mix(in srgb, var(--page) 60%, var(--surface));
      font-size: 14px;
      line-height: 1.5;
      white-space: pre-wrap;
    }
  `,
  template: `
    <ui-page-header
      heading="Alunos"
      subtitle="Ações em lote: selecione e envie de uma vez."
      [help]="false"
    />

    <app-abas-de-alunos ativa="lista" />

    <div class="lote__barra">
      <b aria-live="polite">{{ textoDaSelecao() }}</b>
      <div class="lote__barra-acoes">
        <ui-button variant="accent" [disabled]="semSelecao()" (click)="irParaMensagem()">
          Enviar WhatsApp
        </ui-button>
        <ui-button
          *appPermission="'financeiro:criar'"
          variant="outline"
          [disabled]="semSelecao()"
          [loading]="store.enviando()"
          (click)="enviarCobranca()"
        >
          Enviar cobrança
        </ui-button>
        <ui-button variant="outline" [disabled]="semSelecao()" (click)="exportar()">
          Exportar
        </ui-button>
        <ui-button variant="outline" [disabled]="semSelecao()" (click)="store.limparSelecao()">
          Limpar seleção
        </ui-button>
      </div>
    </div>

    <div class="lote__corpo">
      <section class="lote__lista" aria-label="Alunos para o lote">
        <div class="lote__filtros" role="group" aria-label="Quais alunos listar">
          <button
            type="button"
            class="lote__filtro"
            [attr.aria-pressed]="store.modo() === 'atencao'"
            (click)="escolherModo('atencao')"
          >
            Em atraso e a vencer
            @if (store.contadores()) {
              &ngsp;<span>{{ store.totalDeAtencao() }}</span>
            }
          </button>
          <button
            type="button"
            class="lote__filtro"
            [attr.aria-pressed]="store.modo() === 'todos'"
            (click)="escolherModo('todos')"
          >
            Todos
            @if (store.contadores()) {
              &ngsp;<span>{{ store.contadores()?.todos }}</span>
            }
          </button>
        </div>

        @switch (store.estado()) {
          @case ('carregando') {
            <div class="lote__cartao" aria-busy="true">
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
            @if (store.itens().length === 0) {
              <ui-empty-state
                heading="Nenhum aluno em atraso ou a vencer"
                description='Escolha "Todos" para listar a academia inteira.'
              />
            } @else {
              <div class="lote__rolagem">
                <div class="lote__grade">
                  <div class="lote__linha lote__linha--titulo">
                    <span></span><span>Aluno</span><span>Plano</span><span>Adimplência</span>
                  </div>
                  @for (aluno of linhas(); track aluno.id) {
                    <div class="lote__linha" [class.lote__linha--marcada]="aluno.marcado">
                      <input
                        type="checkbox"
                        class="lote__marca"
                        [attr.aria-label]="'Selecionar ' + aluno.nome"
                        [checked]="aluno.marcado"
                        (change)="alternar(aluno.id, $event)"
                      />
                      <b>{{ aluno.nome }}</b>
                      <span>{{ aluno.plano }}</span>
                      <span>
                        <ui-badge [variant]="aluno.variante">{{ aluno.situacao }}</ui-badge>
                      </span>
                    </div>
                  }
                </div>
              </div>
              @if (store.proximoCursor()) {
                <div class="lote__mais">
                  <ui-button variant="outline" (click)="store.carregarMais()">
                    Carregar mais
                  </ui-button>
                </div>
              }
            }
          }
        }
      </section>

      <section class="lote__mensagem" aria-labelledby="lote-mensagem">
        <h2 id="lote-mensagem">{{ tituloDaMensagem() }}</h2>
        <textarea
          #campo
          class="lote__texto"
          aria-label="Texto da mensagem"
          autocomplete="off"
          [attr.aria-invalid]="validacao().valido ? null : 'true'"
          [value]="texto()"
          (input)="texto.set($any($event.target).value)"
        ></textarea>
        @if (!validacao().valido) {
          <ul class="lote__erros" role="alert">
            @for (erro of validacao().erros; track erro.posicao) {
              <li>{{ erro.mensagem }} (posição {{ erro.posicao + 1 }})</li>
            }
          </ul>
        }
        <p class="lote__dica">
          Os campos entre chaves são trocados por aluno. Mensagens de WhatsApp seguem as regras e
          custos da Meta.
        </p>
        <div class="lote__envio">
          <ui-button
            size="lg"
            variant="outline"
            [disabled]="!podePrevisualizar()"
            (click)="previa.set(true)"
          >
            Pré-visualizar
          </ui-button>
          <ui-button
            size="lg"
            variant="accent"
            [block]="true"
            [disabled]="!podeEnviar()"
            (click)="enviarAgora()"
          >
            Enviar agora
          </ui-button>
        </div>
      </section>
    </div>

    <ui-modal [(open)]="previa" heading="Pré-visualização da mensagem">
      <p class="lote__previa">{{ textoDaPrevia() }}</p>
      <p class="lote__dica">
        Valor, vencimento, professor e link são preenchidos por aluno no momento do envio.
      </p>
      <ui-button footer variant="outline" (click)="previa.set(false)">Fechar</ui-button>
    </ui-modal>
  `,
})
export class AlunosLotePage {
  protected readonly store = inject(LoteStore);
  private readonly toast = inject(ToastService);
  private readonly campo = viewChild<ElementRef<HTMLTextAreaElement>>('campo');

  protected readonly linhasDeEspera = [1, 2, 3, 4, 5, 6];
  protected readonly texto = signal(MODELO_INICIAL);
  protected readonly previa = signal(false);

  protected readonly validacao = computed(() => validarModelo(this.texto(), 'cobranca'));
  protected readonly semSelecao = computed(() => this.store.selecionados().size === 0);
  protected readonly textoDaSelecao = computed(() => {
    const total = this.store.selecionados().size;
    if (total === 0) {
      return 'Nenhum aluno selecionado';
    }
    return total === 1 ? '1 aluno selecionado' : `${total} alunos selecionados`;
  });
  protected readonly tituloDaMensagem = computed(() => {
    const total = this.store.selecionados().size;
    if (total === 0) {
      return 'Mensagem';
    }
    return total === 1 ? 'Mensagem para 1 aluno' : `Mensagem para ${total} alunos`;
  });
  protected readonly podePrevisualizar = computed(
    () => this.validacao().valido && this.texto().trim() !== '' && !this.semSelecao(),
  );
  protected readonly podeEnviar = computed(
    () => this.validacao().valido && this.texto().trim() !== '' && !this.semSelecao(),
  );
  protected readonly linhas = computed(() =>
    this.store.itens().map((item) => ({
      id: item.id,
      nome: item.nome,
      plano: nomeDoPlano(item),
      situacao: textoDaSituacao(item),
      variante: variantDaSituacao(item.situacao),
      marcado: this.store.selecionados().has(item.id),
    })),
  );
  /** O primeiro aluno marcado serve de exemplo: só nome e plano são conhecidos aqui. */
  protected readonly textoDaPrevia = computed(() => {
    const exemplo = this.store.alunosSelecionados()[0];
    const valores: Record<string, string> = {
      nome: exemplo?.nome ?? '',
      plano: exemplo ? nomeDoPlano(exemplo) : '',
    };
    return this.validacao()
      .partes.map((parte) => {
        if (parte.tipo === 'texto') {
          return parte.texto;
        }
        return valores[parte.nome] || `{${parte.nome}}`;
      })
      .join('');
  });

  constructor() {
    this.store.carregar();
  }

  protected escolherModo(modo: ModoDoLote): void {
    this.store.escolherModo(modo);
  }

  protected alternar(id: string, evento: Event): void {
    this.store.alternar(id, (evento.target as HTMLInputElement).checked);
  }

  protected irParaMensagem(): void {
    this.campo()?.nativeElement.focus();
  }

  /**
   * A Mensageria (T13d) ainda não expõe um endpoint de envio para o painel (só a cobrança em lote
   * do T19, com texto fixo): o texto e a seleção estão validados, mas nada é enviado.
   */
  protected enviarAgora(): void {
    this.toast.show({
      message: 'O envio de mensagens em lote pelo WhatsApp ainda não está disponível.',
      tone: 'info',
    });
  }

  protected enviarCobranca(): void {
    if (this.store.enviando() || this.semSelecao()) {
      return;
    }
    this.store.enviarCobranca().subscribe({
      next: ({ enviadas, semPendencia }) => {
        const enviado = enviadas === 1 ? '1 cobrança enviada' : `${enviadas} cobranças enviadas`;
        const pulado =
          semPendencia > 0
            ? semPendencia === 1
              ? ' 1 aluno estava sem parcela vencida.'
              : ` ${semPendencia} alunos estavam sem parcela vencida.`
            : '';
        this.toast.show({ message: `${enviado}.${pulado}`, tone: 'success' });
      },
      error: (falha: unknown) =>
        this.toast.show({
          message: mensagemDaApi(falha, 'Não foi possível enviar as cobranças.'),
          tone: 'error',
        }),
    });
  }

  protected exportar(): void {
    const linhas = this.store
      .alunosSelecionados()
      .map((aluno) =>
        [aluno.nome, nomeDoPlano(aluno), textoDaSituacao(aluno)].map(celulaDeCsv).join(';'),
      );
    baixarTexto('alunos-selecionados.csv', ['Aluno;Plano;Adimplência', ...linhas].join('\r\n'));
  }
}
