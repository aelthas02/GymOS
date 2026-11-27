import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { formatarDataBr } from '@gymos/shared-pipes/formatadores';
import { PERMISSION_CHECKER, Permission } from '@gymos/shared-forms';
import { BrlPipe } from '@gymos/shared-pipes';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Kpi,
  Modal,
  NoPermissionState,
  PageHeader,
  Skeleton,
  Tabs,
  ToastService,
} from '@gymos/ui';
import { type CorrecaoPedida, DetalheDaNota } from '../components/detalhe-da-nota';
import { ESTILOS_DO_FINANCEIRO } from '../components/estilos-do-financeiro';
import { NotasFiscaisStore } from '../data-access/notas-fiscais.store';
import type { NotaFiscal, NotaFiscalDetalhe } from '../models/notas';
import {
  baixarArquivo,
  larguraDaBarra,
  reaisInteiros,
  PERIODOS,
  SITUACAO_DA_NOTA,
  VISOES_DO_FINANCEIRO,
} from '../utils/notas';

const FALHA = 'Não foi possível concluir agora. Tente de novo em instantes.';

/** Financeiro › Notas fiscais (`FinNotas.html`): KPIs, notas do mês, resumo por tipo e atenção. */
@Component({
  selector: 'app-notas-fiscais-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [NotasFiscaisStore],
  imports: [
    PageHeader,
    Tabs,
    Kpi,
    Badge,
    Button,
    Modal,
    Skeleton,
    EmptyState,
    ErrorState,
    NoPermissionState,
    Permission,
    BrlPipe,
    DetalheDaNota,
  ],
  styles: `
    ${ESTILOS_DO_FINANCEIRO}
    .notas__visualizar {
      margin-bottom: -14px;
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
    }
    .notas__periodo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      padding: 14px 18px;
    }
    .notas__periodo-rotulo {
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
    }
    .notas__chip {
      padding: 8px 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      background: var(--surface);
      color: var(--ink);
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
      white-space: nowrap;
    }
    .notas__chip--ativo {
      border-color: var(--ink);
      background: var(--ink);
      color: var(--on-ink);
    }
    .notas__espaco {
      flex: 1;
    }
    .notas__mes {
      font-size: 13px;
      color: var(--muted);
    }
    .notas__kpis {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
    }
    .notas__kpis > * {
      flex: 1 1 200px;
      min-width: 0;
    }
    .notas__lista {
      padding: 0;
      overflow: hidden;
    }
    .notas__lista .fin-cartao__topo {
      padding: 18px 20px 8px;
      margin: 0;
    }
    .notas__rolagem {
      overflow-x: auto;
    }
    .notas__tabela {
      min-width: 560px;
    }
    .notas__linha {
      display: grid;
      grid-template-columns: 78px 1fr 1.2fr 86px 92px 80px;
      gap: 10px;
      align-items: center;
      padding: 12px 16px;
      border-top: 1px solid var(--divider);
      font-size: 14px;
    }
    .notas__linha--cabecalho {
      padding: 10px 16px;
      border-top: 0;
      color: var(--muted);
      font-size: 12px;
      font-weight: var(--font-weight-semibold);
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .notas__detalhe {
      font-size: 12px;
      color: var(--muted);
    }
    .notas__mais {
      padding: 12px 16px 16px;
      border-top: 1px solid var(--divider);
    }
    .notas__barra {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 9px;
      font-size: 13px;
    }
    .notas__barra > span {
      flex: none;
      width: 110px;
    }
    .notas__trilho {
      flex: 1;
      height: 10px;
      border-radius: 5px;
      background: var(--divider);
    }
    .notas__preenchido {
      height: 10px;
      border-radius: 5px;
      background: var(--accent);
    }
    .notas__barra > b {
      width: 78px;
      text-align: right;
    }
    .notas__explica {
      margin-top: 14px;
      font-size: 13px;
      line-height: 1.5;
      color: var(--muted);
    }
    .notas__atencao {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 14px;
    }
    .notas__atencao li {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }
    .notas__atencao li + li {
      padding-top: 10px;
      border-top: 1px solid var(--divider);
    }
    .notas__atencao button {
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
  `,
  template: `
    <ui-page-header heading="Financeiro" subtitle="Emissão e controle de notas fiscais.">
      <div actions>
        <ui-button variant="outline" [loading]="exportando()" (click)="exportar()">
          Exportar para o contador
        </ui-button>
        <ui-button *appPermission="'financeiro:criar'" (click)="irParaEmitir()"
          >Emitir nota</ui-button
        >
      </div>
    </ui-page-header>

    <div class="notas__visualizar" id="visualizar-por">Visualizar por</div>
    <ui-tabs [items]="visoes" label="Visualizar por" />

    @if (!podeVer) {
      <ui-no-permission-state />
    } @else {
      <section class="fin-cartao notas__periodo" aria-label="Período">
        <span class="notas__periodo-rotulo">Período</span>
        @for (periodo of periodos; track periodo) {
          <span
            class="notas__chip"
            [class.notas__chip--ativo]="periodo === 'Este mês'"
            [attr.aria-current]="periodo === 'Este mês' ? 'true' : null"
            [attr.aria-disabled]="periodo === 'Este mês' ? null : 'true'"
            >{{ periodo }}</span
          >
        }
        <span class="notas__espaco"></span>
        <span class="notas__mes">{{ store.resumo()?.competenciaPorExtenso }}</span>
        <ui-button variant="outline" [loading]="exportando()" (click)="exportar()">
          Exportar
        </ui-button>
      </section>

      @switch (store.estado()) {
        @case ('carregando') {
          <div class="notas__kpis" aria-busy="true">
            @for (i of [1, 2, 3, 4]; track i) {
              <ui-skeleton height="96px" />
            }
          </div>
          <ui-skeleton height="360px" />
        }
        @case ('erro') {
          <ui-error-state
            heading="Não foi possível carregar as notas fiscais"
            description="Verifique a conexão e tente de novo."
            (retry)="store.carregar()"
          />
        }
        @default {
          <div class="notas__kpis">
            @for (kpi of kpis(); track kpi.label) {
              <ui-kpi [label]="kpi.label" [value]="kpi.valor" [legend]="kpi.legenda" />
            }
          </div>

          <div class="fin-grade">
            <section
              class="fin-cartao notas__lista fin-grade__principal"
              aria-labelledby="notas-do-mes"
            >
              <div class="fin-cartao__topo">
                <div>
                  <h2 id="notas-do-mes">Notas do mês</h2>
                  <p class="fin-cartao__sub">NFS-e para mensalidades e NFC-e para a Loja</p>
                </div>
              </div>
              @if (store.notas().length === 0) {
                <ui-empty-state
                  heading="Nenhuma nota neste mês"
                  description="As notas saem sozinhas quando os pagamentos são confirmados."
                />
              } @else {
                <div class="notas__rolagem">
                  <div class="notas__tabela" role="table" aria-label="Notas do mês">
                    <div class="notas__linha notas__linha--cabecalho" role="row">
                      <span role="columnheader">Nota</span>
                      <span role="columnheader">Cliente</span>
                      <span role="columnheader">Descrição</span>
                      <span role="columnheader">Valor</span>
                      <span role="columnheader">Situação</span>
                      <span role="columnheader"><span class="ui-sr-only">Ação</span></span>
                    </div>
                    @for (nota of linhas(); track nota.id) {
                      <div class="notas__linha" role="row">
                        <span role="cell"
                          ><b>{{ nota.rotulo ?? '—' }}</b></span
                        >
                        <span role="cell">{{ nota.cliente }}</span>
                        <span role="cell">
                          {{ nota.descricao }}
                          <div class="notas__detalhe">
                            {{ nota.tipoExibido }} · {{ nota.dataCurta }}
                          </div>
                        </span>
                        <span role="cell">{{ nota.valorCentavos | brl }}</span>
                        <span role="cell">
                          <ui-badge [variant]="situacoes[nota.situacao].variante">
                            {{ situacoes[nota.situacao].rotulo }}
                          </ui-badge>
                        </span>
                        <span role="cell">
                          @switch (nota.acao) {
                            @case ('emitir') {
                              <ui-button
                                variant="outline"
                                size="sm"
                                [loading]="emAndamento() === nota.id"
                                (click)="emitir(nota)"
                                >Emitir</ui-button
                              >
                            }
                            @case ('corrigir') {
                              <ui-button variant="outline" size="sm" (click)="abrir(nota)"
                                >Corrigir</ui-button
                              >
                            }
                            @default {
                              <ui-button variant="outline" size="sm" (click)="abrir(nota)"
                                >Ver</ui-button
                              >
                            }
                          }
                        </span>
                      </div>
                    }
                  </div>
                </div>
                @if (store.proximoCursor()) {
                  <div class="notas__mais">
                    <ui-button
                      variant="outline"
                      [block]="true"
                      [loading]="store.carregandoMais()"
                      (click)="store.carregarMais()"
                      >Carregar mais</ui-button
                    >
                  </div>
                }
              }
            </section>

            <div class="fin-grade__lateral">
              <section class="fin-cartao" aria-labelledby="resumo-por-tipo">
                <div class="fin-cartao__topo">
                  <div>
                    <h2 id="resumo-por-tipo">Resumo por tipo</h2>
                    <p class="fin-cartao__sub">Notas emitidas em {{ mesMinusculo() }}</p>
                  </div>
                </div>
                @for (barra of barras(); track barra.rotulo) {
                  <div class="notas__barra">
                    <span>{{ barra.rotulo }}</span>
                    <div class="notas__trilho" aria-hidden="true">
                      <div class="notas__preenchido" [style.width]="barra.largura"></div>
                    </div>
                    <b>{{ barra.valor }}</b>
                  </div>
                }
                <div class="notas__explica">
                  Mensalidades e planos saem como NFS-e. Vendas da Loja saem como NFC-e.
                </div>
              </section>

              <section class="fin-cartao" aria-labelledby="precisa-de-atencao">
                <div class="fin-cartao__topo">
                  <div>
                    <h2 id="precisa-de-atencao">Precisa de atenção</h2>
                    <p class="fin-cartao__sub">Corrija e reenvie</p>
                  </div>
                </div>
                @if (store.atencao().length === 0) {
                  <p class="fin-cartao__sub">Nenhuma nota pendente ou rejeitada.</p>
                } @else {
                  <ul class="notas__atencao">
                    @for (nota of store.atencao(); track nota.id) {
                      <li>
                        <button type="button" (click)="abrir(nota)">
                          {{ nota.cliente }}
                          <div class="notas__detalhe">{{ nota.atencao }}</div>
                        </button>
                        <ui-badge [variant]="situacoes[nota.situacao].variante">
                          {{ situacoes[nota.situacao].rotulo }}
                        </ui-badge>
                      </li>
                    }
                  </ul>
                }
              </section>
            </div>
          </div>
        }
      }
    }

    <ui-modal variant="drawer" [heading]="tituloDoDrawer()" [(open)]="drawerAberto">
      @if (selecionada(); as nota) {
        <app-detalhe-da-nota
          [nota]="nota"
          [ocupado]="emAndamento() === nota.id"
          (corrigir)="corrigir(nota, $event)"
          (cancelar)="cancelar(nota, $event)"
          (reenviar)="emitir(nota)"
          (enviar)="enviarAoAluno(nota)"
          (abrirArquivo)="abrirArquivo(nota, $event)"
        />
      } @else {
        <ui-skeleton height="320px" />
      }
    </ui-modal>
  `,
})
export class NotasFiscaisPage {
  protected readonly store = inject(NotasFiscaisStore);
  private readonly toast = inject(ToastService);
  private readonly documento = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  protected readonly podeVer = inject(PERMISSION_CHECKER).pode('financeiro:ver');
  protected readonly visoes = VISOES_DO_FINANCEIRO;
  protected readonly periodos = PERIODOS;
  protected readonly situacoes = SITUACAO_DA_NOTA;

