import { Injectable } from '@nestjs/common';
import { ProvedorDeWebhook, type ResultadoDoWebhook } from '../../application/portas';
import { Relogio } from '../../domain/relogio';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';

interface EventoFake {
  idExterno: string;
  evento: string;
}

function eventoFake(corpo: unknown): EventoFake | null {
  if (typeof corpo !== 'object' || corpo === null) {
    return null;
  }
  const { idExterno, evento } = corpo as Record<string, unknown>;
  return typeof idExterno === 'string' && typeof evento === 'string' ? { idExterno, evento } : null;
}

/**
 * Provedor determinístico para testes e dev (nunca em produção): registra o último evento na
 * referência externa do recurso. Como roda em runAsTenant, um id externo de outro tenant não é
 * encontrado.
 */
@Injectable()
export class ProvedorDeWebhookFake extends ProvedorDeWebhook {
  readonly nome = 'fake';

  constructor(
    private readonly contexto: ContextoDoTenant,
    private readonly relogio: Relogio,
  ) {
    super();
  }

  idExterno(corpo: unknown): string | null {
    return eventoFake(corpo)?.idExterno ?? null;
  }

  async processar(corpo: unknown): Promise<ResultadoDoWebhook> {
    const evento = eventoFake(corpo);
    if (!evento) {
      return 'recurso-nao-encontrado';
    }
    const { count } = await this.contexto.cliente().referenciaExterna.updateMany({
      where: { provedor: this.nome, idExterno: evento.idExterno },
      data: { ultimoEvento: evento.evento, ultimoEventoEm: this.relogio.agora() },
    });
    return count > 0 ? 'processado' : 'recurso-nao-encontrado';
  }
}
