import { PrismaPg } from '@prisma/adapter-pg';
import { type Prisma, PrismaClient } from '../../../../generated/prisma/client';

/** Cliente de uma transação: o único que repositórios recebem (pelo ContextoDoTenant). */
export type ClienteTransacional = Prisma.TransactionClient;

export function criarClientePrisma(
  url: string,
  opcoes: { maxConexoes?: number } = {},
): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, max: opcoes.maxConexoes ?? 10 }),
  });
}