  protected readonly exportando = signal(false);
  protected readonly emAndamento = signal<string | null>(null);
  protected readonly drawerAberto = signal(false);
  protected readonly selecionada = signal<NotaFiscalDetalhe | null>(null);

  protected readonly mesMinusculo = computed(
    () => this.store.resumo()?.competenciaPorExtenso.split(' ')[0]?.toLowerCase() ?? 'o mês',
  );
  protected readonly kpis = computed(() => {
    const resumo = this.store.resumo();
    return [
      {
        label: 'Notas emitidas',
        valor: String(resumo?.emitidas ?? 0),
        legenda: `Em ${this.mesMinusculo()}`,
      },
      {
        label: 'Valor faturado',
        valor: reaisInteiros(resumo?.valorFaturadoCentavos ?? 0),
        legenda: 'Com nota no mês',
      },
      { label: 'Pendentes', valor: String(resumo?.pendentes ?? 0), legenda: 'Aguardando emissão' },
      {
        label: 'Rejeitadas',
        valor: String(resumo?.rejeitadas ?? 0),
        legenda: 'Precisam de correção',
      },
    ];
  });
  /** Linhas de "Notas do mês" com a data curta ("10/11") de FinNotas.html. */
  protected readonly linhas = computed(() =>
    this.store
      .notas()
      .map((nota) => ({ ...nota, dataCurta: formatarDataBr(nota.data).slice(0, 5) })),
  );
  protected readonly barras = computed(() => {
    const porTipo = this.store.resumo()?.emitidasPorTipo ?? { nfse: 0, nfce: 0 };
    const maior = this.store.maiorPorTipo();
    return [
      { rotulo: 'NFS-e', valor: porTipo.nfse, largura: larguraDaBarra(porTipo.nfse, maior) },
      { rotulo: 'NFC-e', valor: porTipo.nfce, largura: larguraDaBarra(porTipo.nfce, maior) },
    ];
  });
  protected readonly tituloDoDrawer = computed(() =>
    this.selecionada()?.situacao === 'rejeitada' ? 'Corrigir nota' : 'Nota fiscal',
  );

