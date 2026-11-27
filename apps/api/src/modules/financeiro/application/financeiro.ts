import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { type Centavos, centavos, formatarBrl } from '@gymos/shared-money';
import { diasEntre, somarDias } from '../../alunos/domain/datas';
import { JANELA_A_VENCER_DIAS } from '../../alunos/domain/contrato';
import { diasDeAtraso } from '../../cobranca/domain/parcela';
import { CacheComTenant } from '../../platform/application/eventos';
import { type DataCivil, Relogio } from '../../platform/domain/relogio';
import { CARGOS } from '../../funcionarios/domain/funcionario';
import {
  type ChaveDePeriodo,
  FUSO_PADRAO,
  inadimplencia,
  intervaloDoMes,
  mesDaData,
  mesesDoPeriodo,
  type Periodo,
  periodoAnterior,
  porcentagensInteiras,
  folhaDoPeriodo,
  ROTULO_DO_SETOR,
  acumularPartes,
  ratearReceitaDoAluno,
  receitaLiquida,
  receitaVazia,
  recortarNoMes,
  resolverPeriodo,
  rotuloCurtoDoMes,
  rotuloDoMes,
  type ReceitaRateada,
  setorDaReceitaDireta,
  setorPrincipalDoPlano,
  SETORES,
  type Setor,
  somarMesesCivis,
  variacaoEmPontosBase,
  ehReceitaDePlano,
  type MesCivil,
  type Presenca,
} from '../domain/financeiro';
import { FiltroInvalidoError } from './erros';
import {
  type ContratoVigente,
  EquipeParaOFinanceiro,
  type FiltroDoFinanceiro,
  type JanelaDeInstantes,
  LeituraFinanceira,
  OcupacaoDasAulas,
  PresencasParaORateio,
  RepositorioDeLancamentos,
} from './portas';
import type {
  ChaveDaVisao,
  ColunaDaTabela,
  FinanceiroGeral,
  Indicador,
  LinhaDaTabela,
  OpcoesDosFiltros,
  PeriodoApurado,
  PontoDaSerie,
  VisaoFinanceira,
} from './resultados';

const TTL_DO_CACHE_SEGUNDOS = 300;
const TTL_DA_GERACAO_SEGUNDOS = 86_400;
const MESES_DA_SERIE = 6;
export const LIMITE_PADRAO_DA_TABELA = 20;

/** Formas de pagamento agrupadas como a tela mostra (cartão junta crédito e débito). */
const FORMAS: ReadonlyArray<{ chave: string; rotulo: string; brutas: readonly string[] }> = [
  { chave: 'pix', rotulo: 'PIX', brutas: ['pix'] },
  { chave: 'cartao', rotulo: 'Cartão', brutas: ['cartao', 'cartao_credito', 'cartao_debito'] },
  { chave: 'boleto', rotulo: 'Boleto', brutas: ['boleto'] },
  { chave: 'dinheiro', rotulo: 'Dinheiro', brutas: ['dinheiro'] },
  { chave: 'link', rotulo: 'Link de pagamento', brutas: ['link'] },
];

const formaDaBruta = (bruta: string): (typeof FORMAS)[number] =>
  FORMAS.find((forma) => forma.brutas.includes(bruta)) ?? {
    chave: bruta,
    rotulo: bruta,
    brutas: [bruta],
  };

const CATEGORIAS: ReadonlyArray<{ chave: string; rotulo: string }> = [
  { chave: 'folha', rotulo: 'Folha' },
  { chave: 'aluguel', rotulo: 'Aluguel' },
  { chave: 'contas', rotulo: 'Contas' },
  { chave: 'outros', rotulo: 'Outros' },
];

const ROTULO_CURTO_DO_SETOR: Readonly<Record<Setor, string>> = {
  ...ROTULO_DO_SETOR,
  musculacao: 'Musculação',
};

/** Pedido de uma consulta: o período e os filtros da tela. */
export interface PedidoDoFinanceiro {
  periodo: ChaveDePeriodo;
  de?: string;
  ate?: string;
  filtro: FiltroDoFinanceiro;
  comparar?: boolean;
}

interface Apuracao {
  brutaCentavos: number;
  taxasCentavos: number;
  despesasCentavos: number;
  folhaCentavos: number;
  formas: Map<string, { rotulo: string; bruto: number; taxas: number; quantidade: number }>;
  planos: Map<string, { nome: string; bruto: number }>;
  rateio: ReceitaRateada;
  despesasPorCategoria: Record<string, number>;
  despesasPorSetor: Record<Setor, number>;
}

const reais = (valor: number): string =>
  formatarBrl(centavos(Math.round(valor / 100) * 100)).replace(/,00$/, '');

const vazioPorSetor = (): Record<Setor, number> => ({
  musculacao: 0,
  aulas: 0,
  lutas: 0,
  loja: 0,
  personal: 0,
  nutricao: 0,
});

/** 00:00 de São Paulo do dia (instante UTC); o fuso fixo de -03:00 vale desde 2019, sem horário de verão. */
function inicioDoDia(dia: DataCivil): Date {
  return new Date(`${dia}T03:00:00.000Z`);
}

function janelaDoRecorte(de: DataCivil, ate: DataCivil): JanelaDeInstantes {
  return { inicio: inicioDoDia(de), fim: inicioDoDia(somarDias(ate, 1)) };
}

/**
 * Consultas do Financeiro (T21): visão geral e as visões do "Visualizar por". Tudo calculado aqui, a
 * partir de portas; o resultado vai ao `cacheComTenant`, invalidado por pagamento, estorno, acesso e
 * lançamento (a "geração" do cache muda e as chaves antigas expiram sozinhas).
 */
