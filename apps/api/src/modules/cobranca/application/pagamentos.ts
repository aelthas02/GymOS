import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { centavos, formatarBrl } from '@gymos/shared-money';
import { formatarDataBr } from '@gymos/shared-pipes/formatadores';
import { type Executor, RegistroDeAtividade } from '../../alunos/application/autoria';
import { PublicadorDeEventos } from '../../platform/application/eventos';
import { FUSO_PADRAO, Relogio } from '../../platform/domain/relogio';
import {
  type FormaDeCobranca,
  type FormaDoBalcao,
  type FormaPreferida,
  OperacaoDePagamentoInvalidaError,
  type Origem,
  type Pagamento,
  estornar,
  setorDaOrigem,
} from '../domain/pagamento';
import {
  aplicarPagamento,
  estornarNaParcela,
  type Parcela,
  saldo,
  SITUACOES_A_RECEBER,
} from '../domain/parcela';
import { NaoEncontradoError } from './erros';
import {
  AlunosDaCobranca,
  type Cobranca,
  type EventoDoProvedor,
  type FormaDePagamentoDoAluno,
  GatewayDePagamento,
  Mensageria,
  type NovoPagamento,
  ReferenciasExternas,
  RepositorioDeCobrancas,
  RepositorioDeEstornos,
  RepositorioDeFormasDePagamento,
  RepositorioDePagamentos,
  RepositorioDeParcelas,
} from './portas';

export interface PagamentoNoBalcao {
  alunoId: string;
  /** Sem parcela, é um pagamento avulso (aula avulsa, personal, nutrição, loja). */
  parcelaId: string | null;
  valorCentavos: number;
  forma: FormaDoBalcao;
  /** Taxa da maquininha; dinheiro e PIX no balcão não têm taxa. */
  taxaCentavos?: number;
  origem?: Origem;
}

export interface NovaFormaDePagamento {
  forma: FormaPreferida;
  tokenDoCartao?: string | null;
  finalDoCartao?: string | null;
}

export type ResultadoDoProvedor = 'processado' | 'recurso-nao-encontrado';

type DadosDaConfirmacao = Omit<NovoPagamento, 'emDuplicidade' | 'setor' | 'contratoId'>;

/**
 * Cobranças no provedor, pagamentos (balcão e webhook) e estornos (T19, ADR-009). A baixa trava a
 * linha da parcela: balcão e webhook da mesma parcela ao mesmo tempo dão um só PagamentoConfirmado, e
 * o segundo fica "em duplicidade" para estorno.
 */
@Injectable()
export class Pagamentos {
  private readonly logger = new Logger(Pagamentos.name);

  constructor(
    private readonly parcelas: RepositorioDeParcelas,
    private readonly cobrancas: RepositorioDeCobrancas,
    private readonly pagamentos: RepositorioDePagamentos,
    private readonly estornos: RepositorioDeEstornos,
    private readonly formas: RepositorioDeFormasDePagamento,
    private readonly alunos: AlunosDaCobranca,
    private readonly referencias: ReferenciasExternas,
    private readonly gateway: GatewayDePagamento,
    private readonly mensageria: Mensageria,
    private readonly publicador: PublicadorDeEventos,
    private readonly atividade: RegistroDeAtividade,
    private readonly relogio: Relogio,
  ) {}

  // ---------- Cobranças ----------

  /** Enviar link de pagamento: reaproveita a cobrança pendente da mesma forma e valor. */
  async enviarLink(parcelaId: string, forma: FormaDeCobranca = 'link'): Promise<Cobranca> {
    const parcela = await this.aReceber(parcelaId);
    const pendente = (await this.cobrancas.pendentesDaParcela(parcela.id)).find(
      (cobranca) => cobranca.forma === forma && cobranca.valorCentavos === saldo(parcela),
    );
    const cobranca = pendente ?? (await this.criarCobranca(parcela, forma));
    await this.enviarAoAluno(parcela, cobranca);
    return cobranca;
  }

