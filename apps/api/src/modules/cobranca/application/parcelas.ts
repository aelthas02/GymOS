import { Injectable } from '@nestjs/common';
import { formatarDataBr } from '@gymos/shared-pipes/formatadores';
import { type Executor, RegistroDeAtividade } from '../../alunos/application/autoria';
import { PublicadorDeEventos } from '../../platform/application/eventos';
import { type DataCivil, FUSO_PADRAO, Relogio } from '../../platform/domain/relogio';
import {
  combinarNovaData,
  cronograma,
  deveSuspender,
  diasDeAtrasoDaParcela,
  type Parcela,
  reprogramar,
  saldo,
  SITUACOES_A_RECEBER,
  venceu,
} from '../domain/parcela';
import { NaoEncontradoError } from './erros';
import { AlunosDaCobranca, RepositorioDeParcelas, RepositorioDePagamentos } from './portas';

export interface SituacaoDasParcelasDoContrato {
  /** Vencimento da parcela a receber mais antiga já vencida. */
  vencimentoEmAtraso: DataCivil | null;
  /** Próxima parcela a receber que ainda não venceu. */
  proximoVencimento: DataCivil | null;
}

export interface PeriodoDoContrato {
  contratoId: string;
  alunoId: string;
  inicio: DataCivil;
  valorEmCentavos: number;
  parcelas: number;
}

export type Pendencia =
  | {
      tipo: 'mensalidade_em_atraso';
      titulo: 'Mensalidade em atraso';
      alunoId: string;
      alunoNome: string;
      parcelaId: string;
      vencimento: DataCivil;
      saldoCentavos: number;
      diasDeAtraso: number;
    }
  | {
      tipo: 'pagamento_em_duplicidade';
      titulo: 'Pagamento em duplicidade';
      alunoId: string;
      alunoNome: string;
      pagamentoId: string;
      parcelaId: string | null;
      valorCentavos: number;
      confirmadoEm: Date;
    };

/**
 * Cronograma, atraso e datas das parcelas (T19, ADR-018). As transições gravam o evento no outbox,
 * na mesma transação.
 */
@Injectable()
export class Parcelas {
  constructor(
    private readonly parcelas: RepositorioDeParcelas,
    private readonly pagamentos: RepositorioDePagamentos,
    private readonly alunos: AlunosDaCobranca,
    private readonly publicador: PublicadorDeEventos,
    private readonly atividade: RegistroDeAtividade,
    private readonly relogio: Relogio,
  ) {}

  hoje(): DataCivil {
    return this.relogio.hojeEm(FUSO_PADRAO);
  }

  /** ContratoCriado e ContratoRenovado: o cronograma do período. Idempotente. */
  gerar(periodo: PeriodoDoContrato): Promise<number> {
    return this.parcelas.criarCronograma(
      { contratoId: periodo.contratoId, alunoId: periodo.alunoId, periodo: periodo.inicio },
      cronograma(periodo.inicio, periodo.valorEmCentavos, periodo.parcelas),
    );
  }

  async obter(id: string): Promise<Parcela> {
    const parcela = await this.parcelas.porId(id);
    if (!parcela) {
      throw new NaoEncontradoError('Parcela');
    }
    return parcela;
  }

  doAluno(alunoId: string): Promise<Parcela[]> {
    return this.parcelas.doAluno(alunoId);
  }

  /** Porta `ParcelasDoContrato` do domínio alunos; `null` quando o contrato não tem parcelas. */
  async situacaoDoContrato(contratoId: string): Promise<SituacaoDasParcelasDoContrato | null> {
    const parcelas = await this.parcelas.doContrato(contratoId);
    if (parcelas.length === 0) {
      return null;
    }
    const hoje = this.hoje();
    const aReceber = parcelas
      .filter((parcela) => SITUACOES_A_RECEBER.includes(parcela.situacao))
      .map((parcela) => parcela.vencimento)
      .sort();
    return {
      vencimentoEmAtraso: aReceber.find((vencimento) => vencimento < hoje) ?? null,
      proximoVencimento: aReceber.find((vencimento) => vencimento >= hoje) ?? null,
    };
  }

  /** ContratoTrancado: suspende as parcelas a receber que vencem a partir do trancamento. */
  async suspender(contratoId: string, desde: DataCivil): Promise<number> {
    const suspensas = (await this.parcelas.doContrato(contratoId)).filter((parcela) =>
      deveSuspender(parcela, desde),
    );
    for (const parcela of suspensas) {
      await this.parcelas.atualizar(parcela.id, { situacao: 'suspensa', suspensaDesde: desde });
    }
    return suspensas.length;
  }

