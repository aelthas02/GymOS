import { Injectable } from '@nestjs/common';
import { PublicadorDeEventos } from '../../platform/application/eventos';
import { type DataCivil, FUSO_PADRAO, Relogio } from '../../platform/domain/relogio';
import {
  avaliarContrato,
  type AvaliacaoDoContrato,
  type ConfiguracaoDeContrato,
  decidirPagamentoAposEncerramento,
  destrancar,
  renovar,
  type SituacaoDeVencimento,
  situacaoDeVencimento,
  trancar,
  validarConfiguracao,
} from '../domain/contrato';
import { fimDaVigencia, fimDoDiaEm } from '../domain/datas';
import type { Plano } from '../domain/plano';
import { type Executor, RegistroDeAtividade } from './autoria';
import { ConflitoError, NaoEncontradoError } from './erros';
import {
  type Contrato,
  ParcelasDoContrato,
  RepositorioDeConfiguracao,
  RepositorioDeContratos,
  RepositorioDePlanos,
  type SituacaoDasParcelas,
} from './portas';

export interface SituacaoDoAluno {
  alunoId: string;
  contrato: Contrato | null;
  avaliacao: AvaliacaoDoContrato | null;
  situacaoDeVencimento: SituacaoDeVencimento;
  /** Fim da vigência às 23:59:59 de São Paulo. */
  vigenteAte: Date | null;
}

/**
 * Ciclo de vida do contrato (ADR-018): adesão, renovação, trancamento, reavaliação pelo atraso da
 * cobrança e reativação por pagamento. Toda transição grava o evento no outbox, na mesma transação.
 */
@Injectable()
export class Contratos {
  constructor(
    private readonly contratos: RepositorioDeContratos,
    private readonly planos: RepositorioDePlanos,
    private readonly configuracao: RepositorioDeConfiguracao,
    private readonly parcelas: ParcelasDoContrato,
    private readonly publicador: PublicadorDeEventos,
    private readonly relogio: Relogio,
  ) {}

  hoje(): DataCivil {
    return this.relogio.hojeEm(FUSO_PADRAO);
  }

  /** Nova adesão: o contrato passa a ser o vigente do aluno, com o valor atual do plano. */
  async aderir(alunoId: string, planoId: string, inicio?: DataCivil): Promise<Contrato> {
    const plano = await this.planos.porId(planoId);
    if (!plano) {
      throw new NaoEncontradoError('Plano');
    }
    if (!plano.ativo) {
      throw new ConflitoError(`O plano ${plano.nome} está inativo para venda.`);
    }
    return this.criarContrato(alunoId, plano, inicio ?? this.hoje());
  }

  private async criarContrato(alunoId: string, plano: Plano, comeco: DataCivil): Promise<Contrato> {
    const planoId = plano.id;
    const contrato = await this.contratos.criar({
      alunoId,
      planoId,
      estado: 'ativo',
      inicio: comeco,
      fim: fimDaVigencia(comeco, plano.duracaoMeses),
      valorTotalCentavos: plano.valorTotalCentavos,
      parcelas: plano.parcelas,
      vencimentoEmAtraso: null,
      proximoVencimento: null,
      encerradoEm: null,
      motivoDoEncerramento: null,
      trancadoDesde: null,
      trancadoAte: null,
    });
    await this.publicador.publicar({
      tipo: 'ContratoCriado',
      payload: {
        contratoId: contrato.id,
        alunoId,
        planoId,
        inicio: comeco,
        valorEmCentavos: plano.valorTotalCentavos,
      },
    });
    return contrato;
  }

  async vigente(alunoId: string): Promise<Contrato> {
    const contrato = await this.contratos.vigenteDoAluno(alunoId);
    if (!contrato) {
      throw new NaoEncontradoError('Contrato');
    }
    return contrato;
  }

  async situacao(alunoId: string): Promise<SituacaoDoAluno> {
    const contrato = await this.contratos.vigenteDoAluno(alunoId);
    const hoje = this.hoje();
    if (!contrato) {
      return {
        alunoId,
        contrato: null,
        avaliacao: null,
        situacaoDeVencimento: 'em_dia',
        vigenteAte: null,
      };
    }
    return {
      alunoId,
      contrato,
      avaliacao: avaliarContrato(contrato, hoje, await this.configuracao.obter()),
      situacaoDeVencimento: situacaoDeVencimento(contrato, hoje),
      vigenteAte: fimDoDiaEm(contrato.fim, FUSO_PADRAO),
    };
  }

