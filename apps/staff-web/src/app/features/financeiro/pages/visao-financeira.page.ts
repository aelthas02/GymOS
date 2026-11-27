import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PERMISSION_CHECKER } from '@gymos/shared-forms';
import {
  Avatar,
  Badge,
  type BadgeVariant,
  Button,
  EmptyState,
  ErrorState,
  HorizontalBars,
  Modal,
  NoPermissionState,
  Skeleton,
  ToastService,
} from '@gymos/ui';
import { CabecalhoDoFinanceiro } from '../components/cabecalho-do-financeiro';
import { ChipsDePeriodo } from '../components/chips-de-periodo';
import { ESTILOS_DO_FINANCEIRO } from '../components/estilos-do-financeiro';
import { VisaoFinanceiraStore } from '../data-access/visao-financeira.store';
import type { ChaveDaVisao, ChaveDePeriodo, ColunaDaTabela } from '../models/financeiro';
import {
  baixarArquivo,
  consultaDosFiltros,
  paraCsv,
  paraXlsx,
  PERIODOS_DO_FINANCEIRO,
  reaisInteiros,
  tabelaDaVisao,
  textoDaCelula,
  valorDoIndicador,
} from '../utils/financeiro';

const FALHA = 'Não foi possível concluir agora. Tente de novo em instantes.';

const SITUACAO: Readonly<Record<'em_dia' | 'a_vencer' | 'em_atraso', BadgeVariant>> = {
  em_dia: 'ok',
  a_vencer: 'soon',
  em_atraso: 'late',
};

/** Visões que listam pessoas: a primeira coluna leva o avatar com as iniciais. */
const COM_AVATAR: readonly ChaveDaVisao[] = ['funcionarios', 'alunos'];

/**
 * Financeiro › visões do "Visualizar por": Setores, Funcionários, Alunos, Aulas, Planos e Forma de
 * pagamento (`FinSetores.html`, `FinFuncionarios.html`, `FinAlunos.html`, `FinAulas.html`; Planos e
 * Forma de pagamento seguem o layout de `FinAlunos.html`). A visão vem dos dados da rota.
 */
