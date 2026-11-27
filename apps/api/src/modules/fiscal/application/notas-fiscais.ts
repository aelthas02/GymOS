import { Injectable, Logger } from '@nestjs/common';
import type { PayloadDoEvento } from '@gymos/shared-events';
import { centavos, formatarBrl } from '@gymos/shared-money';
import { validarCpf } from '@gymos/shared-validation';
import { type Executor, RegistroDeAtividade } from '../../alunos/application/autoria';
import { Armazenamento } from '../../integracoes/application/armazenamento';
import { Mensageria } from '../../integracoes/application/mensageria';
import { type DataCivil, Relogio } from '../../platform/domain/relogio';
import {
  cancelamento,
  type Competencia,
  competenciaDe,
  conferirCorrecao,
  conferirReenvio,
  descricaoDaNota,
  ehOrigemDaNota,
  FUSO_FISCAL,
  idDaNotaDoPagamento,
  momentoDaEmissao,
  NOME_DO_TIPO,
  noLote,
  rotuloDoNumero,
  SITUACOES_A_EMITIR,
  type TipoDeNota,
  tipoDaOrigem,
  type TotaisDaNota,
  totaisDaNota,
} from '../domain/nota-fiscal';
import { DadosDaNotaInvalidosError, DadosFiscaisAusentesError, NaoEncontradoError } from './erros';
import {
  AlunosDoFiscal,
  CobrancaDoFiscal,
  type DadosFiscais,
  EmissorFiscal,
  type EventoDoEmissor,
  FalhaDeComunicacaoComOEmissorError,
  FilaDasNotas,
  type FiltroDeNotas,
  type NotaFiscal,
  type PaginaDeNotas,
  type PedidoDeEmissao,
  RepositorioDaConfiguracaoFiscal,
  RepositorioDeNotas,
  type ResultadoNoEmissor,
  type ResumoDasNotas,
} from './portas';

export interface OpcoesDepoisDeEmitir {
  enviarAoAluno: boolean;
  anexarArquivos: boolean;
  registrarNaFicha: boolean;
}

export interface NotaManual extends OpcoesDepoisDeEmitir {
  tipo: TipoDeNota;
  alunoId: string;
  descricao: string;
  valorCentavos: number;
  competencia: Competencia;
  retencoesCentavos?: number;
  /** CPF digitado na tela; sem ele, o do cadastro. */
  cpf?: string;
  parcelaId?: string | null;
  formaDePagamento?: string | null;
}

export interface CorrecaoDaNota {
  cpf?: string;
  descricao?: string;
  valorCentavos?: number;
}

export interface SugestaoDeNota {
  cliente: {
    alunoId: string;
    nome: string;
    cpf: string;
    email: string | null;
    telefone: string | null;
  };
  servico: {
    descricao: string;
    codigoDoServico: string;
    valorCentavos: number;
    competencia: Competencia;
    parcelaId: string | null;
    formaDePagamento: string | null;
  };
  dataDeEmissao: DataCivil;
  resumo: TotaisDaNota;
  dadosFiscaisConferidos: boolean;
}

export interface PreviaDaNota extends TotaisDaNota {
  codigoDoServico: string;
  dadosFiscaisConferidos: boolean;
}

export type CanalDoEnvio = 'email' | 'whatsapp';

const TITULAR_REMOVIDO = 'Titular removido';
const VALIDADE_DO_LINK_EM_SEGUNDOS = 3600;

/**
 * Notas fiscais (T20, ADR-008). A emissão é síncrona na transação de quem pede (requisição, consumidor
 * de evento ou job), com a nota travada: antes de reenviar uma nota que pode estar no emissor, consulta
 * pela chave (o id da nota) e só emite se o emissor não a conhece. Sem resposta do emissor, a nota fica
 * "processando" e um job volta a consultar; nunca há segunda emissão da mesma nota.
 */
@Injectable()
export class NotasFiscais {
  private readonly logger = new Logger(NotasFiscais.name);

  constructor(
    private readonly notas: RepositorioDeNotas,
    private readonly configuracao: RepositorioDaConfiguracaoFiscal,
    private readonly alunos: AlunosDoFiscal,
    private readonly cobranca: CobrancaDoFiscal,
    private readonly emissor: EmissorFiscal,
    private readonly fila: FilaDasNotas,
    private readonly armazenamento: Armazenamento,
    private readonly mensageria: Mensageria,
    private readonly auditoria: RegistroDeAtividade,
    private readonly relogio: Relogio,
  ) {}

