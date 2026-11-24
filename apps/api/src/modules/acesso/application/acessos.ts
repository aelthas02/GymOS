import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  type DecisaoDeAcesso,
  type DirecaoDeAcesso,
  type MetodoDeAcesso,
  type MotivoDeNegacao,
  type ResultadoDeAcesso,
  MOTIVOS_DE_NEGACAO,
  avaliarAcesso,
  diaEmSaoPaulo,
  rotuloDoMotivo,
  segundaDaSemana,
  consolidarAcessosOffline,
} from '@gymos/shared-acesso';
import { PublicadorDeEventos } from '../../platform/application/eventos';
import { type DataCivil, Relogio } from '../../platform/domain/relogio';
import { type Executor, AutoriaDoAcesso } from './autoria';
import { NaoEncontradoError, RegistroDeAcessoInvalidoError } from './erros';
import {
  type Acesso,
  AlunosParaAcesso,
  RepositorioDeAcessos,
  RepositorioDeConfiguracaoDeAcesso,
} from './portas';
import { QrDeCheckin } from './qr';

/** Atraso máximo aceito entre o relógio do agente e o da API num acesso offline (relógio adiantado). */
const FOLGA_DE_RELOGIO_MS = 5 * 60 * 1000;

export interface PedidoDeRegistro {
  /** Gerado na origem; sem ele, a API gera um. Reenviar o mesmo id não grava de novo. */
  idDeOrigem?: string;
  alunoId: string | null;
  metodo: MetodoDeAcesso;
  direcao: DirecaoDeAcesso;
  /** Modalidade do ponto de acesso (ex.: `Lutas`); nula é a entrada geral. */
  modalidade?: string | null;
  dispositivoId?: string | null;
  unidadeId?: string;
  registradoPor?: string | null;
  observacao?: string | null;
}

export interface ResultadoDoRegistro {
  acesso: Acesso;
  /** `true` quando o `idDeOrigem` já tinha sido gravado: nada mudou. */
  repetido: boolean;
  /** Texto do motivo para mostrar na tela ("Mensalidade em atraso"). */
  motivoTexto: string | null;
}

export interface RegistroOffline {
  idDeOrigem: string;
  alunoId: string | null;
  metodo: MetodoDeAcesso;
  direcao: DirecaoDeAcesso;
  resultado: ResultadoDeAcesso;
  motivo?: MotivoDeNegacao | null;
  modalidade?: string | null;
  dispositivoId?: string | null;
  registradoEm: Date;
  /** Nonce do QR usado offline: a API o marca como usado para o mesmo token não valer de novo. */
  qrNonce?: string | null;
}

export interface ResultadoDaSincronizacao {
  gravados: number;
  repetidos: number;
  /** Acessos cujo QR já constava como usado em outro acesso (replay entre agentes offline). */
  qrRepetidos: number;
}

const motivoValido = (motivo: string | null | undefined): motivo is MotivoDeNegacao =>
  typeof motivo === 'string' && Object.hasOwn(MOTIVOS_DE_NEGACAO, motivo);

/**
 * Registro de acessos (T23a): check-in e check-out por qualquer método, QR do app, liberação manual da
 * Recepção e sincronização do agente offline. A decisão é do pacote `@gymos/shared-acesso` (as mesmas
 * regras do agente local); este caso de uso traz os fatos (contrato, atraso, plano, histórico).
 */
@Injectable()
export class Acessos {
  constructor(
    private readonly acessos: RepositorioDeAcessos,
    private readonly alunos: AlunosParaAcesso,
    private readonly configuracao: RepositorioDeConfiguracaoDeAcesso,
    private readonly qr: QrDeCheckin,
    private readonly publicador: PublicadorDeEventos,
    private readonly autoria: AutoriaDoAcesso,
    private readonly relogio: Relogio,
  ) {}

  /** O que a catraca decidiria agora para este aluno, sem gravar nada. */
  async decidir(
    alunoId: string | null,
    direcao: DirecaoDeAcesso,
    instante: Date,
    modalidade: string | null,
  ): Promise<DecisaoDeAcesso> {
    const contexto = alunoId === null ? null : await this.alunos.contexto(alunoId);
    if (!contexto) {
      return { resultado: 'negado', motivo: 'aluno_nao_encontrado' };
    }
    const desde = segundaDaSemana(diaEmSaoPaulo(instante)) as DataCivil;
    return avaliarAcesso({
      direcao,
      instante,
      modalidade,
      contrato: contexto.contrato,
      diasDeAtraso: contexto.diasDeAtraso,
      modalidadesDoPlano: contexto.modalidadesDoPlano,
      acessosPorSemana: contexto.acessosPorSemana,
      passagens: await this.acessos.passagensLiberadas(contexto.alunoId, desde, instante),
      configuracao: await this.configuracao.obter(),
    });
  }