@Injectable()
export class Financeiro {
  constructor(
    private readonly lancamentos: RepositorioDeLancamentos,
    private readonly leitura: LeituraFinanceira,
    private readonly equipe: EquipeParaOFinanceiro,
    private readonly presencas: PresencasParaORateio,
    private readonly ocupacao: OcupacaoDasAulas,
    private readonly relogio: Relogio,
    private readonly cache: CacheComTenant,
  ) {}

  hoje(): DataCivil {
    return this.relogio.hojeEm(FUSO_PADRAO);
  }

  // --- cache ---------------------------------------------------------------------------------

  /** Chave da geração atual do cache do tenant; `invalidarCache` troca-a. */
  private geracao(): Promise<string> {
    return this.cache.obter(['financeiro-geracao'], async () => randomUUID(), {
      ttlSegundos: TTL_DA_GERACAO_SEGUNDOS,
    });
  }

  async invalidarCache(): Promise<void> {
    await this.cache.invalidar(['financeiro-geracao']);
  }

  private async emCache<T>(consulta: unknown, carregar: () => Promise<T>): Promise<T> {
    const impressao = createHash('sha1').update(JSON.stringify(consulta)).digest('hex');
    return this.cache.obter(['financeiro', await this.geracao(), impressao], carregar, {
      ttlSegundos: TTL_DO_CACHE_SEGUNDOS,
    });
  }

  // --- período -------------------------------------------------------------------------------

  private resolver(pedido: PedidoDoFinanceiro): Periodo {
    try {
      return resolverPeriodo(pedido.periodo, this.hoje(), { de: pedido.de, ate: pedido.ate });
    } catch (erro) {
      throw new FiltroInvalidoError((erro as Error).message);
    }
  }

  private apurado(periodo: Periodo): PeriodoApurado {
    const anterior = periodoAnterior(periodo);
    return {
      chave: periodo.chave,
      de: periodo.de,
      ate: periodo.ate,
      rotulo: this.rotuloDoPeriodo(periodo),
      anterior: { de: anterior.de, ate: anterior.ate, rotulo: this.rotuloDoPeriodo(anterior) },
      escopo: '',
    };
  }

  private rotuloDoPeriodo(periodo: Periodo): string {
    const mesmoMes = mesDaData(periodo.de) === mesDaData(periodo.ate);
    const mesCompleto =
      periodo.de === intervaloDoMes(mesDaData(periodo.de)).de &&
      periodo.ate === intervaloDoMes(mesDaData(periodo.ate)).ate;
    if (mesmoMes && mesCompleto) {
      return rotuloDoMes(mesDaData(periodo.de));
    }
    if (periodo.de === periodo.ate) {
      return this.dataBr(periodo.de);
    }
    return `${this.dataBr(periodo.de)} a ${this.dataBr(periodo.ate)}`;
  }

  private dataBr(dia: string): string {
    const [ano, mes, d] = dia.split('-');
    return `${d}/${mes}/${ano}`;
  }

  // --- apuração ------------------------------------------------------------------------------

  /** Soma pagamentos, lançamentos e folha do período; com `comRateio`, distribui a receita de plano. */
  private async apurarPeriodo(
    periodo: Pick<Periodo, 'de' | 'ate'>,
    filtro: FiltroDoFinanceiro,
    comRateio: boolean,
  ): Promise<Apuracao> {
    const incluiReceitas = filtro.tipo !== 'despesas';
    const incluiDespesas = filtro.tipo !== 'receitas';
    const apuracao: Apuracao = {
      brutaCentavos: 0,
      taxasCentavos: 0,
      despesasCentavos: 0,
      folhaCentavos: 0,
      formas: new Map(),
      planos: new Map(),
      rateio: receitaVazia(),
      despesasPorCategoria: { folha: 0, aluguel: 0, contas: 0, outros: 0 },
      despesasPorSetor: vazioPorSetor(),
    };

    if (incluiReceitas) {
      for (const mes of mesesDoPeriodo(periodo)) {
        const recorte = recortarNoMes(periodo, mes);
        if (recorte) {
          await this.apurarReceitaDoMes(apuracao, mes, recorte, filtro, comRateio);
        }
      }
    }

    const lancamentos = await this.lancamentos.doPeriodo(periodo.de, periodo.ate, filtro);
    for (const lancamento of lancamentos) {
      if (lancamento.tipo === 'receita') {
        if (incluiReceitas) {
          apuracao.brutaCentavos += lancamento.valorCentavos;
          apuracao.rateio.porSetor[lancamento.setor ?? 'musculacao'] += lancamento.valorCentavos;
        }
      } else if (incluiDespesas) {
        apuracao.despesasCentavos += lancamento.valorCentavos;
        apuracao.despesasPorCategoria[lancamento.categoria] =
          (apuracao.despesasPorCategoria[lancamento.categoria] ?? 0) + lancamento.valorCentavos;
        if (lancamento.setor) {
          apuracao.despesasPorSetor[lancamento.setor] += lancamento.valorCentavos;
        }
      }
    }

    if (incluiDespesas && (!filtro.categoria || filtro.categoria === 'folha')) {
      const { itens } = await this.equipe.equipe();
      for (const item of itens) {
        const custo = folhaDoPeriodo(item.custoMensalCentavos, periodo);
        apuracao.folhaCentavos += custo;
        if (item.cargo === 'nutricionista') {
          apuracao.despesasPorSetor.nutricao += custo;
        }
      }
      apuracao.despesasCentavos += apuracao.folhaCentavos;
      apuracao.despesasPorCategoria['folha'] = apuracao.folhaCentavos;
    }
    return apuracao;
  }