  hoje(): DataCivil {
    return this.relogio.hojeEm(FUSO_FISCAL);
  }

  competenciaAtual(): Competencia {
    return competenciaDe(this.relogio.agora());
  }

  // ---------- Emissão automática ----------

  /**
   * Consumidor de PagamentoConfirmado: cria a nota do pagamento (uma por pagamento e tipo, pela
   * constraint) e emite conforme a regra "Quando emitir". Reentrega não cria outra nota.
   */
  async registrarDoPagamento(
    tenantId: string,
    pagamento: PayloadDoEvento<'PagamentoConfirmado'>,
  ): Promise<NotaFiscal | null> {
    if (!ehOrigemDaNota(pagamento.origem)) {
      this.logger.warn({ origem: pagamento.origem }, 'Pagamento de origem sem nota fiscal');
      return null;
    }
    const origem = pagamento.origem;
    const tipo = tipoDaOrigem(origem);
    if (pagamento.parcelaId) {
      // Nota emitida à mão antes do pagamento (mensalidade em aberto): só liga ao pagamento.
      const manual = await this.notas.daParcelaSemPagamento(pagamento.parcelaId, tipo);
      if (manual && manual.situacao !== 'cancelada') {
        return this.notas.atualizar(manual.id, { pagamentoId: pagamento.pagamentoId });
      }
    }
    const config = await this.configuracao.obter();
    const tomador = await this.alunos.tomador(pagamento.alunoId);
    const competencia = competenciaDe(new Date(pagamento.confirmadoEm));
    const plano = await this.alunos.plano(pagamento.alunoId);
    const totais = totaisDaNota(pagamento.valorEmCentavos, config?.aliquotaIssPontosBase ?? 0);
    const nota = await this.notas.criar({
      id: idDaNotaDoPagamento(tenantId, pagamento.pagamentoId, tipo),
      tipo,
      pagamentoId: pagamento.pagamentoId,
      parcelaId: pagamento.parcelaId,
      alunoId: pagamento.alunoId,
      origem,
      tomadorNome: tomador?.nome ?? TITULAR_REMOVIDO,
      tomadorCpf: tomador?.cpf ?? null,
      descricao: descricaoDaNota(origem, competencia, plano),
      codigoDoServico: config?.codigoDoServico ?? '',
      competencia,
      valorCentavos: totais.valorCentavos,
      aliquotaIssPontosBase: totais.aliquotaIssPontosBase,
      issCentavos: totais.issCentavos,
      retencoesCentavos: totais.retencoesCentavos,
      formaDePagamento: pagamento.meio,
      enviarAoAluno: config?.enviarAoAluno ?? false,
      anexarArquivos: true,
      registradaNaFicha: true,
    });
    if (!nota) {
      return null;
    }
    if (config && momentoDaEmissao(config, tipo) === 'agora') {
      return this.processar(nota.id);
    }
    return nota;
  }

  /** Consumidor de PagamentoEstornado: o estorno total cancela a nota do pagamento. */
  async aoEstornar(estorno: PayloadDoEvento<'PagamentoEstornado'>): Promise<number> {
    if (!estorno.total) {
      this.logger.warn(
        { pagamentoId: estorno.pagamentoId },
        'Estorno parcial: a nota continua emitida (precisa de nota de substituição)',
      );
      return 0;
    }
    let canceladas = 0;
    for (const { id } of await this.notas.doPagamento(estorno.pagamentoId)) {
      const nota = await this.travar(id);
      if (nota.situacao === 'cancelada') {
        continue;
      }
      await this.cancelarTravada(nota, 'Pagamento estornado');
      canceladas++;
    }
    return canceladas;
  }

  /** Regra "em lote no fim do mês": agenda a emissão das NFS-e pendentes que já chegaram à hora. */
  async emitirLote(agora: Date = this.relogio.agora()): Promise<number> {
    const config = await this.configuracao.obter();
    if (!config?.emitirEmLote) {
      return 0;
    }
    const pendentes = (await this.notas.pendentesDoLote(competenciaDe(agora))).filter((nota) =>
      noLote(nota.competencia, agora),
    );
    for (const nota of pendentes) {
      await this.fila.emitir(nota.id);
    }
    return pendentes.length;
  }