  /** Avalia as regras e grava a passagem (liberada ou negada) com o evento `AcessoRegistrado`. */
  async registrar(pedido: PedidoDeRegistro): Promise<ResultadoDoRegistro> {
    const instante = this.relogio.agora();
    const idDeOrigem = pedido.idDeOrigem ?? randomUUID();
    const existente = await this.acessos.porIdDeOrigem(idDeOrigem);
    if (existente) {
      return this.resultado(existente, true);
    }
    const decisao = await this.decidir(
      pedido.alunoId,
      pedido.direcao,
      instante,
      pedido.modalidade ?? null,
    );
    return this.gravar({ ...pedido, idDeOrigem, registradoEm: instante }, decisao);
  }

  /** Check-in ou check-out registrado pela Recepção: as regras valem como na catraca. */
  async checkInDaRecepcao(
    executor: Executor,
    pedido: Omit<PedidoDeRegistro, 'metodo' | 'registradoPor'>,
  ): Promise<ResultadoDoRegistro> {
    const resultado = await this.registrar({
      ...pedido,
      metodo: 'manual',
      registradoPor: executor.usuarioId,
    });
    if (!resultado.repetido) {
      await this.autoria.registrar(executor, {
        acao: 'registrou-check-in',
        detalhe: `${pedido.direcao === 'entrada' ? 'Entrada' : 'Saída'} ${resultado.acesso.resultado === 'negado' ? 'negada' : 'liberada'} (${resultado.acesso.alunoId ?? 'sem aluno'})`,
      });
    }
    return resultado;
  }

  /**
   * Liberação manual da Recepção: entra apesar da regra que negaria. Exige o motivo, vale como
   * `manual` e é auditada como sensível. Quem já está liberado pelas regras também fica registrado.
   */
  async liberarManualmente(
    executor: Executor,
    pedido: { alunoId: string; motivo: string; unidadeId?: string; modalidade?: string | null },
  ): Promise<ResultadoDoRegistro> {
    const motivo = pedido.motivo.trim();
    if (motivo === '') {
      throw new RegistroDeAcessoInvalidoError('Informe o motivo da liberação manual.');
    }
    const contexto = await this.alunos.contexto(pedido.alunoId);
    if (!contexto) {
      throw new NaoEncontradoError('Aluno');
    }
    const instante = this.relogio.agora();
    const decisao = await this.decidir(
      pedido.alunoId,
      'entrada',
      instante,
      pedido.modalidade ?? null,
    );
    const liberado: DecisaoDeAcesso = { resultado: 'liberado' };
    const resultado = await this.gravar(
      {
        idDeOrigem: randomUUID(),
        alunoId: pedido.alunoId,
        metodo: 'manual',
        direcao: 'entrada',
        modalidade: pedido.modalidade ?? null,
        unidadeId: pedido.unidadeId,
        registradoPor: executor.usuarioId,
        observacao: `Liberação manual: ${motivo}${decisao.resultado === 'negado' ? ` (negaria: ${rotuloDoMotivo(decisao.motivo)})` : ''}`,
        registradoEm: instante,
      },
      liberado,
    );
    await this.autoria.registrar(executor, {
      acao: 'liberou-acesso-manual',
      detalhe: `${contexto.nome}: ${motivo}`,
    });
    return resultado;
  }

  /**
   * QR do app apresentado na Recepção ou numa catraca online: confere a assinatura, a validade e o
   * uso único e, só então, aplica as regras. Um QR recusado fica registrado como acesso negado.
   */
  async registrarPorQr(
    token: string,
    pedido: Omit<PedidoDeRegistro, 'metodo' | 'alunoId' | 'direcao'> & {
      direcao?: DirecaoDeAcesso;
    },
  ): Promise<ResultadoDoRegistro> {
    const idDeOrigem = pedido.idDeOrigem ?? randomUUID();
    const existente = await this.acessos.porIdDeOrigem(idDeOrigem);
    if (existente) {
      return this.resultado(existente, true);
    }
    const conferencia = await this.qr.conferir(token);
    const base = {
      ...pedido,
      idDeOrigem,
      metodo: 'qr_code' as const,
      direcao: pedido.direcao ?? 'entrada',
      registradoEm: this.relogio.agora(),
    };
    if (!conferencia.ok) {
      return this.gravar(
        { ...base, alunoId: conferencia.alunoId },
        { resultado: 'negado', motivo: conferencia.motivo },
      );
    }
    const decisao = await this.decidir(
      conferencia.alunoId,
      base.direcao,
      base.registradoEm,
      pedido.modalidade ?? null,
    );
    return this.gravar({ ...base, alunoId: conferencia.alunoId }, decisao);
  }