  private async apurarReceitaDoMes(
    apuracao: Apuracao,
    mes: MesCivil,
    recorte: { de: DataCivil; ate: DataCivil },
    filtro: FiltroDoFinanceiro,
    comRateio: boolean,
  ): Promise<void> {
    const totais = await this.leitura.pagamentos(janelaDoRecorte(recorte.de, recorte.ate), filtro);
    const planos = await this.leitura.planosDosContratos(
      totais.flatMap((total) => (total.contratoId ? [total.contratoId] : [])),
    );
    const planosDoAluno = new Map<
      string,
      { valor: number; setor: Setor; planoId: string | null }
    >();

    for (const total of totais) {
      apuracao.brutaCentavos += total.brutoCentavos;
      apuracao.taxasCentavos += total.taxasCentavos;
      const forma = formaDaBruta(total.forma);
      const daForma = apuracao.formas.get(forma.chave) ?? {
        rotulo: forma.rotulo,
        bruto: 0,
        taxas: 0,
        quantidade: 0,
      };
      daForma.bruto += total.brutoCentavos;
      daForma.taxas += total.taxasCentavos;
      daForma.quantidade += total.quantidade;
      apuracao.formas.set(forma.chave, daForma);

      const plano = total.contratoId ? planos.get(total.contratoId) : undefined;
      if (!ehReceitaDePlano(total.origem)) {
        apuracao.rateio.porSetor[setorDaReceitaDireta(total.origem)] += total.brutoCentavos;
        continue;
      }
      const setor = setorPrincipalDoPlano(plano?.modalidades ?? []);
      const nome = plano?.planoNome ?? 'Sem plano';
      const chaveDoPlano = plano?.planoId ?? 'sem-plano';
      const doPlano = apuracao.planos.get(chaveDoPlano) ?? { nome, bruto: 0 };
      doPlano.bruto += total.brutoCentavos;
      apuracao.planos.set(chaveDoPlano, doPlano);

      const chaveDoAluno = total.alunoId ?? `anonimo:${total.contratoId ?? chaveDoPlano}`;
      const atual = planosDoAluno.get(chaveDoAluno);
      if (!atual) {
        planosDoAluno.set(chaveDoAluno, {
          valor: total.brutoCentavos,
          setor,
          planoId: plano?.planoId ?? null,
        });
      } else {
        atual.valor += total.brutoCentavos;
      }
    }

    if (!comRateio) {
      return;
    }
    const doMes = await this.presencas.doMes(mes);
    for (const [alunoId, { valor, setor }] of planosDoAluno) {
      const presencas: Presenca[] = [
        ...Array.from({ length: doMes.checkins.get(alunoId) ?? 0 }, () => ({
          setor,
          aulaId: null,
          aulaNome: null,
          professorId: null,
        })),
        ...(doMes.emAulas.get(alunoId) ?? []),
      ];
      acumularPartes(apuracao.rateio, ratearReceitaDoAluno(valor, setor, presencas));
    }
  }

  /** Série dos últimos meses (receita, taxas, despesas e adesões), do mais antigo ao mais recente. */
  private async serieMensal(ate: DataCivil, filtro: FiltroDoFinanceiro): Promise<PontoDaSerie[]> {
    const ultimo = mesDaData(ate);
    const meses = Array.from({ length: MESES_DA_SERIE }, (_, i) =>
      somarMesesCivis(ultimo, i - (MESES_DA_SERIE - 1)),
    );
    const fins = meses.map((mes) => intervaloDoMes(mes).ate);
    const ativas = await this.leitura.adesoesAtivasEm(fins, filtro);
    return Promise.all(
      meses.map(async (mes, indice) => {
        const { de, ate: fim } = intervaloDoMes(mes);
        const [apuracao, adesoes] = await Promise.all([
          this.apurarPeriodo({ de, ate: fim }, filtro, false),
          this.leitura.adesoes(de, fim, filtro),
        ]);
        return {
          mes,
          rotulo: rotuloCurtoDoMes(mes),
          brutaCentavos: apuracao.brutaCentavos,
          taxasCentavos: apuracao.taxasCentavos,
          despesasCentavos: apuracao.despesasCentavos,
          liquidaCentavos: receitaLiquida(
            apuracao.brutaCentavos as Centavos,
            apuracao.taxasCentavos as Centavos,
            apuracao.despesasCentavos as Centavos,
          ),
          adesoesAtivas: ativas[indice] ?? 0,
          novasAdesoes: adesoes.novas,
        };
      }),
    );
  }

  // --- base de alunos ------------------------------------------------------------------------

  private situacaoDoContrato(
    contrato: ContratoVigente,
    hoje: DataCivil,
  ): { situacao: 'em_dia' | 'em_atraso' | 'a_vencer'; texto: string } {
    const atraso = diasDeAtraso(contrato.vencimentoEmAtraso, hoje);
    if (atraso > 0) {
      return { situacao: 'em_atraso', texto: `Atraso ${atraso} ${atraso === 1 ? 'dia' : 'dias'}` };
    }
    if (contrato.proximoVencimento) {
      const faltam = diasEntre(hoje, contrato.proximoVencimento);
      if (faltam >= 0 && faltam <= JANELA_A_VENCER_DIAS) {
        return {
          situacao: 'a_vencer',
          texto:
            faltam === 0 ? 'Vence hoje' : `Vence em ${faltam} ${faltam === 1 ? 'dia' : 'dias'}`,
        };
      }
    }
    return { situacao: 'em_dia', texto: 'Em dia' };
  }