  constructor() {
    if (this.podeVer) {
      this.store.carregar();
    }
  }

  protected irParaEmitir(): void {
    void this.router.navigate(['emitir'], { relativeTo: this.rota });
  }

  protected abrir(nota: NotaFiscal): void {
    this.selecionada.set(null);
    this.drawerAberto.set(true);
    this.store.detalhe(nota.id).subscribe({
      next: (detalhe) => this.selecionada.set(detalhe),
      error: () => {
        this.drawerAberto.set(false);
        this.toast.show({ message: FALHA, tone: 'error' });
      },
    });
  }

  protected emitir(nota: NotaFiscal): void {
    this.executar(nota, this.store.reenviar(nota.id), (resultado) =>
      resultado.situacao === 'emitida'
        ? `Nota ${resultado.rotulo ?? ''} emitida.`
        : resultado.situacao === 'rejeitada'
          ? `O emissor recusou a nota: ${resultado.atencao}`
          : 'Nota enviada ao emissor; a resposta chega em instantes.',
    );
  }

  protected corrigir(nota: NotaFiscal, correcao: CorrecaoPedida): void {
    this.executar(nota, this.store.corrigir(nota.id, correcao), (resultado) =>
      resultado.situacao === 'emitida'
        ? `Nota ${resultado.rotulo ?? ''} emitida.`
        : `O emissor recusou a nota: ${resultado.atencao}`,
    );
  }

