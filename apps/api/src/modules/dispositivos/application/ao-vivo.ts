import { Injectable } from '@nestjs/common';
import { type MotivoDeNegacao, rotuloDoMotivo } from '@gymos/shared-acesso';
import type { EventoDeDominio } from '@gymos/shared-events';
import { AlunosParaAcesso } from '../../acesso/application/portas';
import { TempoRealPorTenant } from '../../platform/application/eventos';
import { textoDoAlertaDeQueda } from '../domain/dispositivo';

/** Tópico do canal `tenant:<id>:acesso.ao-vivo`: acessos e alertas de dispositivo do tenant. */
export const TOPICO_AO_VIVO = 'acesso.ao-vivo';

export type MensagemAoVivo =
  | {
      tipo: 'acesso';
      acessoId: string;
      alunoId: string | null;
      nome: string | null;
      unidadeId: string;
      dispositivoId: string | null;
      metodo: string;
      direcao: string;
      resultado: string;
      motivo: string | null;
      motivoTexto: string | null;
      registradoEm: string;
    }
  | {
      tipo: 'dispositivo';
      dispositivoId: string;
      nome: string;
      online: boolean;
      desde: string;
      voltouEm: string | null;
      duracaoEmSegundos: number | null;
      texto: string;
    };

/**
 * Tempo real do acesso (T23b): "Acessos de agora", a Recepção e os alertas assinam o canal do tenant.
 * A publicação sai de consumidores de evento, depois do commit, então vale em qualquer réplica.
 */
@Injectable()
export class AoVivo {
  constructor(
    private readonly tempoReal: TempoRealPorTenant,
    private readonly alunos: AlunosParaAcesso,
  ) {}

  async acessoRegistrado(evento: EventoDeDominio<'AcessoRegistrado'>): Promise<void> {
    const p = evento.payload;
    const nome = p.alunoId
      ? ((await this.alunos.resumos([p.alunoId])).get(p.alunoId)?.nome ?? null)
      : null;
    await this.publicar({
      tipo: 'acesso',
      acessoId: p.acessoId,
      alunoId: p.alunoId,
      nome,
      unidadeId: p.unidadeId,
      dispositivoId: p.dispositivoId ?? null,
      metodo: p.metodo,
      direcao: p.direcao,
      resultado: p.resultado,
      motivo: p.motivo,
      motivoTexto: p.motivo ? rotuloDoMotivo(p.motivo as MotivoDeNegacao) : null,
      registradoEm: p.registradoEm,
    });
  }

  async dispositivoMudouDeEstado(
    evento: EventoDeDominio<'DispositivoMudouDeEstado'>,
  ): Promise<void> {
    const p = evento.payload;
    await this.publicar({
      tipo: 'dispositivo',
      dispositivoId: p.dispositivoId,
      nome: p.nome,
      online: p.online,
      desde: p.desde,
      voltouEm: p.voltouEm,
      duracaoEmSegundos: p.duracaoEmSegundos,
      texto: textoDoAlertaDeQueda(
        p.nome,
        new Date(p.desde),
        p.voltouEm === null ? null : new Date(p.voltouEm),
      ),
    });
  }

  private publicar(mensagem: MensagemAoVivo): Promise<void> {
    return this.tempoReal.publicar(TOPICO_AO_VIVO, mensagem);
  }

  /** Assina o canal do tenant do contexto; devolve o cancelamento. */
  assinar(aoReceber: (mensagem: MensagemAoVivo) => void): Promise<() => Promise<void>> {
    return this.tempoReal.assinar(TOPICO_AO_VIVO, (mensagem) =>
      aoReceber(mensagem as MensagemAoVivo),
    );
  }
}
