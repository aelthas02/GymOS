import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Permission } from '@gymos/shared-forms';
import { centavos, formatarBrl } from '@gymos/shared-money';
import {
  Avatar,
  Badge,
  type BadgeVariant,
  Button,
  type Crumb,
  EmptyState,
  ErrorState,
  Kpi,
  NoPermissionState,
  PageHeader,
  Skeleton,
} from '@gymos/ui';
import { AcompanhamentoStore } from '../data-access/acompanhamento.store';
import type { Contrato } from '../models/aluno';
import { dataDeIso, mesEAno } from '../utils/datas';

const ESTADO_DO_CONTRATO: Record<Contrato['estado'], string> = {
  ativo: 'Ativo',
  tolerancia: 'Em tolerância',
  encerrado: 'Encerrado',
  trancado: 'Trancado',
};

const FORMAS: Record<string, string> = {
  pix: 'PIX',
  cartao: 'Cartão',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  boleto: 'Boleto',
  dinheiro: 'Dinheiro',
};

const VARIANTE: Record<'em_dia' | 'a_vencer' | 'em_atraso', BadgeVariant> = {
  em_dia: 'ok',
  a_vencer: 'soon',
  em_atraso: 'late',
};

/** Acompanhamento do aluno (`/alunos/:id/acompanhamento`, `AlunosAcompanhamento.html`). */
@Component({
  selector: 'app-acompanhamento-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AcompanhamentoStore],
  imports: [
    PageHeader,
    Avatar,
    Badge,
    Button,
    Kpi,
    Skeleton,
    EmptyState,
    ErrorState,
    NoPermissionState,
    Permission,
    RouterLink,
    DatePipe,
  ],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 22px;
    }
    .acomp__cabeca {
      display: flex;
      flex-wrap: wrap;
      gap: 18px;
      align-items: center;
      justify-content: space-between;
      padding: 20px;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
    }
    .acomp__quem {
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .acomp__nome {
      font-size: 22px;
      font-weight: var(--font-weight-bold);
    }
    .acomp__detalhe {
      margin-top: 2px;
      font-size: 13px;
      color: var(--muted);
    }
    .acomp__selos {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
    .acomp__acoes {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .acomp__kpis {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
    }
    .acomp__kpis ui-kpi {
      flex: 1 1 200px;
      min-width: 0;
    }
    .acomp__blocos {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      align-items: flex-start;
    }
    .acomp__bloco {
      flex: 1 1 280px;
      min-width: 0;
      padding: 20px;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
      box-sizing: border-box;
    }
    .acomp__bloco--largo {
      flex-basis: 320px;
    }
    h2 {
      margin: 0 0 12px;
      font-size: 16px;
      font-weight: var(--font-weight-bold);
    }
    dl {
      margin: -6px 0 0;
    }
    .acomp__linha {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 0;
      border-top: 1px solid var(--divider);
      font-size: 14px;
    }
    dt {
      color: var(--muted);
    }
    dd {
      margin: 0;
      font-weight: var(--font-weight-bold);
      text-align: right;
    }
    .acomp__espera {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
  `,
  template: `
    @switch (store.estado()) {
      @case ('carregando') {
        <div class="acomp__espera" aria-busy="true">
          <ui-skeleton height="120px" />
          <ui-skeleton height="90px" />
          <ui-skeleton height="240px" />
        </div>
      }
      @case ('erro') {
        <ui-error-state
          heading="Não foi possível carregar o acompanhamento"
          description="Confira a conexão e tente de novo."
          (retry)="carregar()"
        />
      }
      @case ('sem-permissao') {
        <ui-no-permission-state />
      }
      @default {
        @if (store.aluno(); as aluno) {
          <ui-page-header
            heading="Acompanhamento do aluno"
            subtitle="Frequência, esforço, ficha e situação financeira em um só lugar."
            [breadcrumb]="migalhas()"
            [help]="false"
          />

          <section class="acomp__cabeca" aria-label="Aluno">
            <div class="acomp__quem">
              <ui-avatar [name]="aluno.nome" [size]="60" [decorative]="true" />
              <div>
                <div class="acomp__nome">{{ aluno.nome }}</div>
                @if (resumo()) {
                  <div class="acomp__detalhe">{{ resumo() }}</div>
                }
                <div class="acomp__selos">
                  @if (situacao(); as texto) {
                    <ui-badge [variant]="texto.variante">{{ texto.texto }}</ui-badge>
                  }
                  @if (aluno.meta) {
                    <ui-badge>Meta: {{ aluno.meta }}</ui-badge>
                  }
                </div>
              </div>
            </div>
            <div class="acomp__acoes">
              <ui-button size="lg" [routerLink]="['/alunos', aluno.id, 'ficha']">
                Ficha de treino
              </ui-button>
              <ui-button
                size="lg"
                variant="accent"
                [routerLink]="['/recepcao']"
                [queryParams]="{ aluno: aluno.id }"
              >
                WhatsApp
              </ui-button>
              <ui-button
                *appPermission="'alunos:editar'"
                size="lg"
                variant="outline"
                [routerLink]="['/alunos', aluno.id]"
              >
                Editar aluno
              </ui-button>
            </div>
          </section>

          <div class="acomp__kpis">
            <ui-kpi label="Frequência no mês" value="—" legend="Sem dados de frequência ainda" />
            <ui-kpi label="Sequência" value="—" legend="Sem dados de frequência ainda" />
            <ui-kpi label="Esforço médio" [value]="esforcoMedio()" [legend]="legendaDoEsforco()" />
            <ui-kpi
              label="Adimplência"
              [value]="situacao()?.texto ?? '—'"
              [legend]="proximaParcela()"
            />
          </div>

          <div class="acomp__blocos">
            <section class="acomp__bloco" aria-labelledby="acomp-freq">
              <h2 id="acomp-freq">Frequência por semana</h2>
              <ui-empty-state
                heading="Sem dados ainda"
                description="A frequência do aluno aparece aqui quando o acesso registrar entradas."
              />
            </section>
            <section class="acomp__bloco" aria-labelledby="acomp-carga">
              <h2 id="acomp-carga">Evolução de carga</h2>
              @if (store.treino()?.cargas?.length) {
                <dl>
                  @for (carga of store.treino()?.cargas; track carga.exercicio) {
                    <div class="acomp__linha">
                      <dt>{{ carga.exercicio }}</dt>
                      <dd>{{ carga.texto }}</dd>
                    </div>
                  }
                </dl>
              } @else {
                <ui-empty-state
                  heading="Sem dados ainda"
                  description="A carga aparece aqui depois dos primeiros treinos registrados."
                />
              }
            </section>
            <section class="acomp__bloco" aria-labelledby="acomp-esforco">
              <h2 id="acomp-esforco">Esforço por treino</h2>
              @if (store.treino()?.esforcoPorTreino?.length) {
                <dl>
                  @for (dia of store.treino()?.esforcoPorTreino; track dia.dia) {
                    <div class="acomp__linha">
                      <dt>{{ dataDoEsforco(dia.dia) }}</dt>
                      <dd>{{ dia.esforco }}</dd>
                    </div>
                  }
                </dl>
              } @else {
                <ui-empty-state
                  heading="Sem dados ainda"
                  description="O aluno dá uma nota de 0 a 10 ao fim de cada treino."
                />
              }
            </section>
          </div>

          <div class="acomp__blocos">
            <section class="acomp__bloco acomp__bloco--largo" aria-labelledby="acomp-ficha">
              <h2 id="acomp-ficha">Resumo da ficha</h2>
              @if (store.treino()?.ficha; as ficha) {
                <dl>
                  <div class="acomp__linha">
                    <dt>Ficha</dt>
                    <dd>{{ ficha.nome }}</dd>
                  </div>
                  <div class="acomp__linha">
                    <dt>Exercícios</dt>
                    <dd>{{ ficha.exercicios }}</dd>
                  </div>
                  <div class="acomp__linha">
                    <dt>Válida até</dt>
                    <dd>{{ ficha.validaAte ? dataDoEsforco(ficha.validaAte) : '—' }}</dd>
                  </div>
                </dl>
              } @else {
                <ui-empty-state
                  heading="Sem ficha ainda"
                  description="O resumo aparece quando o aluno tiver uma ficha de treino."
                />
              }
            </section>

            <section class="acomp__bloco acomp__bloco--largo" aria-labelledby="acomp-plano">
              <h2 id="acomp-plano">Plano e pagamentos</h2>
              <dl>
                @for (linha of linhasDoPlano(); track linha.rotulo) {
                  <div class="acomp__linha">
                    <dt>{{ linha.rotulo }}</dt>
                    <dd>{{ linha.valor }}</dd>
                  </div>
                }
              </dl>
            </section>

            <section class="acomp__bloco acomp__bloco--largo" aria-labelledby="acomp-obs">
              <h2 id="acomp-obs">Observações do professor</h2>
              <ui-empty-state
                heading="Nenhuma observação"
                description="As observações do professor sobre o aluno aparecem aqui."
              />
            </section>
          </div>
        }
      }
    }
  `,
})
export class AcompanhamentoPage {
  protected readonly store = inject(AcompanhamentoStore);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly migalhas = computed<readonly Crumb[]>(() => [
    { label: 'Alunos', link: '/alunos' },
    { label: this.store.aluno()?.nome ?? 'Aluno', link: `/alunos/${this.id}` },
    { label: 'Acompanhamento' },
  ]);

  /** "Plano Mensal · R$ 119,00 · desde 03/2026 · Professor Diego", só com o que existe. */
  protected readonly resumo = computed(() => {
    const contrato = this.store.contrato();
    const professor = this.store.professor();
    const partes = [
      contrato ? `Plano ${contrato.planoNome}` : '',
      contrato ? formatarBrl(centavos(contrato.valorTotalCentavos)) : '',
      contrato ? `desde ${mesEAno(contrato.inicio)}` : '',
      professor ? `Professor ${professor.nome}` : '',
    ];
    return partes.filter((parte) => parte !== '').join(' · ');
  });

  protected readonly situacao = computed(() => {
    const dados = this.store.situacao();
    if (!dados) {
      return null;
    }
    const atraso = dados.avaliacao?.diasDeAtraso ?? 0;
    const texto =
      dados.situacaoDeVencimento === 'em_atraso'
        ? `Em atraso, ${atraso === 1 ? '1 dia' : `${atraso} dias`}`
        : dados.situacaoDeVencimento === 'a_vencer'
          ? 'A vencer'
          : 'Em dia';
    return { texto, variante: VARIANTE[dados.situacaoDeVencimento] };
  });

  protected readonly esforcoMedio = computed(() => {
    const media = this.store.treino()?.esforcoMedio;
    return media === null || media === undefined ? '—' : String(media).replace('.', ',');
  });

  protected readonly legendaDoEsforco = computed(() =>
    this.store.treino()?.esforcoMedio == null
      ? 'Sem treinos avaliados ainda'
      : 'De 0 a 10, nos treinos registrados',
  );

  protected dataDoEsforco(iso: string): string {
    return dataDeIso(iso).slice(0, 5);
  }

  protected readonly proximaParcela = computed(() => {
    const vencimento = this.store.contrato()?.proximoVencimento;
    return vencimento ? `Próxima parcela ${dataDeIso(vencimento).slice(0, 5)}` : undefined;
  });

  protected readonly linhasDoPlano = computed(() => {
    const contrato = this.store.contrato();
    const pagamento = this.store.ultimoPagamento();
    const atrasadas = this.store.parcelasAtrasadas();
    return [
      {
        rotulo: 'Plano',
        valor: contrato
          ? `${contrato.planoNome} · ${formatarBrl(centavos(contrato.valorTotalCentavos))}`
          : 'Sem plano',
      },
      {
        rotulo: 'Último pagamento',
        valor: pagamento
          ? `${dataDeIso(pagamento.confirmadoEm.slice(0, 10))} · ${FORMAS[pagamento.forma] ?? pagamento.forma}`
          : '—',
      },
      {
        rotulo: 'Próxima cobrança',
        valor: contrato?.proximoVencimento ? dataDeIso(contrato.proximoVencimento) : '—',
      },
      {
        rotulo: 'Parcelas atrasadas',
        valor: atrasadas.length === 0 ? 'Nenhuma' : String(atrasadas.length),
      },
      // A nota fiscal por aluno é do T20 e ainda não tem endpoint.
      { rotulo: 'Nota fiscal', valor: '—' },
      { rotulo: 'Contrato', valor: contrato ? ESTADO_DO_CONTRATO[contrato.estado] : '—' },
    ];
  });

  constructor() {
    this.carregar();
  }

  protected carregar(): void {
    this.store.carregar(this.id);
  }
}