  /**
   * Segunda via: cancela as cobranças pendentes da parcela e emite outra pelo saldo, com vencimento
   * a partir de hoje. `doAluno` restringe à parcela do próprio aluno (app).
   */
  async segundaVia(
    parcelaId: string,
    forma: FormaDeCobranca,
    opcoes: { enviar: boolean; doAluno?: string },
  ): Promise<Cobranca> {
    const parcela = await this.aReceber(parcelaId, opcoes.doAluno);
    for (const pendente of await this.cobrancas.pendentesDaParcela(parcela.id)) {
      await this.gateway.cancelar(pendente.idExterno);
      await this.cobrancas.atualizarSituacao(pendente.id, 'cancelada');
    }
    const cobranca = await this.criarCobranca(parcela, forma);
    if (opcoes.enviar) {
      await this.enviarAoAluno(parcela, cobranca);
    }
    return cobranca;
  }

  /**
   * Cobrança em lote (Mensageria, finalidade transacional): a parcela vencida mais antiga de cada
   * aluno. Aluno sem parcela vencida fica de fora.
   */
  async cobrancaEmLote(
    executor: Executor,
    alunoIds: readonly string[],
  ): Promise<{ enviadas: number; semPendencia: string[] }> {
    const hoje = this.relogio.hojeEm(FUSO_PADRAO);
    const semPendencia: string[] = [];
    let enviadas = 0;
    for (const alunoId of new Set(alunoIds)) {
      const vencida = (await this.parcelas.doAluno(alunoId)).find(
        (parcela) => SITUACOES_A_RECEBER.includes(parcela.situacao) && parcela.vencimento < hoje,
      );
      if (!vencida) {
        semPendencia.push(alunoId);
        continue;
      }
      await this.enviarLink(vencida.id);
      enviadas += 1;
    }
    if (enviadas > 0) {
      await this.atividade.registrar(executor, {
        acao: 'enviou-cobranca-em-lote',
        detalhe: `${enviadas} ${enviadas === 1 ? 'cobrança enviada' : 'cobranças enviadas'}`,
      });
    }
    return { enviadas, semPendencia };
  }

  /** Variável `{link}` das mensagens de cobrança (T13d): link da parcela a receber mais antiga. */
  async linkDoAluno(alunoId: string): Promise<string | null> {
    const parcela = (await this.parcelas.doAluno(alunoId)).find((candidata) =>
      SITUACOES_A_RECEBER.includes(candidata.situacao),
    );
    if (!parcela) {
      return null;
    }
    const pendente = (await this.cobrancas.pendentesDaParcela(parcela.id)).find(
      (cobranca) => cobranca.forma === 'link' && cobranca.valorCentavos === saldo(parcela),
    );
    return (pendente ?? (await this.criarCobranca(parcela, 'link'))).dados.url ?? null;
  }

  cobrancasDoAluno(alunoId: string): Promise<Cobranca[]> {
    return this.cobrancas.doAluno(alunoId);
  }

  private async aReceber(parcelaId: string, doAluno?: string): Promise<Parcela> {
    const parcela = await this.parcelas.porId(parcelaId);
    if (!parcela || (doAluno !== undefined && parcela.alunoId !== doAluno) || !parcela.alunoId) {
      throw new NaoEncontradoError('Parcela');
    }
    if (!SITUACOES_A_RECEBER.includes(parcela.situacao) || saldo(parcela) === 0) {
      throw new OperacaoDePagamentoInvalidaError('A parcela não está em aberto.');
    }
    return parcela;
  }

  private async criarCobranca(parcela: Parcela, forma: FormaDeCobranca): Promise<Cobranca> {
    const alunoId = parcela.alunoId as string;
    let tokenDoCartao: string | null = null;
    if (forma === 'cartao') {
      tokenDoCartao = (await this.formas.doAluno(alunoId))?.tokenDoCartao ?? null;
      if (!tokenDoCartao) {
        throw new OperacaoDePagamentoInvalidaError('O aluno não tem cartão cadastrado.');
      }
    }
    const hoje = this.relogio.hojeEm(FUSO_PADRAO);
    const vencimento = parcela.vencimento < hoje ? hoje : parcela.vencimento;
    const id = randomUUID();
    const noProvedor = await this.gateway.criarCobranca({
      referencia: id,
      forma,
      valorCentavos: saldo(parcela),
      vencimento,
      descricao: `Parcela ${parcela.numero}/${parcela.totalDeParcelas}`,
      tokenDoCartao,
    });
    const cobranca = await this.cobrancas.criar({
      id,
      parcelaId: parcela.id,
      alunoId,
      forma,
      valorCentavos: saldo(parcela),
      vencimento,
      provedor: this.gateway.provedor,
      idExterno: noProvedor.idExterno,
      situacao: 'pendente',
      dados: noProvedor.dados,
    });
    await this.referencias.registrar(this.gateway.provedor, noProvedor.idExterno, cobranca.id);
    await this.publicador.publicar({
      tipo: 'CobrancaCriada',
      payload: {
        cobrancaId: cobranca.id,
        alunoId,
        contratoId: parcela.contratoId,
        parcelaId: parcela.id,
        forma,
        valorEmCentavos: cobranca.valorCentavos,
        vencimento,
      },
    });
    return cobranca;
  }