  // ---------- Casos de uso do painel ----------

  async emitirManual(executor: Executor, dados: NotaManual): Promise<NotaFiscal> {
    const config = await this.dadosFiscais();
    const tomador = await this.alunos.tomador(dados.alunoId);
    if (!tomador) {
      throw new NaoEncontradoError('Aluno');
    }
    const cpf = dados.cpf ? soDigitos(dados.cpf) : tomador.cpf;
    if (!validarCpf(cpf)) {
      throw new DadosDaNotaInvalidosError('CPF inválido.');
    }
    if (dados.valorCentavos <= 0) {
      throw new DadosDaNotaInvalidosError('O valor da nota precisa ser maior que zero.');
    }
    const totais = totaisDaNota(
      dados.valorCentavos,
      config.aliquotaIssPontosBase,
      dados.retencoesCentavos ?? 0,
    );
    const criada = await this.notas.criar({
      tipo: dados.tipo,
      pagamentoId: null,
      parcelaId: dados.parcelaId ?? null,
      alunoId: dados.alunoId,
      origem: null,
      tomadorNome: tomador.nome,
      tomadorCpf: cpf,
      descricao: dados.descricao.trim(),
      codigoDoServico: config.codigoDoServico,
      competencia: dados.competencia,
      valorCentavos: totais.valorCentavos,
      aliquotaIssPontosBase: totais.aliquotaIssPontosBase,
      issCentavos: totais.issCentavos,
      retencoesCentavos: totais.retencoesCentavos,
      formaDePagamento: dados.formaDePagamento ?? null,
      enviarAoAluno: dados.enviarAoAluno,
      anexarArquivos: dados.anexarArquivos,
      registradaNaFicha: dados.registrarNaFicha,
    });
    if (!criada) {
      throw new Error('Nota manual sem pagamento não pode colidir.');
    }
    const nota = await this.processar(criada.id);
    await this.auditoria.registrar(executor, {
      acao: 'emitiu-nota-fiscal',
      detalhe: `${NOME_DO_TIPO[nota.tipo]} de ${formatarBrl(centavos(nota.valorCentavos))}: ${nota.tomadorNome}`,
    });
    return nota;
  }

  /** "Emitir" (pendente) e "Reenviar" (rejeitada ou sem resposta): consulta antes de reemitir. */
  async reenviar(executor: Executor, id: string): Promise<NotaFiscal> {
    const nota = await this.travar(id);
    conferirReenvio(nota.situacao);
    if (nota.situacao === 'rejeitada') {
      await this.notas.atualizar(id, { situacao: 'pendente' });
    }
    const resultado = await this.processar(id);
    await this.auditoria.registrar(executor, {
      acao: 'emitiu-nota-fiscal',
      detalhe: `Reenvio da ${NOME_DO_TIPO[nota.tipo]}: ${nota.tomadorNome}`,
    });
    return resultado;
  }

  /** "Corrigir": troca CPF, descrição ou valor da rejeitada (ou pendente) e reenvia. */
  async corrigir(executor: Executor, id: string, correcao: CorrecaoDaNota): Promise<NotaFiscal> {
    const nota = await this.travar(id);
    conferirCorrecao(nota.situacao);
    const cpf = correcao.cpf === undefined ? nota.tomadorCpf : soDigitos(correcao.cpf);
    if (!cpf || !validarCpf(cpf)) {
      throw new DadosDaNotaInvalidosError('CPF inválido.');
    }
    const valor = correcao.valorCentavos ?? nota.valorCentavos;
    if (valor <= 0) {
      throw new DadosDaNotaInvalidosError('O valor da nota precisa ser maior que zero.');
    }
    const totais = totaisDaNota(valor, nota.aliquotaIssPontosBase, nota.retencoesCentavos);
    await this.notas.atualizar(id, {
      situacao: 'pendente',
      tomadorCpf: cpf,
      descricao: correcao.descricao?.trim() || nota.descricao,
      valorCentavos: totais.valorCentavos,
      issCentavos: totais.issCentavos,
      motivoDaRejeicao: null,
    });
    const resultado = await this.processar(id);
    await this.auditoria.registrar(executor, {
      acao: 'corrigiu-nota-fiscal',
      detalhe: `${NOME_DO_TIPO[nota.tipo]} de ${nota.tomadorNome}${nota.motivoDaRejeicao ? `: ${nota.motivoDaRejeicao}` : ''}`,
    });
    return resultado;
  }