  /** ContratoDestrancado: as suspensas voltam, adiadas pelos dias de trancamento. */
  async reprogramar(contratoId: string, destrancadoEm: DataCivil): Promise<number> {
    const suspensas = (await this.parcelas.doContrato(contratoId)).filter(
      (parcela) => parcela.situacao === 'suspensa',
    );
    for (const parcela of suspensas) {
      await this.parcelas.atualizar(parcela.id, reprogramar(parcela, destrancadoEm));
    }
    return suspensas.length;
  }

  /** Combinar nova data: adia o vencimento, zera o atraso e grava a auditoria. */
  async combinarNovaData(
    executor: Executor,
    parcelaId: string,
    novoVencimento: DataCivil,
    motivo?: string,
  ): Promise<Parcela> {
    const parcela = await this.parcelas.travar(parcelaId);
    if (!parcela) {
      throw new NaoEncontradoError('Parcela');
    }
    const atualizada = await this.parcelas.atualizar(
      parcela.id,
      combinarNovaData(parcela, novoVencimento, this.hoje()),
    );
    const nome = parcela.alunoId
      ? ((await this.alunos.nomes([parcela.alunoId])).get(parcela.alunoId) ?? 'aluno')
      : 'aluno';
    const detalhe = `${nome}: parcela ${parcela.numero}/${parcela.totalDeParcelas} de ${formatarDataBr(parcela.vencimento)} para ${formatarDataBr(novoVencimento)}`;
    await this.atividade.registrar(executor, {
      acao: 'combinou-nova-data',
      detalhe: motivo?.trim() ? `${detalhe} (${motivo.trim()})` : detalhe,
    });
    if (parcela.alunoId) {
      await this.publicador.publicar({
        tipo: 'VencimentoCombinado',
        payload: {
          parcelaId: parcela.id,
          contratoId: parcela.contratoId,
          alunoId: parcela.alunoId,
          vencimentoAnterior: parcela.vencimento,
          novoVencimento,
        },
      });
    }
    return atualizada;
  }

  /**
   * Rotina diária (00:05 de São Paulo): parcela em aberto vencida vira atrasada e publica
   * PagamentoAtrasado. Suspensas não atrasam. Idempotente: a atrasada não volta a publicar.
   */
  async marcarAtrasos(): Promise<number> {
    const hoje = this.hoje();
    let marcadas = 0;
    for (const parcela of await this.parcelas.vencidasEmAberto(hoje)) {
      if (!venceu(parcela, hoje) || !parcela.alunoId) {
        continue;
      }
      await this.parcelas.atualizar(parcela.id, { situacao: 'atrasada' });
      await this.publicador.publicar({
        tipo: 'PagamentoAtrasado',
        payload: {
          parcelaId: parcela.id,
          contratoId: parcela.contratoId,
          alunoId: parcela.alunoId,
          vencimento: parcela.vencimento,
          valorEmCentavos: saldo(parcela),
        },
      });
      marcadas += 1;
    }
    return marcadas;
  }

  /**
   * Provedor de pendências (T18): "Mensalidade em atraso" de cada parcela vencida e o alerta de
   * pagamento em duplicidade a estornar.
   */
  async pendencias(): Promise<Pendencia[]> {
    const hoje = this.hoje();
    const vencidas = (await this.parcelas.comSituacao(SITUACOES_A_RECEBER)).filter(
      (parcela) => parcela.alunoId && diasDeAtrasoDaParcela(parcela, hoje) > 0,
    );
    const duplicados = (await this.pagamentos.emDuplicidadeAEstornar()).filter(
      (pagamento) => pagamento.alunoId,
    );
    const nomes = await this.alunos.nomes([
      ...vencidas.map((parcela) => parcela.alunoId as string),
      ...duplicados.map((pagamento) => pagamento.alunoId as string),
    ]);
    return [
      ...duplicados.map((pagamento): Pendencia => ({
        tipo: 'pagamento_em_duplicidade',
        titulo: 'Pagamento em duplicidade',
        alunoId: pagamento.alunoId as string,
        alunoNome: nomes.get(pagamento.alunoId as string) ?? '',
        pagamentoId: pagamento.id,
        parcelaId: pagamento.parcelaId,
        valorCentavos: pagamento.valorCentavos,
        confirmadoEm: pagamento.confirmadoEm,
      })),
      ...vencidas.map((parcela): Pendencia => ({
        tipo: 'mensalidade_em_atraso',
        titulo: 'Mensalidade em atraso',
        alunoId: parcela.alunoId as string,
        alunoNome: nomes.get(parcela.alunoId as string) ?? '',
        parcelaId: parcela.id,
        vencimento: parcela.vencimento,
        saldoCentavos: saldo(parcela),
        diasDeAtraso: diasDeAtrasoDaParcela(parcela, hoje),
      })),
    ];
  }
}
