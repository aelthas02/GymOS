import { Injectable } from '@nestjs/common';
import { PublicadorDeEventos } from '../../platform/application/eventos';
import { Relogio } from '../../platform/domain/relogio';
import { type DadosDoAviso, type Destinatario, validarAviso } from '../domain/aviso';
import {
  AgendadorDeAvisos,
  type Aviso,
  RepositorioDeAgendamentos,
  RepositorioDeAvisos,
} from './portas';

export interface PedidoDeAviso extends DadosDoAviso {
  destinatario: Destinatario;
  /** Também envia Web Push, se o destinatário tiver inscrição e não tiver desligado o tipo. */
  push?: boolean;
}

export interface OpcoesDoAgendamento {
  /** Agrupa os agendamentos de um fato (ex.: `aula:<reserva>`): repetir a chave substitui o pendente. */
  chave?: string;
}

/**
 * A porta que os outros domínios usam para avisar um aluno ou a equipe (T13e). Chame dentro do
 * caso de uso (ou de um consumidor de evento): o aviso entra na transação, e o push só sai depois do
 * commit, pelo evento `PushSolicitado`.
 */
@Injectable()
export class Notificador {
  constructor(
    private readonly avisos: RepositorioDeAvisos,
    private readonly agendamentos: RepositorioDeAgendamentos,
    private readonly agendador: AgendadorDeAvisos,
    private readonly eventos: PublicadorDeEventos,
    private readonly relogio: Relogio,
  ) {}

  /** Grava o aviso na caixa e, com `push`, pede o envio do Web Push. */
  async notificar(pedido: PedidoDeAviso): Promise<Aviso> {
    const dados = validarAviso(pedido);
    const [aviso] = await this.avisos.criar([
      { destinatario: pedido.destinatario, criadoEm: this.relogio.agora(), ...dados },
    ]);
    if (!aviso) {
      throw new Error('O repositório de avisos não devolveu o aviso gravado.');
    }
    if (pedido.push) {
      await this.eventos.publicar({ tipo: 'PushSolicitado', payload: { avisoIds: [aviso.id] } });
    }
    return aviso;
  }

  /** Agenda o aviso para `quando`; devolve o id do agendamento. */
  async notificarEm(
    quando: Date,
    pedido: PedidoDeAviso,
    opcoes: OpcoesDoAgendamento = {},
  ): Promise<{ id: string }> {
    const dados = validarAviso(pedido);
    if (opcoes.chave) {
      await this.agendamentos.cancelarPorChave(opcoes.chave);
    }
    const agendamento = await this.agendamentos.criar({
      chave: opcoes.chave ?? null,
      destinatario: pedido.destinatario,
      push: pedido.push ?? false,
      quando,
      ...dados,
    });
    await this.agendador.agendar(agendamento.id, quando);
    return { id: agendamento.id };
  }

  /** Cancela um agendamento pendente; falso se já foi enviado, cancelado ou não existe. */
  cancelarAgendamento(id: string): Promise<boolean> {
    return this.agendamentos.cancelar(id);
  }

  /** Cancela os agendamentos pendentes da chave e devolve quantos eram. */
  cancelarAgendamentos(chave: string): Promise<number> {
    return this.agendamentos.cancelarPorChave(chave);
  }

  /**
   * Chamado pelo job na hora marcada: se o agendamento ainda está pendente, vira aviso comum. Um
   * agendamento cancelado (ou excluído com o titular) não envia nada.
   */
  async enviarAgendado(agendamentoId: string): Promise<Aviso | null> {
    const agendamento = await this.agendamentos.porId(agendamentoId);
    if (!agendamento || !(await this.agendamentos.marcarComoEnviado(agendamentoId))) {
      return null;
    }
    return this.notificar({
      destinatario: agendamento.destinatario,
      tipo: agendamento.tipo,
      titulo: agendamento.titulo,
      texto: agendamento.texto,
      link: agendamento.link,
      push: agendamento.push,
    });
  }
}