  async cancelar(executor: Executor, id: string, motivo: string): Promise<NotaFiscal> {
    const nota = await this.travar(id);
    const cancelada = await this.cancelarTravada(nota, motivo.trim());
    await this.auditoria.registrar(executor, {
      acao: 'cancelou-nota-fiscal',
      detalhe: `${rotuloDoNumero(nota.tipo, nota.numero) ?? NOME_DO_TIPO[nota.tipo]} de ${nota.tomadorNome}: ${motivo.trim()}`,
    });
    return cancelada;
  }

  /** Envia a nota emitida ao aluno (finalidade transacional), com os links do PDF e do XML. */
  async enviarAoAluno(
    id: string,
    opcoes: { canais?: readonly CanalDoEnvio[]; anexarArquivos?: boolean } = {},
  ): Promise<{ enviadaPor: CanalDoEnvio[] }> {
    const nota = await this.obter(id);
    if (nota.situacao !== 'emitida') {
      throw new DadosDaNotaInvalidosError('Só a nota emitida pode ser enviada ao aluno.');
    }
    return this.enviar(nota, opcoes.canais ?? ['email', 'whatsapp'], opcoes.anexarArquivos ?? true);
  }

  async registrarNaFicha(id: string): Promise<NotaFiscal> {
    await this.obter(id);
    return this.notas.atualizar(id, { registradaNaFicha: true });
  }

  // ---------- Leituras ----------

  async obter(id: string): Promise<NotaFiscal> {
    const nota = await this.notas.porId(id);
    if (!nota) {
      throw new NaoEncontradoError('Nota fiscal');
    }
    return nota;
  }

  listar(
    filtro: FiltroDeNotas,
    paginacao: { limite: number; cursor?: string },
  ): Promise<PaginaDeNotas> {
    return this.notas.listar(filtro, paginacao);
  }

  resumo(competencia: Competencia): Promise<ResumoDasNotas> {
    return this.notas.resumo(competencia);
  }

  /** "Precisa de atenção": rejeitadas, pendentes e em processamento, de qualquer mês. */
  async atencao(limite: number): Promise<NotaFiscal[]> {
    const { itens } = await this.notas.listar(
      { situacoes: ['rejeitada', 'pendente', 'processando'] },
      { limite },
    );
    return itens;
  }

  /** Notas registradas na ficha do aluno ("Aparece no financeiro dele"). */
  async daFicha(alunoId: string): Promise<NotaFiscal[]> {
    return (await this.notas.doAluno(alunoId)).filter((nota) => nota.registradaNaFicha);
  }

  async urlDoArquivo(id: string, arquivo: 'pdf' | 'xml'): Promise<{ url: string; expiraEm: Date }> {
    const nota = await this.obter(id);
    const chave = arquivo === 'pdf' ? nota.pdfChave : nota.xmlChave;
    if (!chave) {
      throw new NaoEncontradoError('Arquivo da nota');
    }
    return this.armazenamento.urlAssinada(chave);
  }

  /** Resumo da tela Emitir: o ISS vem calculado daqui, nunca do front. */
  async previa(valorCentavos: number, retencoesCentavos = 0): Promise<PreviaDaNota> {
    const config = await this.configuracao.obter();
    return {
      ...totaisDaNota(valorCentavos, config?.aliquotaIssPontosBase ?? 0, retencoesCentavos),
      codigoDoServico: config?.codigoDoServico ?? '',
      dadosFiscaisConferidos: config !== null,
    };
  }

  /** Preenche a tela Emitir: cliente do cadastro e serviço da mensalidade em aberto. */
  async sugestao(alunoId: string, tipo: TipoDeNota): Promise<SugestaoDeNota> {
    const tomador = await this.alunos.tomador(alunoId);
    if (!tomador) {
      throw new NaoEncontradoError('Aluno');
    }
    const config = await this.configuracao.obter();
    const mensalidade = tipo === 'nfse' ? await this.cobranca.mensalidadeEmAberto(alunoId) : null;
    const competencia = mensalidade
      ? (mensalidade.vencimento.slice(0, 7) as Competencia)
      : this.competenciaAtual();
    const valorCentavos = mensalidade?.saldoCentavos ?? 0;
    const descricao = mensalidade
      ? descricaoDaNota('mensalidade', competencia, await this.alunos.plano(alunoId))
      : '';
    return {
      cliente: { alunoId, ...tomador },
      servico: {
        descricao,
        codigoDoServico: config?.codigoDoServico ?? '',
        valorCentavos,
        competencia,
        parcelaId: mensalidade?.parcelaId ?? null,
        formaDePagamento: await this.cobranca.formaPreferida(alunoId),
      },
      dataDeEmissao: this.hoje(),
      resumo: totaisDaNota(valorCentavos, config?.aliquotaIssPontosBase ?? 0),
      dadosFiscaisConferidos: config !== null,
    };
  }