  /**
   * Acessos que o agente da catraca guardou offline: chegam fora de ordem e repetidos. Cada um é
   * gravado uma vez, em ordem de horário de origem, como aconteceu (não são reavaliados: a pessoa já
   * passou ou foi barrada) e os QR usados offline entram na tabela de nonces.
   */
  async sincronizar(
    registros: readonly RegistroOffline[],
    unidadeId?: string,
  ): Promise<ResultadoDaSincronizacao> {
    const limite = this.relogio.agora().getTime() + FOLGA_DE_RELOGIO_MS;
    for (const registro of registros) {
      if (registro.registradoEm.getTime() > limite) {
        throw new RegistroDeAcessoInvalidoError(
          `O acesso ${registro.idDeOrigem} tem horário no futuro.`,
        );
      }
      if (registro.resultado === 'negado' && !motivoValido(registro.motivo)) {
        throw new RegistroDeAcessoInvalidoError(
          `O acesso negado ${registro.idDeOrigem} precisa de um motivo conhecido.`,
        );
      }
    }
    const unidade = unidadeId ?? (await this.alunos.unidadePadrao());
    const resultado: ResultadoDaSincronizacao = { gravados: 0, repetidos: 0, qrRepetidos: 0 };
    const consolidados = consolidarAcessosOffline(registros);
    // Repetidos dentro do próprio envio também contam como repetidos.
    resultado.repetidos += registros.length - consolidados.length;
    for (const registro of consolidados) {
      if (await this.acessos.porIdDeOrigem(registro.idDeOrigem)) {
        resultado.repetidos += 1;
        continue;
      }
      if (registro.qrNonce && registro.alunoId) {
        const primeiroUso = await this.qr.registrarUsoOffline(
          registro.qrNonce,
          registro.alunoId,
          registro.registradoEm,
        );
        if (!primeiroUso) {
          resultado.qrRepetidos += 1;
        }
      }
      const gravado = await this.gravar(
        {
          idDeOrigem: registro.idDeOrigem,
          alunoId: registro.alunoId,
          metodo: registro.metodo,
          direcao: registro.direcao,
          modalidade: registro.modalidade ?? null,
          dispositivoId: registro.dispositivoId ?? null,
          unidadeId: unidade,
          registradoEm: registro.registradoEm,
        },
        registro.resultado === 'negado'
          ? { resultado: 'negado', motivo: registro.motivo as MotivoDeNegacao }
          : { resultado: registro.resultado },
      );
      resultado[gravado.repetido ? 'repetidos' : 'gravados'] += 1;
    }
    return resultado;
  }

  private async gravar(
    pedido: PedidoDeRegistro & { idDeOrigem: string; registradoEm: Date },
    decisao: DecisaoDeAcesso,
  ): Promise<ResultadoDoRegistro> {
    const criado = await this.acessos.criar({
      idDeOrigem: pedido.idDeOrigem,
      unidadeId: pedido.unidadeId ?? (await this.alunos.unidadePadrao()),
      alunoId: pedido.alunoId,
      metodo: pedido.metodo,
      direcao: pedido.direcao,
      resultado: decisao.resultado,
      motivo: decisao.resultado === 'negado' ? decisao.motivo : null,
      modalidade: pedido.modalidade ?? null,
      dispositivoId: pedido.dispositivoId ?? null,
      registradoEm: pedido.registradoEm,
      registradoPor: pedido.registradoPor ?? null,
      observacao: pedido.observacao ?? null,
    });
    if (!criado) {
      // Outro pedido gravou o mesmo id entre a consulta e o INSERT: vale o que já está lá.
      const existente = await this.acessos.porIdDeOrigem(pedido.idDeOrigem);
      if (!existente) {
        throw new Error(`Acesso ${pedido.idDeOrigem} sumiu depois de conflitar.`);
      }
      return this.resultado(existente, true);
    }
    await this.publicador.publicar({
      tipo: 'AcessoRegistrado',
      payload: {
        acessoId: criado.id,
        alunoId: criado.alunoId,
        unidadeId: criado.unidadeId,
        liberado: criado.resultado !== 'negado',
        registradoEm: criado.registradoEm.toISOString(),
        metodo: criado.metodo,
        direcao: criado.direcao,
        resultado: criado.resultado,
        motivo: criado.motivo,
      },
    });
    return this.resultado(criado, false);
  }

  private resultado(acesso: Acesso, repetido: boolean): ResultadoDoRegistro {
    return {
      acesso,
      repetido,
      motivoTexto: acesso.motivo ? rotuloDoMotivo(acesso.motivo) : null,
    };
  }
}