  private async baseDeAlunos(filtro: FiltroDoFinanceiro): Promise<{
    ativos: number;
    emAtraso: number;
    aVencer: number;
    contratos: ContratoVigente[];
  }> {
    const hoje = this.hoje();
    const contratos = await this.leitura.contratosVigentes(filtro);
    const alunos = new Map<string, 'em_dia' | 'em_atraso' | 'a_vencer'>();
    for (const contrato of contratos) {
      const { situacao } = this.situacaoDoContrato(contrato, hoje);
      const anterior = alunos.get(contrato.alunoId);
      const peso = { em_dia: 0, a_vencer: 1, em_atraso: 2 };
      if (!anterior || peso[situacao] > peso[anterior]) {
        alunos.set(contrato.alunoId, situacao);
      }
    }
    const situacoes = [...alunos.values()];
    return {
      ativos: alunos.size,
      emAtraso: situacoes.filter((s) => s === 'em_atraso').length,
      aVencer: situacoes.filter((s) => s === 'a_vencer').length,
      contratos,
    };
  }

  // --- visão geral ---------------------------------------------------------------------------

  async geral(pedido: PedidoDoFinanceiro): Promise<FinanceiroGeral> {
    const periodo = this.resolver(pedido);
    return this.emCache(
      { visao: 'geral', periodo, filtro: pedido.filtro, comparar: pedido.comparar },
      async () => {
        const { filtro } = pedido;
        const escopo = await this.escopo(filtro);
        const [atual, anterior, serie, base, adesoes] = await Promise.all([
          this.apurarPeriodo(periodo, filtro, false),
          pedido.comparar === false
            ? Promise.resolve(null)
            : this.apurarPeriodo(periodoAnterior(periodo), filtro, false),
          this.serieMensal(periodo.ate, filtro),
          this.baseDeAlunos(filtro),
          this.leitura.adesoes(periodo.de, periodo.ate, filtro),
        ]);
        const liquida = receitaLiquida(
          atual.brutaCentavos as Centavos,
          atual.taxasCentavos as Centavos,
          atual.despesasCentavos as Centavos,
        );
        const liquidaAnterior = anterior
          ? receitaLiquida(
              anterior.brutaCentavos as Centavos,
              anterior.taxasCentavos as Centavos,
              anterior.despesasCentavos as Centavos,
            )
          : null;
        const formas = [...atual.formas.entries()]
          .filter(([, forma]) => forma.bruto > 0)
          .sort(([, a], [, b]) => b.bruto - a.bruto);
        const percentuais = porcentagensInteiras(formas.map(([, forma]) => forma.bruto));
        return {
          periodo: { ...this.apurado(periodo), escopo },
          receitaLiquida: {
            centavos: liquida,
            anteriorCentavos: liquidaAnterior,
            variacaoPontosBase:
              liquidaAnterior === null ? null : variacaoEmPontosBase(liquida, liquidaAnterior),
          },
          brutaCentavos: atual.brutaCentavos,
          taxasCentavos: atual.taxasCentavos,
          despesasCentavos: atual.despesasCentavos,
          adesoesAtivas: base.ativos,
          novasAdesoes: adesoes.novas,
          cancelamentos: adesoes.cancelamentos,
          inadimplencia: {
            emAtraso: base.emAtraso,
            ativos: base.ativos,
            pontosBase: inadimplencia(base.emAtraso, base.ativos),
          },
          porForma: formas.map(([chave, forma], i) => ({
            forma: chave,
            centavos: forma.bruto,
            percentual: percentuais[i] ?? 0,
          })),
          despesasPorCategoria: CATEGORIAS.map(({ chave, rotulo }) => ({
            categoria: chave,
            rotulo,
            centavos: atual.despesasPorCategoria[chave] ?? 0,
          })),
          serieMensal: serie,
        };
      },
    );
  }

  // --- demais visões -------------------------------------------------------------------------

  visao(
    chave: ChaveDaVisao,
    pedido: PedidoDoFinanceiro,
    paginacao: { limite?: number; cursor?: string } = {},
  ): Promise<VisaoFinanceira> {
    const periodo = this.resolver(pedido);
    return this.emCache({ visao: chave, periodo, filtro: pedido.filtro, paginacao }, async () => {
      const visao = await this.calcularVisao(chave, periodo, pedido, paginacao);
      visao.periodo.escopo = await this.escopo(pedido.filtro);
      return visao;
    });
  }

  private calcularVisao(
    chave: ChaveDaVisao,
    periodo: Periodo,
    pedido: PedidoDoFinanceiro,
    paginacao: { limite?: number; cursor?: string },
  ): Promise<VisaoFinanceira> {
    {
      switch (chave) {
        case 'setores':
          return this.visaoDosSetores(periodo, pedido.filtro);
        case 'funcionarios':
          return this.visaoDosFuncionarios(periodo, pedido.filtro);
        case 'aulas':
          return this.visaoDasAulas(periodo, pedido.filtro);
        case 'alunos':
          return this.visaoDosAlunos(periodo, pedido.filtro, paginacao);
        case 'planos':
          return this.visaoDosPlanos(periodo, pedido.filtro);
        case 'formas-de-pagamento':
          return this.visaoDasFormas(periodo, pedido.filtro);
      }
    }
  }