  // ---------- Emissor ----------

  /**
   * Emite a nota travada, se ainda estiver a emitir. A que já passou pelo emissor (processando ou
   * reenviada) é consultada pela chave primeiro: o emissor que a conhece manda o resultado; só a
   * desconhecida (ou a rejeitada que foi corrigida) vai de novo.
   */
  async processar(id: string): Promise<NotaFiscal> {
    const nota = await this.travar(id);
    if (!SITUACOES_A_EMITIR.includes(nota.situacao)) {
      return nota;
    }
    const config = await this.dadosFiscais();
    if (nota.situacao === 'processando' || nota.tentativas > 0) {
      const consulta = await this.semFalhaDeComunicacao(() => this.emissor.consultar(nota.id));
      if (!consulta) {
        return this.aguardar(nota);
      }
      const conhecida = consulta.situacao !== 'desconhecida' && consulta.situacao !== 'rejeitada';
      if (conhecida || (consulta.situacao === 'rejeitada' && nota.situacao === 'processando')) {
        return this.aplicar(nota, consulta);
      }
    }
    const totais = totaisDaNota(
      nota.valorCentavos,
      config.aliquotaIssPontosBase,
      nota.retencoesCentavos,
    );
    const aEmitir = await this.notas.atualizar(nota.id, {
      tentativas: nota.tentativas + 1,
      aliquotaIssPontosBase: totais.aliquotaIssPontosBase,
      issCentavos: totais.issCentavos,
    });
    const resultado = await this.semFalhaDeComunicacao(() =>
      this.emissor.emitir(this.pedido(aEmitir, config, totais)),
    );
    return resultado ? this.aplicar(aEmitir, resultado) : this.aguardar(aEmitir);
  }

  /** Webhook do emissor (resultado assíncrono): aplica na nota travada, se ainda estiver em aberto. */
  async aoReceberDoEmissor(
    evento: EventoDoEmissor,
  ): Promise<'processado' | 'recurso-nao-encontrado'> {
    const nota = await this.notas.travar(evento.chave);
    if (!nota) {
      return 'recurso-nao-encontrado';
    }
    if (
      SITUACOES_A_EMITIR.includes(nota.situacao) &&
      evento.resultado.situacao !== 'desconhecida'
    ) {
      await this.aplicar(nota, evento.resultado);
    }
    return 'processado';
  }

  private pedido(nota: NotaFiscal, config: DadosFiscais, totais: TotaisDaNota): PedidoDeEmissao {
    return {
      chave: nota.id,
      tipo: nota.tipo,
      prestador: {
        razaoSocial: config.razaoSocial,
        cnpj: config.cnpj,
        regime: config.regime,
        municipio: config.municipio,
      },
      tomador: { nome: nota.tomadorNome, cpf: nota.tomadorCpf, email: null },
      descricao: nota.descricao,
      codigoDoServico: nota.codigoDoServico || config.codigoDoServico,
      competencia: nota.competencia,
      valorCentavos: totais.valorCentavos,
      aliquotaIssPontosBase: totais.aliquotaIssPontosBase,
      issCentavos: totais.issCentavos,
      retencoesCentavos: totais.retencoesCentavos,
    };
  }

