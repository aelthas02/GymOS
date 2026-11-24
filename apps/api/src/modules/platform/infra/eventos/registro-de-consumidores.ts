import { Injectable } from '@nestjs/common';
import type { TipoDeEvento } from '@gymos/shared-events';
import type { ConsumidorDeEvento, NomeDaFila } from '../../application/eventos';

const NOME_DO_CONSUMIDOR = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/;

export class ConsumidorInvalidoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ConsumidorInvalidoError';
  }
}

export interface ConsumidorRegistrado extends ConsumidorDeEvento {
  fila: NomeDaFila;
}

/**
 * Consumidores de eventos do processo. Cada módulo de domínio registra os seus no onModuleInit; o
 * despachante cria um job por consumidor do tipo do evento, e o worker acha o consumidor pelo nome.
 */
@Injectable()
export class RegistroDeConsumidores {
  private readonly porNome = new Map<string, ConsumidorRegistrado>();

  registrar<T extends TipoDeEvento>(consumidor: ConsumidorDeEvento<T>): void {
    if (!NOME_DO_CONSUMIDOR.test(consumidor.nome)) {
      throw new ConsumidorInvalidoError(
        `Nome de consumidor "${consumidor.nome}" fora do formato dominio.acao (ex.: fiscal.emitir-nota).`,
      );
    }
    if (this.porNome.has(consumidor.nome)) {
      throw new ConsumidorInvalidoError(`Consumidor ${consumidor.nome} registrado duas vezes.`);
    }
    this.porNome.set(consumidor.nome, {
      ...(consumidor as unknown as ConsumidorDeEvento),
      fila: consumidor.fila ?? 'eventos',
    });
  }

  doEvento(tipo: string): ConsumidorRegistrado[] {
    return [...this.porNome.values()].filter((consumidor) => consumidor.evento === tipo);
  }

  consumidor(nome: string): ConsumidorRegistrado | undefined {
    return this.porNome.get(nome);
  }

  filas(): NomeDaFila[] {
    return [...new Set([...this.porNome.values()].map((consumidor) => consumidor.fila))];
  }
}