  private async enviarAoAluno(parcela: Parcela, cobranca: Cobranca): Promise<void> {
    const alunoId = parcela.alunoId as string;
    const nome = (await this.alunos.nomes([alunoId])).get(alunoId) ?? '';
    await this.mensageria.enviar({
      alunoId,
      finalidade: 'transacional',
      contexto: 'cobranca',
      variaveis: {
        nome: nome.split(' ')[0] ?? nome,
        valor: formatarBrl(centavos(cobranca.valorCentavos)),
        vencimento: formatarDataBr(parcela.vencimento),
        link: cobranca.dados.url ?? cobranca.dados.pixCopiaECola ?? '',
      },
    });
  }

  // ---------- Pagamentos ----------

  /** Baixa no balcão: dinheiro, PIX ou cartão na maquininha. */
  async registrarNoBalcao(
    executor: Executor | null,
    pedido: PagamentoNoBalcao,
  ): Promise<Pagamento> {
    let parcela: Parcela | null = null;
    if (pedido.parcelaId) {
      parcela = await this.parcelas.travar(pedido.parcelaId);
      if (!parcela || parcela.alunoId !== pedido.alunoId) {
        throw new NaoEncontradoError('Parcela');
      }
      if (saldo(parcela) > 0 && pedido.valorCentavos > saldo(parcela)) {
        throw new OperacaoDePagamentoInvalidaError(
          `O valor passa do saldo da parcela (${formatarBrl(centavos(saldo(parcela)))}).`,
        );
      }
    } else if (!pedido.origem || pedido.origem === 'mensalidade') {
      throw new OperacaoDePagamentoInvalidaError('Pagamento avulso precisa de origem.');
    }
    const pagamento = await this.confirmar(
      {
        parcelaId: pedido.parcelaId,
        cobrancaId: null,
        alunoId: pedido.alunoId,
        valorCentavos: pedido.valorCentavos,
        taxaCentavos: pedido.taxaCentavos ?? 0,
        forma: pedido.forma,
        canal: 'balcao',
        origem: parcela ? 'mensalidade' : (pedido.origem as Origem),
        provedor: null,
        idEventoExterno: null,
        confirmadoEm: this.relogio.agora(),
      },
      parcela,
    );
    if (executor) {
      const nome = (await this.alunos.nomes([pedido.alunoId])).get(pedido.alunoId) ?? 'aluno';
      await this.atividade.registrar(executor, {
        acao: 'registrou-pagamento',
        detalhe: `${nome}: ${formatarBrl(centavos(pedido.valorCentavos))} (${pedido.forma})${pagamento.emDuplicidade ? ', em duplicidade' : ''}`,
      });
    }
    return pagamento;
  }

  /**
   * Webhook do provedor, já com a assinatura conferida e em runAsTenant. Idempotente pelo id do
   * evento: o mesmo evento repetido não duplica o pagamento nem o evento de domínio.
   */
  async aoReceberDoProvedor(evento: EventoDoProvedor): Promise<ResultadoDoProvedor> {
    const provedor = this.gateway.provedor;
    const cobranca = await this.cobrancas.porIdExterno(provedor, evento.idCobranca);
    if (!cobranca) {
      return 'recurso-nao-encontrado';
    }
    if (evento.tipo === 'pagamento_estornado') {
      await this.aoEstornarNoProvedor(cobranca, evento);
      return 'processado';
    }
    if (await this.pagamentos.porEventoExterno(provedor, evento.idEvento)) {
      return 'processado';
    }
    // Trava a parcela e confere de novo: dois webhooks iguais ao mesmo tempo ficam em fila.
    const parcela = cobranca.parcelaId ? await this.parcelas.travar(cobranca.parcelaId) : null;
    if (await this.pagamentos.porEventoExterno(provedor, evento.idEvento)) {
      return 'processado';
    }
    if (!cobranca.alunoId) {
      return 'recurso-nao-encontrado';
    }
    await this.confirmar(
      {
        parcelaId: cobranca.parcelaId,
        cobrancaId: cobranca.id,
        alunoId: cobranca.alunoId,
        valorCentavos: evento.valorCentavos,
        taxaCentavos: evento.taxaCentavos,
        forma: evento.forma,
        canal: 'provedor',
        origem: 'mensalidade',
        provedor,
        idEventoExterno: evento.idEvento,
        confirmadoEm: evento.ocorridoEm,
      },
      parcela,
    );
    return 'processado';
  }