  /** Renovação manual, "Renovar com 1 toque" do app e automática: mais um período do plano. */
  async renovar(alunoId: string): Promise<Contrato> {
    const contrato = await this.vigente(alunoId);
    return this.renovarContrato(contrato, this.hoje(), await this.configuracao.obter());
  }

  async trancar(alunoId: string, dias: number): Promise<Contrato> {
    const contrato = await this.vigente(alunoId);
    const hoje = this.hoje();
    const mudanca = trancar(contrato, hoje, dias, await this.configuracao.obter());
    const trancado = await this.contratos.atualizar(contrato.id, mudanca);
    await this.publicador.publicar({
      tipo: 'ContratoTrancado',
      payload: {
        contratoId: contrato.id,
        alunoId,
        inicio: hoje,
        fim: mudanca.trancadoAte ?? hoje,
      },
    });
    return trancado;
  }

  async destrancar(alunoId: string): Promise<Contrato> {
    const contrato = await this.vigente(alunoId);
    return this.destrancarContrato(contrato, this.hoje());
  }

  /** PagamentoAtrasado (T19): guarda o vencimento em atraso e reavalia o estado. */
  async aoAtrasarPagamento(alunoId: string, vencimento: DataCivil): Promise<void> {
    const contrato = await this.contratos.vigenteDoAluno(alunoId);
    if (!contrato) {
      return;
    }
    const doEvento: SituacaoDasParcelas = {
      vencimentoEmAtraso:
        contrato.vencimentoEmAtraso !== null && contrato.vencimentoEmAtraso < vencimento
          ? contrato.vencimentoEmAtraso
          : vencimento,
      proximoVencimento: contrato.proximoVencimento,
    };
    const parcelas = (await this.parcelas.situacao(contrato.id)) ?? doEvento;
    const atualizado = await this.contratos.atualizar(contrato.id, parcelas);
    await this.reavaliar(atualizado, this.hoje(), await this.configuracao.obter());
  }

  /**
   * PagamentoConfirmado (T19): atualiza as parcelas e reavalia. Se o atraso já tinha encerrado o
   * contrato, o pagamento até R dias depois do encerramento reativa o mesmo contrato; depois disso,
   * gera nova adesão no mesmo plano.
   */
  async aoConfirmarPagamento(alunoId: string, pagoEm: DataCivil): Promise<void> {
    const contrato = await this.contratos.vigenteDoAluno(alunoId);
    if (!contrato) {
      return;
    }
    const config = await this.configuracao.obter();
    const antes = avaliarContrato(contrato, pagoEm, config);
    const parcelas = (await this.parcelas.situacao(contrato.id)) ?? {
      vencimentoEmAtraso: null,
      proximoVencimento: contrato.proximoVencimento,
    };
    if (
      antes.estado === 'encerrado' &&
      antes.motivoDoEncerramento === 'atraso' &&
      antes.encerradoEm
    ) {
      if (decidirPagamentoAposEncerramento(antes.encerradoEm, pagoEm, config) === 'nova_adesao') {
        // A nova adesão é no plano do contrato encerrado, mesmo que ele já não esteja à venda.
        const plano = await this.planos.porId(contrato.planoId);
        await this.encerrarSeAindaNao(contrato, antes);
        if (plano) {
          await this.criarContrato(alunoId, plano, pagoEm);
        }
        return;
      }
      await this.contratos.atualizar(contrato.id, {
        ...parcelas,
        estado: 'ativo',
        encerradoEm: null,
        motivoDoEncerramento: null,
      });
      await this.publicador.publicar({
        tipo: 'ContratoReativado',
        payload: { contratoId: contrato.id, alunoId, reativadoEm: pagoEm },
      });
      return;
    }
    const atualizado = await this.contratos.atualizar(contrato.id, parcelas);
    await this.reavaliar(atualizado, this.hoje(), config);
  }

  /**
   * Rotina diária: renova os contratos de plano com renovação automática que chegaram ao fim e grava
   * as transições pelo tempo (Tolerância → Encerrado, fim do trancamento, fim da vigência).
   */
  async rotinaDiaria(): Promise<number> {
    const hoje = this.hoje();
    const config = await this.configuracao.obter();
    let alterados = 0;
    for (const contrato of await this.contratos.vigentesEmAndamento()) {
      let atual = contrato;
      if (hoje > atual.fim && atual.estado !== 'trancado') {
        const plano = await this.planos.porId(atual.planoId);
        const avaliacao = avaliarContrato(atual, hoje, config);
        if (plano?.renovacaoAutomatica && avaliacao.motivoDoEncerramento === 'vigencia') {
          atual = await this.renovarContrato(atual, hoje, config);
        }
      }
      if ((await this.reavaliar(atual, hoje, config)) !== contrato) {
        alterados += 1;
      }
    }
    return alterados;
  }

