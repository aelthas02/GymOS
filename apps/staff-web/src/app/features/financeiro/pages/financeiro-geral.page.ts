import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { PERMISSION_CHECKER, Permission } from '@gymos/shared-forms';
import {
  AreaChart,
  BarChart,
  Button,
  Checkbox,
  Donut,
  ErrorState,
  Field,
  Kpi,
  NoPermissionState,
  Select,
  type SelectOption,
  Skeleton,
  Sparkline,
  ToastService,
  TutorialOverlay,
} from '@gymos/ui';
import { CabecalhoDoFinanceiro } from '../components/cabecalho-do-financeiro';
import { ChipsDePeriodo } from '../components/chips-de-periodo';
import { ESTILOS_DO_FINANCEIRO } from '../components/estilos-do-financeiro';
import { NovoLancamentoModal } from '../components/novo-lancamento';
import { FinanceiroGeralStore } from '../data-access/financeiro-geral.store';
import type { NovoLancamento } from '../models/financeiro';
import {
  comparacaoDaReceita,
  consultaDosFiltros,
  numeroDeReais,
  percentual,
  reaisInteiros,
  TUTORIAL_FINANCEIRO,
} from '../utils/financeiro';

const TIPOS: readonly SelectOption[] = [
  { value: 'todos', label: 'Receitas e despesas' },
  { value: 'receitas', label: 'Somente receitas' },
  { value: 'despesas', label: 'Somente despesas' },
];

const TODOS = (rotulo: string): SelectOption => ({ value: '', label: rotulo });