  /** `Unidade Centro`, ou `Todas as unidades` quando não há filtro e a academia tem mais de uma. */
  private async escopo(filtro: FiltroDoFinanceiro): Promise<string> {
    const unidades = await this.leitura.unidades();
    const escolhida = filtro.unidadeId
      ? unidades.find((unidade) => unidade.id === filtro.unidadeId)
      : unidades.length === 1
        ? unidades[0]
        : undefined;
    return escolhida ? `Unidade ${escolhida.nome}` : 'Todas as unidades';
  }

  private coluna(
    chave: string,
    rotulo: string,
    tipo: ColunaDaTabela['tipo'],
    vazio: string | null = null,
  ): ColunaDaTabela {
    return { chave, rotulo, tipo, vazio };
  }

  private indicador(
    rotulo: string,
    formato: Indicador['formato'],
    valor: number,
    legenda: string,
    extras: { texto?: string; positivo?: boolean } = {},
  ): Indicador {
    return {
      rotulo,
      formato,
      valor,
      texto: extras.texto ?? null,
      legenda,
      positivo: extras.positivo ?? false,
    };
  }

  private async visaoDosSetores(
    periodo: Periodo,
    filtro: FiltroDoFinanceiro,
  ): Promise<VisaoFinanceira> {
    const [atual, anterior] = await Promise.all([
      this.apurarPeriodo(periodo, filtro, true),
      this.apurarPeriodo(periodoAnterior(periodo), filtro, true),
    ]);
    const bruta = SETORES.map((setor) => atual.rateio.porSetor[setor]);
    const pesos = porcentagensInteiras(bruta);
    const total = bruta.reduce((soma, valor) => soma + valor, 0);
    const despesasDosSetores = SETORES.reduce(
      (soma, setor) => soma + atual.despesasPorSetor[setor],
      0,
    );
    const maior = SETORES.reduce((m, setor) =>
      atual.rateio.porSetor[setor] > atual.rateio.porSetor[m] ? setor : m,
    );
    const crescimentos = SETORES.map((setor) => ({
      setor,
      variacao: variacaoEmPontosBase(atual.rateio.porSetor[setor], anterior.rateio.porSetor[setor]),
    })).filter(
      (item): item is { setor: Setor; variacao: ReturnType<typeof inadimplencia> } =>
        item.variacao !== null,
    );
    const crescimento = crescimentos.sort((a, b) => b.variacao - a.variacao)[0];
    const naoAlocadas =
      atual.despesasCentavos - despesasDosSetores > 0
        ? ` e ${reais(atual.despesasCentavos - despesasDosSetores)} de despesas gerais`
        : '';
    return {
      visao: 'setores',
      periodo: this.apurado(periodo),
      indicadores: [
        this.indicador('Receita bruta', 'brl', total, 'Soma dos setores'),
        this.indicador(
          'Despesas por setor',
          'brl',
          despesasDosSetores,
          `Taxas de ${reais(atual.taxasCentavos)}${naoAlocadas} não alocadas`,
        ),
        this.indicador(
          'Maior setor',
          'texto',
          0,
          total > 0
            ? `${pesos[SETORES.indexOf(maior)]}% da receita bruta`
            : 'Sem receita no período',
          { texto: total > 0 ? ROTULO_CURTO_DO_SETOR[maior] : '—' },
        ),
        this.indicador(
          'Maior crescimento',
          'texto',
          0,
          crescimento && crescimento.variacao > 0
            ? `+${Math.round(crescimento.variacao / 100)}% sobre ${periodo.chave === 'este-mes' ? rotuloDoMes(periodoAnterior(periodo).de.slice(0, 7)).split(' ')[0]?.toLowerCase() : 'o período anterior'}`
            : 'Sem base de comparação',
          {
            texto:
              crescimento && crescimento.variacao > 0
                ? ROTULO_CURTO_DO_SETOR[crescimento.setor]
                : '—',
            positivo: Boolean(crescimento && crescimento.variacao > 0),
          },
        ),
      ],
      grafico: {
        titulo: 'Receita bruta por setor',
        subtitulo: `Total ${reais(total)}`,
        barras: SETORES.map((setor) => ({
          rotulo: ROTULO_DO_SETOR[setor],
          valorCentavos: atual.rateio.porSetor[setor],
        })),
      },
      tabela: {
        titulo: 'Resultado por setor',
        subtitulo: 'Receita bruta menos despesas do setor',
        colunas: [
          this.coluna('setor', 'Setor', 'texto'),
          this.coluna('receita', 'Receita bruta', 'brl'),
          this.coluna('despesas', 'Despesas', 'brl'),
          this.coluna('resultado', 'Resultado', 'brl'),
          this.coluna('peso', 'Peso', 'percentual'),
        ],
        linhas: SETORES.map((setor, i) => ({
          id: setor,
          celulas: {
            setor: ROTULO_DO_SETOR[setor],
            receita: atual.rateio.porSetor[setor],
            despesas: atual.despesasPorSetor[setor],
            resultado: atual.rateio.porSetor[setor] - atual.despesasPorSetor[setor],
            peso: pesos[i] ?? 0,
          },
          situacao: null,
          link: null,
        })),
        total: SETORES.length,
        proximoCursor: null,
      },
    };
  }