  /** Grava a transição de estado que o tempo ou o atraso provocou. */
  private async reavaliar(
    contrato: Contrato,
    hoje: DataCivil,
    config: ConfiguracaoDeContrato,
  ): Promise<Contrato> {
    const avaliacao = avaliarContrato(contrato, hoje, config);
    if (contrato.estado === 'trancado' && avaliacao.estado !== 'trancado') {
      return this.destrancarContrato(contrato, hoje);
    }
    if (avaliacao.estado === contrato.estado) {
      return contrato;
    }
    if (avaliacao.estado === 'encerrado') {
      return this.encerrarSeAindaNao(contrato, avaliacao);
    }
    return this.contratos.atualizar(contrato.id, { estado: avaliacao.estado });
  }

  private async encerrarSeAindaNao(
    contrato: Contrato,
    avaliacao: AvaliacaoDoContrato,
  ): Promise<Contrato> {
    if (contrato.estado === 'encerrado') {
      return contrato;
    }
    const encerradoEm = avaliacao.encerradoEm ?? this.hoje();
    const motivo = avaliacao.motivoDoEncerramento ?? 'atraso';
    const encerrado = await this.contratos.atualizar(contrato.id, {
      estado: 'encerrado',
      encerradoEm,
      motivoDoEncerramento: motivo,
    });
    await this.publicador.publicar({
      tipo: 'ContratoEncerrado',
      payload: { contratoId: contrato.id, alunoId: contrato.alunoId, encerradoEm, motivo },
    });
    return encerrado;
  }

  private async destrancarContrato(contrato: Contrato, hoje: DataCivil): Promise<Contrato> {
    const destrancado = await this.contratos.atualizar(contrato.id, destrancar(contrato, hoje));
    await this.publicador.publicar({
      tipo: 'ContratoDestrancado',
      payload: { contratoId: contrato.id, alunoId: contrato.alunoId, destrancadoEm: hoje },
    });
    return destrancado;
  }

  private async renovarContrato(
    contrato: Contrato,
    hoje: DataCivil,
    config: ConfiguracaoDeContrato,
  ): Promise<Contrato> {
    const plano = await this.planos.porId(contrato.planoId);
    if (!plano) {
      throw new NaoEncontradoError('Plano');
    }
    const { fim } = renovar(contrato, hoje, plano.duracaoMeses, config);
    const renovado = await this.contratos.atualizar(contrato.id, {
      fim,
      estado: 'ativo',
      encerradoEm: null,
      motivoDoEncerramento: null,
      valorTotalCentavos: plano.valorTotalCentavos,
    });
    await this.publicador.publicar({
      tipo: 'ContratoRenovado',
      payload: {
        contratoId: contrato.id,
        alunoId: contrato.alunoId,
        novoFim: fim,
        valorEmCentavos: plano.valorTotalCentavos,
      },
    });
    return renovado;
  }
}

/** Bloco "Contratos e atraso" de Configurações (a tela é do T26c). */
@Injectable()
export class ConfiguracaoDosContratos {
  constructor(
    private readonly configuracao: RepositorioDeConfiguracao,
    private readonly atividade: RegistroDeAtividade,
  ) {}

  obter(): Promise<ConfiguracaoDeContrato> {
    return this.configuracao.obter();
  }

  /** Mudança grava a auditoria sensível "Alterou configuração financeira". */
  async salvar(executor: Executor, nova: ConfiguracaoDeContrato): Promise<ConfiguracaoDeContrato> {
    validarConfiguracao(nova);
    const atual = await this.configuracao.obter();
    await this.configuracao.salvar(nova);
    const mudancas = [
      ['Tolerância de atraso', atual.toleranciaDias, nova.toleranciaDias],
      ['Reativar sem nova adesão até', atual.reativacaoDias, nova.reativacaoDias],
      ['Trancamento máximo', atual.trancamentoMaximoDias, nova.trancamentoMaximoDias],
    ] as const;
    const detalhe = mudancas
      .filter(([, de, para]) => de !== para)
      .map(([nome, de, para]) => `${nome}: ${de} para ${para} dias`)
      .join('; ');
    if (detalhe !== '') {
      await this.atividade.registrar(executor, {
        acao: 'alterou-configuracao-financeira',
        detalhe,
      });
    }
    return nova;
  }
}