  /** Registra o pagamento; com a parcela já travada pelo chamador quando houver. */
  private async confirmar(dados: DadosDaConfirmacao, parcela: Parcela | null): Promise<Pagamento> {
    const setor = setorDaOrigem(dados.origem);
    const contratoId = parcela?.contratoId ?? null;
    if (parcela && (!SITUACOES_A_RECEBER.includes(parcela.situacao) || saldo(parcela) === 0)) {
      const duplicado = await this.pagamentos.criar({
        ...dados,
        setor,
        contratoId,
        emDuplicidade: true,
      });
      this.logger.warn(
        { pagamentoId: duplicado.id, parcelaId: parcela.id, canal: dados.canal },
        'Pagamento em duplicidade: a parcela já estava quitada; estorne o valor',
      );
      if (dados.cobrancaId) {
        await this.cobrancas.atualizarSituacao(dados.cobrancaId, 'paga');
      }
      return duplicado;
    }
    if (parcela) {
      const resultado = aplicarPagamento(parcela, dados.valorCentavos);
      await this.parcelas.atualizar(parcela.id, {
        pagoCentavos: resultado.pagoCentavos,
        situacao: resultado.situacao,
      });
      if (resultado.situacao === 'paga') {
        await this.cancelarPendentes(parcela.id, dados.cobrancaId);
      }
    }
    const pagamento = await this.pagamentos.criar({
      ...dados,
      setor,
      contratoId,
      emDuplicidade: false,
    });
    if (dados.cobrancaId) {
      await this.cobrancas.atualizarSituacao(dados.cobrancaId, 'paga');
    }
    await this.publicador.publicar({
      tipo: 'PagamentoConfirmado',
      payload: {
        pagamentoId: pagamento.id,
        cobrancaId: dados.cobrancaId,
        parcelaId: dados.parcelaId,
        contratoId,
        alunoId: dados.alunoId,
        valorEmCentavos: dados.valorCentavos,
        taxaEmCentavos: dados.taxaCentavos,
        meio: dados.forma,
        origem: dados.origem,
        setor,
        confirmadoEm: dados.confirmadoEm.toISOString(),
      },
    });
    return pagamento;
  }

  /** Parcela quitada: as outras cobranças pendentes dela deixam de valer. */
  private async cancelarPendentes(parcelaId: string, exceto: string | null): Promise<void> {
    for (const pendente of await this.cobrancas.pendentesDaParcela(parcelaId)) {
      if (pendente.id !== exceto) {
        await this.gateway.cancelar(pendente.idExterno);
        await this.cobrancas.atualizarSituacao(pendente.id, 'cancelada');
      }
    }
  }

  pagamentosDoAluno(alunoId: string): Promise<Pagamento[]> {
    return this.pagamentos.doAluno(alunoId);
  }

  // ---------- Estornos ----------

  /** Estorno total (sem valor) ou parcial; o do provedor passa por ele, o do balcão é devolução. */
  async estornar(
    executor: Executor,
    pagamentoId: string,
    motivo: string,
    valorCentavos?: number,
  ): Promise<Pagamento> {
    const pagamento = await this.pagamentos.porId(pagamentoId);
    if (!pagamento) {
      throw new NaoEncontradoError('Pagamento');
    }
    const calculo = estornar(pagamento, valorCentavos);
    let idEvento: string | null = null;
    if (pagamento.canal === 'provedor' && pagamento.cobrancaId) {
      const cobranca = await this.cobrancas.porId(pagamento.cobrancaId);
      if (cobranca) {
        idEvento = (await this.gateway.estornar(cobranca.idExterno, calculo.valorCentavos))
          .idEstorno;
      }
    }
    const estornado = await this.registrarEstorno(pagamento, {
      valorCentavos: calculo.valorCentavos,
      motivo,
      provedor: idEvento ? this.gateway.provedor : null,
      idEventoExterno: idEvento,
      estornadoEm: this.relogio.agora(),
    });
    const nome = pagamento.alunoId
      ? ((await this.alunos.nomes([pagamento.alunoId])).get(pagamento.alunoId) ?? 'aluno')
      : 'aluno';
    await this.atividade.registrar(executor, {
      acao: 'estornou-pagamento',
      detalhe: `${nome}: ${formatarBrl(centavos(calculo.valorCentavos))} (${motivo.trim()})`,
    });
    return estornado;
  }