  private async visaoDosFuncionarios(
    periodo: Periodo,
    filtro: FiltroDoFinanceiro,
  ): Promise<VisaoFinanceira> {
    const [atual, { itens }] = await Promise.all([
      this.apurarPeriodo(periodo, filtro, true),
      this.equipe.equipe(),
    ]);
    const receitaDe = new Map(atual.rateio.porProfessor.map((p) => [p.professorId, p.centavos]));
    const folha = itens.reduce(
      (soma, item) => soma + folhaDoPeriodo(item.custoMensalCentavos, periodo),
      0,
    );
    const receitaGerada = [...receitaDe.values()].reduce((soma, valor) => soma + valor, 0);
    const maior = itens
      .filter((item) => (receitaDe.get(item.funcionarioId) ?? 0) > 0)
      .sort(
        (a, b) => (receitaDe.get(b.funcionarioId) ?? 0) - (receitaDe.get(a.funcionarioId) ?? 0),
      )[0];
    const nomeDoCargo = (cargo: string, descricao: string | null): string =>
      cargo === 'outro' && descricao
        ? descricao
        : (CARGOS.find((c) => c.chave === cargo)?.nome ?? cargo);
    const ordenados = [...itens].sort(
      (a, b) =>
        (receitaDe.get(b.funcionarioId) ?? 0) - (receitaDe.get(a.funcionarioId) ?? 0) ||
        b.custoMensalCentavos - a.custoMensalCentavos ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
    );
    return {
      visao: 'funcionarios',
      periodo: this.apurado(periodo),
      indicadores: [
        this.indicador(
          'Folha do mês',
          'brl',
          folha,
          `${itens.length} ${itens.length === 1 ? 'funcionário' : 'funcionários'}`,
        ),
        this.indicador('Receita gerada', 'brl', receitaGerada, 'Aulas, personal e nutrição'),
        this.indicador(
          'Maior receita',
          'texto',
          0,
          maior ? reais(receitaDe.get(maior.funcionarioId) ?? 0) : 'Sem receita atribuída',
          { texto: maior ? (maior.nome.split(' ')[0] ?? maior.nome) : '—' },
        ),
        this.indicador(
          'Custo médio',
          'brl',
          itens.length === 0 ? 0 : Math.round(folha / itens.length),
          'Por funcionário',
        ),
      ],
      grafico: {
        titulo: 'Receita gerada por funcionário',
        subtitulo: 'Apenas quem atende alunos',
        barras: ordenados
          .filter((item) => (receitaDe.get(item.funcionarioId) ?? 0) > 0)
          .map((item) => ({
            rotulo: item.nome.split(' ')[0] ?? item.nome,
            valorCentavos: receitaDe.get(item.funcionarioId) ?? 0,
          })),
      },
      tabela: {
        titulo: 'Equipe',
        subtitulo: 'Custo mensal e receita atribuída',
        colunas: [
          this.coluna('funcionario', 'Funcionário', 'texto'),
          this.coluna('cargo', 'Cargo', 'texto'),
          this.coluna('custo', 'Custo', 'brl'),
          this.coluna('receita', 'Receita gerada', 'brl', 'sem receita direta'),
        ],
        linhas: ordenados.map((item) => ({
          id: item.funcionarioId,
          celulas: {
            funcionario: item.nome,
            cargo: nomeDoCargo(item.cargo, item.cargoDescricao),
            custo: folhaDoPeriodo(item.custoMensalCentavos, periodo),
            receita: receitaDe.get(item.funcionarioId) ?? null,
          },
          situacao: null,
          link: null,
        })),
        total: itens.length,
        proximoCursor: null,
      },
    };
  }

  private async visaoDasAulas(
    periodo: Periodo,
    filtro: FiltroDoFinanceiro,
  ): Promise<VisaoFinanceira> {
    const [atual, ocupacoes] = await Promise.all([
      this.apurarPeriodo(periodo, filtro, true),
      this.ocupacao.doPeriodo(periodo.de, periodo.ate),
    ]);
    const porAula = [...atual.rateio.porAula].sort((a, b) => b.centavos - a.centavos);
    const total = porAula.reduce((soma, aula) => soma + aula.centavos, 0);
    const doTipo = (setor: Setor): string =>
      porAula
        .filter((aula) => aula.setor === setor)
        .map((aula) => aula.aulaNome)
        .join(', ');
    const medidas = ocupacoes.filter((aula) => aula.ocupacaoPontosBase !== null);
    const media =
      medidas.length === 0
        ? null
        : Math.round(
            medidas.reduce((soma, aula) => soma + (aula.ocupacaoPontosBase ?? 0), 0) /
              medidas.length,
          );
    const melhor = medidas.sort(
      (a, b) => (b.ocupacaoPontosBase ?? 0) - (a.ocupacaoPontosBase ?? 0),
    )[0];
    const ocupacaoDe = new Map(ocupacoes.map((aula) => [aula.aulaId, aula]));
    return {
      visao: 'aulas',
      periodo: this.apurado(periodo),
      indicadores: [
        this.indicador(
          'Aulas coletivas',
          'brl',
          atual.rateio.porSetor.aulas,
          doTipo('aulas') || 'Sem aulas no período',
        ),
        this.indicador(
          'Lutas',
          'brl',
          atual.rateio.porSetor.lutas,
          doTipo('lutas') || 'Sem aulas no período',
        ),
        media === null
          ? this.indicador('Ocupação média', 'texto', 0, 'Das vagas oferecidas', { texto: '—' })
          : this.indicador('Ocupação média', 'percentual', media, 'Das vagas oferecidas'),
        this.indicador(
          'Melhor aula',
          'texto',
          0,
          melhor
            ? `${Math.round((melhor.ocupacaoPontosBase ?? 0) / 100)}% de ocupação`
            : 'Sem dado de ocupação',
          { texto: melhor?.nome ?? '—' },
        ),
      ],
      grafico: {
        titulo: 'Receita por aula',
        subtitulo: `Total ${reais(total)}`,
        barras: porAula.map((aula) => ({ rotulo: aula.aulaNome, valorCentavos: aula.centavos })),
      },
      tabela: {
        titulo: 'Aulas',
        subtitulo: 'Receita do mês e ocupação média',
        colunas: [
          this.coluna('aula', 'Aula', 'texto'),
          this.coluna('tipo', 'Tipo', 'texto'),
          this.coluna('receita', 'Receita', 'brl'),
          this.coluna('ocupacao', 'Ocupação', 'percentual', 'sem dado'),
        ],
        linhas: porAula.map((aula) => {
          const ocupacao = ocupacaoDe.get(aula.aulaId)?.ocupacaoPontosBase ?? null;
          return {
            id: aula.aulaId,
            celulas: {
              aula: aula.aulaNome,
              tipo: aula.setor === 'lutas' ? 'Luta' : 'Coletiva',
              receita: aula.centavos,
              ocupacao: ocupacao === null ? null : Math.round(ocupacao / 100),
            },
            situacao: null,
            link: null,
          };
        }),
        total: porAula.length,
        proximoCursor: null,
      },
    };
  }

