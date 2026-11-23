import type { PrismaClient } from '../../../../generated/prisma/client';
import type { ClienteTransacional } from '../prisma/criar-cliente';

export const OPCOES_DA_TRANSACAO = { maxWait: 5_000, timeout: 15_000 } as const;

/**
 * Abre uma transação com `app.tenant_id` local a ela (`set_config(..., true)`, o mesmo que
 * `SET LOCAL`). Ao fim da transação a variável volta a vazio, e a próxima transação da mesma
 * conexão do pool não herda o tenant: sem contexto, as políticas devolvem zero linhas.
 */
export function transacaoDoTenant<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (cliente: ClienteTransacional) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (cliente) => {
    await cliente.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(cliente);
  }, OPCOES_DA_TRANSACAO);
}