  private async aoEstornarNoProvedor(
    cobranca: Cobranca,
    evento: Extract<EventoDoProvedor, { tipo: 'pagamento_estornado' }>,
  ): Promise<void> {
    const provedor = this.gateway.provedor;
    if (await this.estornos.porEventoExterno(provedor, evento.idEvento)) {
      return;
    }
    const pagamento = (await this.pagamentos.daCobranca(cobranca.id)).find(
      (candidato) => candidato.valorCentavos > candidato.estornadoCentavos,
    );
    if (!pagamento) {
      return;
    }
    await this.registrarEstorno(pagamento, {
      valorCentavos: Math.min(
        evento.valorCentavos,
        pagamento.valorCentavos - pagamento.estornadoCentavos,
      ),
      motivo: 'Estorno no provedor',
      provedor,
      idEventoExterno: evento.idEvento,
      estornadoEm: evento.ocorridoEm,
    });
  }

  private async registrarEstorno(
    pagamento: Pagamento,
    estorno: {
      valorCentavos: number;
      motivo: string;
      provedor: string | null;
      idEventoExterno: string | null;
      estornadoEm: Date;
    },
  ): Promise<Pagamento> {
    const calculo = estornar(pagamento, estorno.valorCentavos);
    await this.estornos.criar({ pagamentoId: pagamento.id, ...estorno });
    const atualizado = await this.pagamentos.atualizarEstorno(pagamento.id, {
      estornadoCentavos: calculo.estornadoCentavos,
      situacao: calculo.situacao,
    });
    if (pagamento.parcelaId && !pagamento.emDuplicidade) {
      const parcela = await this.parcelas.travar(pagamento.parcelaId);
      if (parcela) {
        await this.parcelas.atualizar(
          parcela.id,
          estornarNaParcela(parcela, calculo.valorCentavos),
        );
      }
    }
    if (pagamento.alunoId) {
      await this.publicador.publicar({
        tipo: 'PagamentoEstornado',
        payload: {
          pagamentoId: pagamento.id,
          cobrancaId: pagamento.cobrancaId,
          parcelaId: pagamento.parcelaId,
          alunoId: pagamento.alunoId,
          valorEmCentavos: calculo.valorCentavos,
          total: calculo.situacao === 'estornado',
          estornadoEm: estorno.estornadoEm.toISOString(),
        },
      });
    }
    return atualizado;
  }

  // ---------- Forma de pagamento ----------

  formaDoAluno(alunoId: string): Promise<FormaDePagamentoDoAluno | null> {
    return this.formas.doAluno(alunoId);
  }

  /** Troca da forma de pagamento: cartão só com o token do provedor, nunca o número. */
  async trocarFormaDePagamento(
    executor: Executor,
    alunoId: string,
    nova: NovaFormaDePagamento,
  ): Promise<FormaDePagamentoDoAluno> {
    const cartao = nova.forma === 'cartao';
    if (cartao && !nova.tokenDoCartao) {
      throw new OperacaoDePagamentoInvalidaError('Cartão precisa do token do provedor.');
    }
    const salva = await this.formas.salvar({
      alunoId,
      forma: nova.forma,
      tokenDoCartao: cartao ? (nova.tokenDoCartao ?? null) : null,
      finalDoCartao: cartao ? (nova.finalDoCartao ?? null) : null,
      atualizadoEm: this.relogio.agora(),
    });
    const nome = (await this.alunos.nomes([alunoId])).get(alunoId) ?? 'aluno';
    await this.atividade.registrar(executor, {
      acao: 'trocou-forma-de-pagamento',
      detalhe: `${nome}: ${nova.forma}${salva.finalDoCartao ? ` final ${salva.finalDoCartao}` : ''}`,
    });
    return salva;
  }
}