  private async visaoDosAlunos(
    periodo: Periodo,
    filtro: FiltroDoFinanceiro,
    paginacao: { limite?: number; cursor?: string },
  ): Promise<VisaoFinanceira> {
    const hoje = this.hoje();
    const [atual, base, aReceber] = await Promise.all([
      this.apurarPeriodo(periodo, filtro, false),
      this.baseDeAlunos(filtro),
      this.leitura.saldoEmAtraso(filtro),
    ]);
    const emDia = Math.max(0, base.ativos - base.emAtraso - base.aVencer);
    const porPlano = [...atual.planos.values()].sort((a, b) => b.bruto - a.bruto);
    const ordenados = [...base.contratos].sort((a, b) =>
      a.alunoNome.localeCompare(b.alunoNome, 'pt-BR'),
    );
    const limite = Math.min(Math.max(paginacao.limite ?? LIMITE_PADRAO_DA_TABELA, 1), 100);
    const inicio = this.lerCursor(paginacao.cursor);
    const pagina = ordenados.slice(inicio, inicio + limite);
    const linhas: LinhaDaTabela[] = pagina.map((contrato) => {
      const { situacao, texto } = this.situacaoDoContrato(contrato, hoje);
      return {
        id: contrato.contratoId,
        celulas: {
          aluno: contrato.alunoNome,
          plano: contrato.planoNome,
          parcela: contrato.parcelaCentavos,
          situacao: texto,
        },
        situacao,
        link: `/alunos/${contrato.alunoId}`,
      };
    });
    return {
      visao: 'alunos',
      periodo: this.apurado(periodo),
      indicadores: [
        this.indicador(
          'Ticket médio',
          'brl',
          base.ativos === 0 ? 0 : Math.round(atual.brutaCentavos / base.ativos),
          'Por aluno ativo',
        ),
        this.indicador(
          'Em dia',
          'inteiro',
          emDia,
          base.ativos === 0
            ? 'Sem alunos ativos'
            : `${this.percentualDeAlunos(emDia, base.ativos)} dos alunos`,
        ),
        this.indicador('Em atraso', 'inteiro', base.emAtraso, `${reais(aReceber)} a receber`),
        this.indicador('A vencer', 'inteiro', base.aVencer, 'Próximos 7 dias'),
      ],
      grafico: {
        titulo: 'Receita por tipo de plano',
        subtitulo: 'Alunos ativos × valor',
        barras: porPlano.map((plano) => ({ rotulo: plano.nome, valorCentavos: plano.bruto })),
      },
      tabela: {
        titulo: 'Alunos e cobranças',
        subtitulo: `Mostrando ${Math.min(inicio + pagina.length, ordenados.length)} de ${ordenados.length}`,
        colunas: [
          this.coluna('aluno', 'Aluno', 'texto'),
          this.coluna('plano', 'Plano', 'texto'),
          this.coluna('parcela', 'Parcela', 'brl', '—'),
          this.coluna('situacao', 'Situação', 'situacao'),
        ],
        linhas,
        total: ordenados.length,
        proximoCursor:
          inicio + limite < ordenados.length ? this.criarCursor(inicio + limite) : null,
      },
    };
  }

  /** `92,6%` (uma casa; o meio vai para o par, como o `formatarPercentual`). */
  private percentualDeAlunos(parte: number, total: number): string {
    const decimos = Math.round((parte * 1000) / total);
    return `${Math.floor(decimos / 10)},${decimos % 10}%`;
  }

  private criarCursor(posicao: number): string {
    return Buffer.from(String(posicao)).toString('base64url');
  }

  private lerCursor(cursor?: string): number {
    if (!cursor) {
      return 0;
    }
    const posicao = Number(Buffer.from(cursor, 'base64url').toString('utf-8'));
    if (!Number.isSafeInteger(posicao) || posicao < 0) {
      throw new FiltroInvalidoError('Cursor inválido.');
    }
    return posicao;
  }