@Component({
  selector: 'app-visao-financeira-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [VisaoFinanceiraStore],
  imports: [
    CabecalhoDoFinanceiro,
    ChipsDePeriodo,
    Badge,
    Avatar,
    Button,
    Modal,
    HorizontalBars,
    Skeleton,
    EmptyState,
    ErrorState,
    NoPermissionState,
  ],
  styles: `
    ${ESTILOS_DO_FINANCEIRO}
    .visao__periodo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      padding: 14px 18px;
    }
    .visao__rotulo {
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
    }
    .visao__espaco {
      flex: 1;
    }
    .visao__escopo {
      font-size: 13px;
      color: var(--muted);
    }
    .visao__kpis {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
    }
    .visao__kpis > * {
      flex: 1 1 200px;
      min-width: 0;
    }
    .visao__kpi {
      box-sizing: border-box;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
    }
    .visao__kpi-rotulo {
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
      color: var(--muted);
    }
    .visao__kpi-valor {
      margin-top: 2px;
      font-size: 28px;
      font-weight: var(--font-weight-bold);
    }
    .visao__kpi--positivo .visao__kpi-valor {
      color: var(--badge-ok-fg);
    }
    .visao__kpi-legenda {
      margin-top: 2px;
      font-size: 12px;
      color: var(--muted);
    }
    .visao__tabela-cartao {
      flex: 1.6 1 520px;
      padding: 0;
      overflow: hidden;
    }
    .visao__tabela-cartao .fin-cartao__topo {
      padding: 18px 20px 8px;
      margin: 0;
    }
    .visao__grafico {
      flex: 1 1 380px;
      align-self: flex-start;
    }
    .visao__rolagem {
      overflow-x: auto;
    }
    .visao__tabela {
      min-width: 640px;
    }
    .visao__linha {
      display: grid;
      gap: 10px;
      align-items: center;
      padding: 12px 16px;
      border-top: 1px solid var(--divider);
      font-size: 14px;
    }
    .visao__linha--cabecalho {
      padding: 10px 16px;
      border-top: 0;
      color: var(--muted);
      font-size: 12px;
      font-weight: var(--font-weight-semibold);
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .visao__pessoa {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .visao__mais {
      padding: 12px 16px 16px;
      border-top: 1px solid var(--divider);
    }
    .visao__opcoes {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
  `,
  template: `
    <app-cabecalho-do-financeiro
      [subtitulo]="subtitulo"
      (ajuda)="ajuda()"
      (relatorio)="verRelatorio()"
    />

    @if (!podeVer) {
      <ui-no-permission-state />
    } @else {
      <section class="fin-cartao visao__periodo" aria-label="Período">
        <span class="visao__rotulo">Período</span>
        <app-chips-de-periodo
          [periodos]="periodos"
          [ativo]="store.filtros().periodo"
          (escolher)="escolherPeriodo($event)"
        />
        <span class="visao__espaco"></span>
        <span class="visao__escopo">{{ escopo() }}</span>
        <ui-button
          variant="outline"
          [disabled]="!podeExportar()"
          (click)="exportarAberto.set(true)"
        >
          Exportar
        </ui-button>
      </section>

      @switch (store.estado()) {
        @case ('carregando') {
          <div class="visao__kpis" aria-busy="true">
            @for (i of [1, 2, 3, 4]; track i) {
              <ui-skeleton height="96px" />
            }
          </div>
          <ui-skeleton height="320px" />
        }
        @case ('erro') {
          <ui-error-state
            heading="Não foi possível carregar o financeiro"
            description="Verifique a conexão e tente de novo."
            (retry)="recarregar()"
          />
        }
        @default {
          @if (store.visao(); as visao) {
            <div class="visao__kpis">
              @for (indicador of visao.indicadores; track indicador.rotulo) {
                <section class="visao__kpi" [class.visao__kpi--positivo]="indicador.positivo">
                  <div class="visao__kpi-rotulo">{{ indicador.rotulo }}</div>
                  <div class="visao__kpi-valor">{{ valorDe(indicador) }}</div>
                  <div class="visao__kpi-legenda">{{ indicador.legenda }}</div>
                </section>
              }
            </div>

            <div class="fin-grade">
              <section class="fin-cartao visao__grafico" [attr.aria-labelledby]="'visao-grafico'">
                <div class="fin-cartao__topo">
                  <div>
                    <h2 id="visao-grafico">{{ visao.grafico.titulo }}</h2>
                    <p class="fin-cartao__sub">{{ visao.grafico.subtitulo }}</p>
                  </div>
                </div>
                <ui-horizontal-bars
                  [largura]="380"
                  [dados]="barras()"
                  [formatar]="formatarReais"
                  [resumo]="visao.grafico.titulo"
                  colunaRotulo="Item"
                  colunaValor="Receita"
                  mensagemVazia="Nada para mostrar neste período"
                />
              </section>

              <section class="fin-cartao visao__tabela-cartao" aria-labelledby="visao-tabela">
                <div class="fin-cartao__topo">
                  <div>
                    <h2 id="visao-tabela">{{ visao.tabela.titulo }}</h2>
                    <p class="fin-cartao__sub">{{ visao.tabela.subtitulo }}</p>
                  </div>
                </div>
                @if (visao.tabela.linhas.length === 0) {
                  <ui-empty-state
                    heading="Nada para mostrar neste período"
                    [description]="vazio()"
                  />
                } @else {
                  <div class="visao__rolagem">
                    <div class="visao__tabela" role="table" [attr.aria-label]="visao.tabela.titulo">
                      <div
                        class="visao__linha visao__linha--cabecalho"
                        role="row"
                        [style.grid-template-columns]="grade()"
                      >
                        @for (coluna of visao.tabela.colunas; track coluna.chave) {
                          <span role="columnheader">{{ coluna.rotulo }}</span>
                        }
                        @if (temLink()) {
                          <span role="columnheader"><span class="ui-sr-only">Ação</span></span>
                        }
                      </div>
                      @for (linha of visao.tabela.linhas; track linha.id) {
                        <div
                          class="visao__linha"
                          role="row"
                          [style.grid-template-columns]="grade()"
                        >
                          @for (
                            coluna of visao.tabela.colunas;
                            track coluna.chave;
                            let primeira = $first
                          ) {
                            <span role="cell">
                              @if (primeira && comAvatar()) {
                                <span class="visao__pessoa">
                                  <ui-avatar [name]="texto(coluna, linha)" [size]="32" />
                                  <b>{{ texto(coluna, linha) }}</b>
                                </span>
                              } @else if (
                                primeira || (coluna.tipo === 'brl' && coluna.chave === 'resultado')
                              ) {
                                <b>{{ texto(coluna, linha) }}</b>
                              } @else if (coluna.tipo === 'situacao' && linha.situacao) {
                                <ui-badge [variant]="situacoes[linha.situacao]">{{
                                  texto(coluna, linha)
                                }}</ui-badge>
                              } @else {
                                {{ texto(coluna, linha) }}
                              }
                            </span>
                          }
                          @if (temLink()) {
                            <span role="cell">
                              @if (linha.link) {
                                <ui-button variant="outline" size="sm" (click)="ir(linha.link)"
                                  >Ver</ui-button
                                >
                              }
                            </span>
                          }
                        </div>
                      }
                    </div>
                  </div>
                  @if (visao.tabela.proximoCursor) {
                    <div class="visao__mais">
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
            </div>
          }
        }
      }
    }

    <ui-modal heading="Exportar" [(open)]="exportarAberto">
      <div class="visao__opcoes">
        <ui-button [loading]="exportando()" (click)="exportar('csv')">Baixar CSV</ui-button>
        <ui-button variant="outline" [loading]="exportando()" (click)="exportar('xlsx')"
          >Baixar Excel (.xlsx)</ui-button
        >
      </div>
    </ui-modal>
  `,
})
export class VisaoFinanceiraPage {
  protected readonly store = inject(VisaoFinanceiraStore);
  private readonly rota = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly documento = inject(DOCUMENT);