  protected cancelar(nota: NotaFiscal, motivo: string): void {
    this.executar(nota, this.store.cancelar(nota.id, motivo), () => 'Nota cancelada.');
  }

  protected enviarAoAluno(nota: NotaFiscal): void {
    this.emAndamento.set(nota.id);
    this.store.enviarAoAluno(nota.id).subscribe({
      next: ({ enviadaPor }) => {
        this.emAndamento.set(null);
        this.toast.show({
          message:
            enviadaPor.length > 0
              ? `Nota enviada por ${enviadaPor.map((c) => (c === 'email' ? 'e-mail' : 'WhatsApp')).join(' e ')}.`
              : 'O aluno não tem e-mail nem WhatsApp para receber a nota.',
          tone: enviadaPor.length > 0 ? 'success' : 'info',
        });
      },
      error: () => this.falhou(),
    });
  }

  protected abrirArquivo(nota: NotaFiscal, arquivo: 'pdf' | 'xml'): void {
    this.store.arquivo(nota.id, arquivo).subscribe({
      next: ({ url }) => this.documento.defaultView?.open(url, '_blank', 'noopener'),
      error: () => this.toast.show({ message: FALHA, tone: 'error' }),
    });
  }

  protected exportar(): void {
    this.exportando.set(true);
    this.store.exportar().subscribe({
      next: (zip) => {
        this.exportando.set(false);
        const competencia = this.store.resumo()?.competencia ?? 'mes';
        baixarArquivo(zip, `notas-fiscais-${competencia}.zip`, this.documento);
      },
      error: () => {
        this.exportando.set(false);
        this.toast.show({ message: FALHA, tone: 'error' });
      },
    });
  }

  private executar(
    nota: NotaFiscal,
    acao: ReturnType<NotasFiscaisStore['reenviar']>,
    mensagem: (resultado: NotaFiscalDetalhe) => string,
  ): void {
    this.emAndamento.set(nota.id);
    acao.subscribe({
      next: (resultado) => {
        this.emAndamento.set(null);
        if (this.selecionada()?.id === resultado.id) {
          this.selecionada.set(resultado);
        }
        this.toast.show({
          message: mensagem(resultado),
          tone: resultado.situacao === 'rejeitada' ? 'error' : 'success',
        });
      },
      error: () => this.falhou(),
    });
  }

  private falhou(): void {
    this.emAndamento.set(null);
    this.toast.show({ message: FALHA, tone: 'error' });
  }
}