  private async visaoDosPlanos(
    periodo: Periodo,
    filtro: FiltroDoFinanceiro,
  ): Promise<VisaoFinanceira> {
    const [atual, base] = await Promise.all([
      this.apurarPeriodo(periodo, filtro, false),
      this.baseDeAlunos(filtro),
    ]);
    const alunosPorPlano = new Map<string, Set<string>>();
    for (const contrato of base.contratos) {
      const alunos = alunosPorPlano.get(contrato.planoId) ?? new Set<string>();
      alunos.add(contrato.alunoId);
      alunosPorPlano.set(contrato.planoId, alunos);
    }
    const nomes = new Map(base.contratos.map((c) => [c.planoId, c.planoNome]));
    const linhas = [...new Set([...atual.planos.keys(), ...alunosPorPlano.keys()])]
      .map((planoId) => ({
        planoId,
        nome: atual.planos.get(planoId)?.nome ?? nomes.get(planoId) ?? 'Plano',
        bruto: atual.planos.get(planoId)?.bruto ?? 0,
        alunos: alunosPorPlano.get(planoId)?.size ?? 0,
      }))
      .sort((a, b) => b.bruto - a.bruto);
    const total = linhas.reduce((soma, linha) => soma + linha.bruto, 0);
    const pesos = porcentagensInteiras(linhas.map((linha) => linha.bruto));
    const maior = linhas[0];
    return {
      visao: 'planos',
      periodo: this.apurado(periodo),
      indicadores: [
        this.indicador('Receita de planos', 'brl', total, 'Mensalidades no período'),
        this.indicador('Alunos ativos', 'inteiro', base.ativos, 'Com plano vigente'),
        this.indicador(
          'Ticket médio',
          'brl',
          base.ativos === 0 ? 0 : Math.round(total / base.ativos),
          'Por aluno ativo',
        ),
        this.indicador(
          'Plano de maior receita',
          'texto',
          0,
          maior && total > 0 ? `${pesos[0]}% da receita de planos` : 'Sem receita no período',
          { texto: maior && total > 0 ? maior.nome : '—' },
        ),
      ],
      grafico: {
        titulo: 'Receita por plano',
        subtitulo: `Total ${reais(total)}`,
        barras: linhas.map((linha) => ({ rotulo: linha.nome, valorCentavos: linha.bruto })),
      },
      tabela: {
        titulo: 'Planos',
        subtitulo: 'Alunos ativos e receita do período',
        colunas: [
          this.coluna('plano', 'Plano', 'texto'),
          this.coluna('alunos', 'Alunos ativos', 'inteiro'),
          this.coluna('receita', 'Receita', 'brl'),
          this.coluna('peso', 'Peso', 'percentual'),
        ],
        linhas: linhas.map((linha, i) => ({
          id: linha.planoId,
          celulas: {
            plano: linha.nome,
            alunos: linha.alunos,
            receita: linha.bruto,
            peso: pesos[i] ?? 0,
          },
          situacao: null,
          link: null,
        })),
        total: linhas.length,
        proximoCursor: null,
      },
    };
  }

  private async visaoDasFormas(
    periodo: Periodo,
    filtro: FiltroDoFinanceiro,
  ): Promise<VisaoFinanceira> {
    const atual = await this.apurarPeriodo(periodo, filtro, false);
    const formas = [...atual.formas.entries()]
      .map(([chave, forma]) => ({ chave, ...forma }))
      .sort((a, b) => b.bruto - a.bruto);
    const total = formas.reduce((soma, forma) => soma + forma.bruto, 0);
    const pesos = porcentagensInteiras(formas.map((forma) => forma.bruto));
    const quantidade = formas.reduce((soma, forma) => soma + forma.quantidade, 0);
    const maior = formas[0];
    return {
      visao: 'formas-de-pagamento',
      periodo: this.apurado(periodo),
      indicadores: [
        this.indicador('Receita bruta', 'brl', total, 'Todas as formas'),
        this.indicador('Taxas', 'brl', atual.taxasCentavos, 'Cartão, boleto e PIX'),
        this.indicador('Pagamentos', 'inteiro', quantidade, 'Confirmados no período'),
        this.indicador(
          'Forma mais usada',
          'texto',
          0,
          maior && total > 0 ? `${pesos[0]}% da receita` : 'Sem receita no período',
          { texto: maior && total > 0 ? maior.rotulo : '—' },
        ),
      ],
      grafico: {
        titulo: 'Receita por forma de pagamento',
        subtitulo: `Total ${reais(total)}`,
        barras: formas.map((forma) => ({ rotulo: forma.rotulo, valorCentavos: forma.bruto })),
      },
      tabela: {
        titulo: 'Formas de pagamento',
        subtitulo: 'Receita, taxas e pagamentos do período',
        colunas: [
          this.coluna('forma', 'Forma', 'texto'),
          this.coluna('pagamentos', 'Pagamentos', 'inteiro'),
          this.coluna('receita', 'Receita', 'brl'),
          this.coluna('taxas', 'Taxas', 'brl'),
          this.coluna('peso', 'Peso', 'percentual'),
        ],
        linhas: formas.map((forma, i) => ({
          id: forma.chave,
          celulas: {
            forma: forma.rotulo,
            pagamentos: forma.quantidade,
            receita: forma.bruto,
            taxas: forma.taxas,
            peso: pesos[i] ?? 0,
          },
          situacao: null,
          link: null,
        })),
        total: formas.length,
        proximoCursor: null,
      },
    };
  }

  // --- filtros -------------------------------------------------------------------------------

  async opcoesDosFiltros(): Promise<OpcoesDosFiltros> {
    const [unidades, planos] = await Promise.all([this.leitura.unidades(), this.leitura.planos()]);
    return {
      unidades,
      planos: planos.map(({ id, nome }) => ({ id, nome })),
      modalidades: [...new Set(planos.flatMap((plano) => plano.modalidades))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      formas: FORMAS.map(({ chave, rotulo }) => ({ chave, rotulo })),
      categorias: [...CATEGORIAS],
    };
  }
}

export { FORMAS, CATEGORIAS };