  private async aplicar(nota: NotaFiscal, resultado: ResultadoNoEmissor): Promise<NotaFiscal> {
    switch (resultado.situacao) {
      case 'emitida': {
        const pasta = 'notas-fiscais';
        const pdf = await this.armazenamento.enviar({
          pasta,
          nome: 'nota.pdf',
          tipo: 'application/pdf',
          conteudo: resultado.pdf,
        });
        const xml = await this.armazenamento.enviar({
          pasta,
          nome: 'nota.xml',
          tipo: 'application/xml',
          conteudo: Buffer.from(resultado.xml, 'utf-8'),
        });
        const emitida = await this.notas.atualizar(nota.id, {
          situacao: 'emitida',
          numero: resultado.numero,
          emitidaEm: resultado.emitidaEm,
          motivoDaRejeicao: null,
          pdfChave: pdf.chave,
          xmlChave: xml.chave,
        });
        if (emitida.enviarAoAluno && emitida.alunoId && !emitida.enviadaAoAlunoEm) {
          await this.enviar(emitida, ['email', 'whatsapp'], emitida.anexarArquivos);
        }
        return this.obter(nota.id);
      }
      case 'rejeitada':
        return this.notas.atualizar(nota.id, {
          situacao: 'rejeitada',
          motivoDaRejeicao: resultado.motivo,
        });
      case 'cancelada':
        return this.notas.atualizar(nota.id, { situacao: 'cancelada' });
      default:
        return this.aguardar(nota);
    }
  }

  /** Sem resultado ainda: fica "processando" e um job volta a consultar o emissor. */
  private async aguardar(nota: NotaFiscal): Promise<NotaFiscal> {
    const atualizada = await this.notas.atualizar(nota.id, { situacao: 'processando' });
    await this.fila.conferirDepois(nota.id, atualizada.tentativas);
    return atualizada;
  }

  private async cancelarTravada(nota: NotaFiscal, motivo: string): Promise<NotaFiscal> {
    if (cancelamento(nota.situacao) === 'no-emissor') {
      await this.emissor.cancelar(nota.id, motivo);
    }
    return this.notas.atualizar(nota.id, {
      situacao: 'cancelada',
      motivoDoCancelamento: motivo,
      canceladaEm: this.relogio.agora(),
    });
  }

  private async enviar(
    nota: NotaFiscal,
    canais: readonly CanalDoEnvio[],
    anexar: boolean,
  ): Promise<{ enviadaPor: CanalDoEnvio[] }> {
    if (!nota.alunoId) {
      return { enviadaPor: [] };
    }
    const rotulo = rotuloDoNumero(nota.tipo, nota.numero) ?? '';
    const linhas = [
      `Olá, {nome}! Sua ${NOME_DO_TIPO[nota.tipo]} ${rotulo} de ${formatarBrl(centavos(nota.valorCentavos))} (${nota.descricao}) foi emitida.`,
    ];
    if (anexar) {
      for (const [nome, chave] of [
        ['PDF', nota.pdfChave],
        ['XML', nota.xmlChave],
      ] as const) {
        if (chave) {
          const { url } = await this.armazenamento.urlAssinada(chave, VALIDADE_DO_LINK_EM_SEGUNDOS);
          linhas.push(`${nome}: ${url}`);
        }
      }
    }
    const enviadaPor: CanalDoEnvio[] = [];
    for (const canal of canais) {
      const resultado = await this.mensageria.enviar({
        alunoId: nota.alunoId,
        finalidade: 'transacional',
        modelo: linhas.join('\n'),
        assunto: `Sua nota fiscal ${rotulo}`.trim(),
        canal,
      });
      if (resultado.enviada) {
        enviadaPor.push(canal);
      }
    }
    if (enviadaPor.length > 0) {
      await this.notas.atualizar(nota.id, { enviadaAoAlunoEm: this.relogio.agora() });
    }
    return { enviadaPor };
  }

  private async semFalhaDeComunicacao(
    chamada: () => Promise<ResultadoNoEmissor>,
  ): Promise<ResultadoNoEmissor | null> {
    try {
      return await chamada();
    } catch (err) {
      if (err instanceof FalhaDeComunicacaoComOEmissorError) {
        this.logger.warn({ err }, 'Emissor fiscal sem resposta; a nota será conferida depois');
        return null;
      }
      throw err;
    }
  }

  private async travar(id: string): Promise<NotaFiscal> {
    const nota = await this.notas.travar(id);
    if (!nota) {
      throw new NaoEncontradoError('Nota fiscal');
    }
    return nota;
  }

  private async dadosFiscais(): Promise<DadosFiscais> {
    const config = await this.configuracao.obter();
    if (!config) {
      throw new DadosFiscaisAusentesError();
    }
    return config;
  }
}

const soDigitos = (texto: string): string => texto.replace(/\D/g, '');
