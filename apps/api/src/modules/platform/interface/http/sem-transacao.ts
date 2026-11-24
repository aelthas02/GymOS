import { SetMetadata } from '@nestjs/common';

export const SEM_TRANSACAO = 'gymos:sem-transacao';

/**
 * Rota que não roda numa transação por requisição: uma conexão longa, como o SSE, seguraria a
 * transação e a conexão do pool enquanto o cliente ficasse ligado. O handler não pode tocar o banco.
 */
export const SemTransacao = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SEM_TRANSACAO, true);