/** Financeiro › Geral (`Financeiro.html`): receita líquida, indicadores, gráficos e filtros. */
@Component({
  selector: 'app-financeiro-geral-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [FinanceiroGeralStore],
  imports: [
    CabecalhoDoFinanceiro,
    ChipsDePeriodo,
    NovoLancamentoModal,
    Permission,
    Kpi,
    Sparkline,
    AreaChart,
    BarChart,
    Donut,
    Button,
    Checkbox,
    Field,
    Select,
    Skeleton,
    ErrorState,
    NoPermissionState,
    TutorialOverlay,
  ],
  styles: `
    ${ESTILOS_DO_FINANCEIRO}
    .geral__filtros {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px;
    }
    .geral__periodo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .geral__rotulo {
      margin-right: 6px;
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
    }
    .geral__campos {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .geral__campos > ui-field {
      flex: 1 1 150px;
      min-width: 0;
    }
    .geral__campos ui-select {
      display: block;
      width: 100%;
      min-width: 0;
    }
    .geral__datas {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .geral__data {
      height: 42px;
      padding: 0 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-regular) 14px var(--font);
    }
    .geral__acoes {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .geral__botoes {
      display: flex;
      gap: 8px;
    }
    .geral__topo {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      align-items: stretch;
    }
    .geral__hero {
      flex: 2 1 520px;
      min-width: 0;
      box-sizing: border-box;
      padding: 22px;
      border-radius: var(--radius-card);
      background: var(--ink);
      color: var(--on-ink);
    }
    .geral__hero-topo {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .geral__hero-rotulo {
      font-size: 13px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--nav-muted);
    }
    .geral__hero-valor {
      margin-top: 6px;
      font-size: 48px;
      font-weight: var(--font-weight-bold);
      line-height: 1.1;
      color: var(--accent);
    }
    .geral__hero-comparacao {
      margin-top: 4px;
      font-size: 14px;
      opacity: 0.85;
    }
    .geral__hero-mes {
      padding: 4px 12px;
      border-radius: var(--radius-pill);
      background: var(--nav-card-bg);
      font-size: 12px;
      font-weight: var(--font-weight-semibold);
      white-space: nowrap;
    }
    .geral__hero-grafico {
      margin-top: 14px;
    }
    .geral__indicadores {
      flex: 3 1 480px;
      min-width: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 14px;
    }
    .geral__sparkline {
      position: relative;
      overflow: hidden;
      margin-top: 6px;
      min-height: 36px;
    }
    .geral__graficos {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      align-items: stretch;
    }
    .geral__graficos > .fin-cartao {
      flex: 1 1 320px;
    }
    .geral__donut {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .geral__falha {
      margin: 0;
      font-size: 13px;
      color: var(--badge-late-fg);
    }
  `,
  template: `
    <app-cabecalho-do-financeiro
      data-tutorial="cabecalho"
      subtitulo="Visão geral das finanças da academia."
      (ajuda)="tutorialAberto.set(true)"
      (relatorio)="verRelatorio()"
    >
      <ui-button
        *appPermission="'financeiro:criar'"
        acoes
        variant="outline"
        (click)="novoAberto.set(true)"
      >
        Novo lançamento
      </ui-button>
    </app-cabecalho-do-financeiro>

    @if (!podeVer) {
      <ui-no-permission-state />
    } @else {
      <section class="fin-cartao geral__filtros" aria-label="Filtros" data-tutorial="filtros">
        <div class="geral__periodo">
          <span class="geral__rotulo">Período</span>
          <app-chips-de-periodo
            [ativo]="store.rascunho().periodo"
            (escolher)="store.escolherPeriodo($event)"
          />
        </div>
        @if (store.rascunho().periodo === 'personalizado') {
          <div class="geral__datas">
            <ui-field label="De">
              <input
                type="date"
                class="geral__data"
                [value]="store.rascunho().de"
                (input)="store.alterar({ de: valorDe($event) })"
              />
            </ui-field>
            <ui-field label="Até">
              <input
                type="date"
                class="geral__data"
                [value]="store.rascunho().ate"
                (input)="store.alterar({ ate: valorDe($event) })"
              />
            </ui-field>
          </div>
        }
        <div class="geral__campos">
          <ui-field label="Unidade">
            <ui-select
              [options]="unidades()"
              [value]="store.rascunho().unidadeId"
              (valueChange)="store.alterar({ unidadeId: $event })"
            />
          </ui-field>
          <ui-field label="Plano">
            <ui-select
              [options]="planos()"
              [value]="store.rascunho().planoId"
              (valueChange)="store.alterar({ planoId: $event })"
            />
          </ui-field>
          <ui-field label="Modalidade">
            <ui-select
              [options]="modalidades()"
              [value]="store.rascunho().modalidade"
              (valueChange)="store.alterar({ modalidade: $event })"
            />
          </ui-field>
          <ui-field label="Forma de pagamento">
            <ui-select
              [options]="formas()"
              [value]="store.rascunho().forma"
              (valueChange)="store.alterar({ forma: $event })"
            />
          </ui-field>
          <ui-field label="Tipo de lançamento">
            <ui-select
              [options]="tipos"
              [value]="store.rascunho().tipo"
              (valueChange)="store.alterar({ tipo: tipoDe($event) })"
            />
          </ui-field>
          <ui-field label="Categoria">
            <ui-select
              [options]="categorias()"
              [value]="store.rascunho().categoria"
              (valueChange)="store.alterar({ categoria: $event })"
            />
          </ui-field>
        </div>
        <div class="geral__acoes">
          <ui-checkbox
            [checked]="store.rascunho().comparar"
            (checkedChange)="store.alterar({ comparar: $event })"
            >Comparar com o período anterior</ui-checkbox
          >
          <div class="geral__botoes">
            <ui-button variant="outline" (click)="store.limpar()">Limpar</ui-button>
            <ui-button
              variant="accent"
              [disabled]="!store.periodoPersonalizadoValido()"
              (click)="store.aplicar()"
              >Aplicar filtros</ui-button
            >
          </div>
        </div>
      </section>

      @switch (store.estado()) {
        @case ('carregando') {
          <ui-skeleton height="260px" />
          <ui-skeleton height="220px" />
        }
        @case ('erro') {
          <ui-error-state
            heading="Não foi possível carregar o financeiro"
            description="Verifique a conexão e tente de novo."
            (retry)="store.carregar()"
          />
        }
        @default {
          @if (store.geral(); as geral) {
            <div class="geral__topo">
              <section class="geral__hero" data-tutorial="receita-liquida">
                <div class="geral__hero-topo">
                  <div>
                    <div class="geral__hero-rotulo">Receita líquida global</div>
                    <div class="geral__hero-valor">{{ liquida() }}</div>
                    @if (comparacao(); as texto) {
                      <div class="geral__hero-comparacao">{{ texto }}</div>
                    }
                  </div>
                  <span class="geral__hero-mes">{{ geral.periodo.rotulo }}</span>
                </div>
                <div class="geral__hero-grafico">
                  <ui-area-chart
                    [largura]="880"
                    [dados]="serieLiquida()"
                    [formatar]="formatarReais"
                    [baseZero]="false"
                    resumo="Receita líquida dos últimos 6 meses"
                    colunaRotulo="Mês"
                    colunaValor="Receita líquida"
                  />
                </div>
              </section>

              <div class="geral__indicadores" data-tutorial="indicadores">
                @for (indicador of indicadores(); track indicador.rotulo) {
                  <ui-kpi
                    [label]="indicador.rotulo"
                    [value]="indicador.valor"
                    [legend]="indicador.legenda"
                  >
                    <div class="geral__sparkline" [style.--accent]="indicador.cor">
                      @if (indicador.serie.length > 1) {
                        <ui-sparkline
                          [valores]="indicador.serie"
                          [rotulos]="rotulosDaSerie()"
                          [resumo]="'Evolução de ' + indicador.rotulo.toLowerCase()"
                        />
                      }
                    </div>
                  </ui-kpi>
                }
              </div>
            </div>

            <div class="geral__graficos" data-tutorial="graficos">
              <section class="fin-cartao" aria-labelledby="por-forma">
                <div class="fin-cartao__topo">
                  <div><h2 id="por-forma">Receita por forma de pagamento</h2></div>
                </div>
                <ui-donut
                  [dados]="formasDePagamento()"
                  [formatar]="formatarPercentual"
                  resumo="Receita por forma de pagamento"
                  colunaRotulo="Forma"
                  colunaValor="Parte"
                />
              </section>

              <section class="fin-cartao" aria-labelledby="por-categoria">
                <div class="fin-cartao__topo">
                  <div>
                    <h2 id="por-categoria">Despesas por categoria</h2>
                    <p class="fin-cartao__sub">Total {{ despesas() }}</p>
                  </div>
                </div>
                <ui-bar-chart
                  [largura]="400"
                  [dados]="despesasPorCategoria()"
                  [formatar]="formatarNumero"
                  resumo="Despesas por categoria, em reais"
                  colunaRotulo="Categoria"
                  colunaValor="Despesas (R$)"
                />
              </section>

              <section class="fin-cartao" aria-labelledby="liquida-por-mes">
                <div class="fin-cartao__topo">
                  <div>
                    <h2 id="liquida-por-mes">Receita líquida por mês</h2>
                    <p class="fin-cartao__sub">Últimos 6 meses</p>
                  </div>
                </div>
                <ui-bar-chart
                  [largura]="900"
                  [dados]="liquidaPorMes()"
                  [formatar]="formatarNumero"
                  resumo="Receita líquida por mês, em reais"
                  colunaRotulo="Mês"
                  colunaValor="Receita líquida (R$)"
                />
              </section>
            </div>
          }
        }
      }
    }

    <app-novo-lancamento
      [(aberto)]="novoAberto"
      [salvando]="salvandoLancamento()"
      [falha]="falhaDoLancamento()"
      (salvar)="registrar($event)"
    />
    <ui-tutorial-overlay [config]="tutorial" [(open)]="tutorialAberto" />
  `,
})
export class FinanceiroGeralPage {
  protected readonly store = inject(FinanceiroGeralStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly modal = viewChild(NovoLancamentoModal);

  protected readonly podeVer = inject(PERMISSION_CHECKER).pode('financeiro:ver');
  protected readonly tipos = TIPOS;
  protected readonly tutorial = TUTORIAL_FINANCEIRO;
  protected readonly tutorialAberto = signal(false);
  protected readonly novoAberto = signal(false);
  protected readonly salvandoLancamento = signal(false);
  protected readonly falhaDoLancamento = signal<string | null>(null);

  protected readonly formatarReais = (valor: number): string => reaisInteiros(valor);
  protected readonly formatarNumero = (valor: number): string => String(valor);
  protected readonly formatarPercentual = (valor: number): string => `${valor}%`;

  protected readonly unidades = computed<readonly SelectOption[]>(() => {
    const unidades = this.store.opcoes()?.unidades ?? [];
    const opcoes = unidades.map((u) => ({ value: u.id, label: u.nome }));
    return unidades.length > 1 ? [TODOS('Todas'), ...opcoes] : opcoes;
  });
  protected readonly planos = computed<readonly SelectOption[]>(() => [
    TODOS('Todos'),
    ...(this.store.opcoes()?.planos ?? []).map((p) => ({ value: p.id, label: p.nome })),
  ]);
  protected readonly modalidades = computed<readonly SelectOption[]>(() => [
    TODOS('Todas'),
    ...(this.store.opcoes()?.modalidades ?? []).map((m) => ({ value: m, label: m })),
  ]);
  protected readonly formas = computed<readonly SelectOption[]>(() => [
    TODOS('Todas'),
    ...(this.store.opcoes()?.formas ?? []).map((f) => ({ value: f.chave, label: f.rotulo })),
  ]);
  protected readonly categorias = computed<readonly SelectOption[]>(() => [
    TODOS('Todas'),
    ...(this.store.opcoes()?.categorias ?? []).map((c) => ({ value: c.chave, label: c.rotulo })),
  ]);

  protected readonly liquida = computed(() =>
    reaisInteiros(this.store.geral()?.receitaLiquida.centavos ?? 0),
  );
  protected readonly despesas = computed(() =>
    reaisInteiros(this.store.geral()?.despesasCentavos ?? 0),
  );
  protected readonly comparacao = computed(() => {
    const geral = this.store.geral();
    return geral
      ? comparacaoDaReceita(
          geral.receitaLiquida.variacaoPontosBase,
          geral.receitaLiquida.anteriorCentavos,
          geral.periodo.anterior.rotulo,
        )
      : null;
  });
  protected readonly rotulosDaSerie = computed(
    () => this.store.geral()?.serieMensal.map((ponto) => ponto.rotulo) ?? [],
  );
  protected readonly serieLiquida = computed(() =>
    (this.store.geral()?.serieMensal ?? []).map((ponto) => ({
      rotulo: ponto.rotulo,
      valor: ponto.liquidaCentavos,
    })),
  );
  protected readonly liquidaPorMes = computed(() =>
    (this.store.geral()?.serieMensal ?? []).map((ponto) => ({
      rotulo: ponto.rotulo,
      valor: numeroDeReais(ponto.liquidaCentavos),
    })),
  );
  protected readonly despesasPorCategoria = computed(() =>
    (this.store.geral()?.despesasPorCategoria ?? []).map((categoria) => ({
      rotulo: categoria.rotulo,
      valor: numeroDeReais(categoria.centavos),
    })),
  );
  protected readonly formasDePagamento = computed(() =>
    (this.store.geral()?.porForma ?? []).map((forma) => ({
      rotulo: this.rotuloDaForma(forma.forma),
      valor: forma.percentual,
    })),
  );

  /** Os seis KPIs, cada um com a série mensal que desenha o seu gráfico pequeno. */
  protected readonly indicadores = computed(() => {
    const geral = this.store.geral();
    if (!geral) {
      return [];
    }
    const serie = geral.serieMensal;
    const mes = geral.periodo.rotulo.split(' ')[0]?.toLowerCase() ?? '';
    return [
      {
        rotulo: 'Receita bruta',
        valor: reaisInteiros(geral.brutaCentavos),
        legenda: 'Antes de taxas e despesas',
        serie: serie.map((p) => p.brutaCentavos),
        cor: 'var(--chart-2)',
      },
      {
        rotulo: 'Taxas',
        valor: reaisInteiros(geral.taxasCentavos),
        legenda: 'Cartão, boleto e PIX',
        serie: serie.map((p) => p.taxasCentavos),
        cor: 'var(--chart-3)',
      },
      {
        rotulo: 'Despesas',
        valor: reaisInteiros(geral.despesasCentavos),
        legenda: 'Folha, aluguel e contas',
        serie: serie.map((p) => p.despesasCentavos),
        cor: 'var(--chart-negative)',
      },
      {
        rotulo: 'Adesões ativas',
        valor: String(geral.adesoesAtivas),
        legenda: `No mês de ${mes}`,
        serie: serie.map((p) => p.adesoesAtivas),
        cor: null as string | null,
      },
      {
        rotulo: 'Novas adesões',
        valor: String(geral.novasAdesoes),
        legenda: `${geral.cancelamentos} cancelamentos`,
        serie: serie.map((p) => p.novasAdesoes),
        cor: 'var(--chart-4)',
      },
      {
        rotulo: 'Inadimplência',
        valor: percentual(geral.inadimplencia.pontosBase),
        legenda: `${geral.inadimplencia.emAtraso} alunos em atraso`,
        // O histórico mensal da inadimplência não é guardado: sem série, sem gráfico pequeno.
        serie: [] as number[],
        cor: 'var(--chart-negative)',
      },
    ];
  });

  constructor() {
    if (this.podeVer) {
      this.store.carregar();
    }
  }

  private rotuloDaForma(chave: string): string {
    return this.store.opcoes()?.formas.find((forma) => forma.chave === chave)?.rotulo ?? chave;
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  protected tipoDe(valor: string): 'todos' | 'receitas' | 'despesas' {
    return valor === 'receitas' || valor === 'despesas' ? valor : 'todos';
  }

  protected verRelatorio(): void {
    const consulta = consultaDosFiltros(this.store.aplicados());
    void this.router.navigate(['/relatorios'], {
      queryParams: { origem: 'financeiro', ...consulta },
    });
  }

  protected registrar(lancamento: NovoLancamento): void {
    this.salvandoLancamento.set(true);
    this.falhaDoLancamento.set(null);
    this.store.registrarLancamento(lancamento).subscribe({
      next: () => {
        this.salvandoLancamento.set(false);
        this.novoAberto.set(false);
        this.modal()?.limpar();
        this.toast.show({ message: 'Lançamento registrado.', tone: 'success' });
        this.store.carregar();
      },
      error: (erro: unknown) => {
        this.salvandoLancamento.set(false);
        this.falhaDoLancamento.set(
          erro instanceof HttpErrorResponse && erro.status === 422
            ? (erro.error?.message ?? 'Confira os dados do lançamento.')
            : 'Não foi possível registrar agora. Tente de novo em instantes.',
        );
      },
    });
  }
}
