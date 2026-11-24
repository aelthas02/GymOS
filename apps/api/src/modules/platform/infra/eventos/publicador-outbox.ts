import { Injectable } from '@nestjs/common';
import {
  type EventoDeDominio,
  type NovoEvento,
  type TipoDeEvento,
  VERSAO_ATUAL,
} from '@gymos/shared-events';
import { randomUUID } from 'node:crypto';
import { PublicadorDeEventos } from '../../application/eventos';
import { Relogio } from '../../domain/relogio';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';

/** Grava no outbox pelo cliente transacional do contexto: o evento é confirmado junto com o caso de uso. */
@Injectable()
export class PublicadorDeEventosOutbox extends PublicadorDeEventos {
  constructor(
    private readonly contexto: ContextoDoTenant,
    private readonly relogio: Relogio,
  ) {
    super();
  }

  async publicar<T extends TipoDeEvento>(novo: NovoEvento<T>): Promise<EventoDeDominio<T>> {
    const evento: EventoDeDominio<T> = {
      id: randomUUID(),
      tipo: novo.tipo,
      versao: VERSAO_ATUAL[novo.tipo],
      tenantId: this.contexto.tenant().id,
      ocorridoEm: this.relogio.agora().toISOString(),
      payload: novo.payload,
    };
    await this.contexto.cliente().eventoOutbox.create({
      data: {
        id: evento.id,
        tenantId: evento.tenantId,
        tipo: evento.tipo,
        versao: evento.versao,
        payload: evento.payload as object,
        ocorridoEm: new Date(evento.ocorridoEm),
      },
    });
    return evento;
  }
}