  private readonly dados = this.rota.snapshot.data as {
    visao: ChaveDaVisao;
    subtitulo: string;
  };
  protected readonly subtitulo = this.dados.subtitulo;
  protected readonly podeVer = inject(PERMISSION_CHECKER).pode('financeiro:ver');
  protected readonly periodos = PERIODOS_DO_FINANCEIRO.filter(
    (periodo) => periodo.chave !== 'personalizado',
  );
  protected readonly situacoes = SITUACAO;
  protected readonly exportarAberto = signal(false);
  protected readonly exportando = signal(false);

  protected readonly formatarReais = (valor: number): string => reaisInteiros(valor);
  protected readonly comAvatar = computed(() => COM_AVATAR.includes(this.dados.visao));
  protected readonly escopo = computed(() => {
    const periodo = this.store.visao()?.periodo;
    return periodo ? `${periodo.rotulo} · ${periodo.escopo}` : '';
  });
  protected readonly barras = computed(() =>
    (this.store.visao()?.grafico.barras ?? []).map((barra) => ({
      rotulo: barra.rotulo,
      valor: barra.valorCentavos,
    })),
  );
  protected readonly temLink = computed(() =>
    (this.store.visao()?.tabela.linhas ?? []).some((linha) => linha.link),
  );
  protected readonly podeExportar = computed(
    () => this.store.estado() === 'pronto' && (this.store.visao()?.tabela.linhas.length ?? 0) > 0,
  );
  protected readonly vazio = computed(() =>
    ['aulas', 'funcionarios'].includes(this.dados.visao)
      ? 'As aulas e as presenças aparecem aqui quando o módulo Aulas registrar atendimentos.'
      : 'Os números aparecem aqui quando houver pagamentos no período.',
  );
  /** Colunas da tabela: a primeira mais larga, o peso estreito e, se houver, a ação "Ver". */
  protected readonly grade = computed(() => {
    const colunas = this.store.visao()?.tabela.colunas ?? [];
    const partes = colunas.map((coluna, indice) =>
      indice === 0
        ? '1.4fr'
        : coluna.tipo === 'percentual' && coluna.chave === 'peso'
          ? '80px'
          : '1fr',
    );
    return (this.temLink() ? [...partes, '60px'] : partes).join(' ');
  });

  constructor() {
    if (this.podeVer) {
      this.store.carregar(this.dados.visao);
    }
  }

  protected valorDe = valorDoIndicador;

  protected texto(coluna: ColunaDaTabela, linha: Parameters<typeof textoDaCelula>[1]): string {
    return textoDaCelula(coluna, linha);
  }

  protected recarregar(): void {
    this.store.carregar(this.dados.visao);
  }

  protected escolherPeriodo(periodo: ChaveDePeriodo): void {
    this.store.escolherPeriodo(periodo);
  }

  protected ir(link: string): void {
    void this.router.navigateByUrl(link);
  }

  protected ajuda(): void {
    this.toast.show({
      message: 'O tutorial desta tela está na visão Geral.',
      tone: 'info',
    });
  }

  protected verRelatorio(): void {
    void this.router.navigate(['/relatorios'], {
      queryParams: {
        origem: 'financeiro',
        visao: this.dados.visao,
        ...consultaDosFiltros(this.store.filtros()),
      },
    });
  }

  protected async exportar(formato: 'csv' | 'xlsx'): Promise<void> {
    const visao = this.store.visao();
    if (!visao) {
      return;
    }
    this.exportando.set(true);
    try {
      const tabela = tabelaDaVisao(visao.tabela.titulo, visao.tabela.colunas, visao.tabela.linhas);
      const arquivo = `financeiro-${this.dados.visao}-${visao.periodo.de}-a-${visao.periodo.ate}`;
      const conteudo = formato === 'csv' ? paraCsv(tabela) : await paraXlsx(tabela);
      baixarArquivo(conteudo, `${arquivo}.${formato}`, this.documento);
      this.exportarAberto.set(false);
    } catch {
      this.toast.show({ message: FALHA, tone: 'error' });
    } finally {
      this.exportando.set(false);
    }
  }
}
