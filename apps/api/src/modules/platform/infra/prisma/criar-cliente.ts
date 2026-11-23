import { PrismaPg } from '@prisma/adapter-pg';
import { type Prisma, PrismaClient } from '../../../../generated/prisma/client';

/** Cliente de uma transação: o único que repositórios recebem (pelo ContextoDoTenant). */
export type ClienteTransacional = Prisma.TransactionClient;

/** Adapter do pool pg: sem banco, a conexão falha em 5 s em vez de esperar para sempre. */
export function adaptadorPg(url: string, maxConexoes = 10): PrismaPg {
  return new PrismaPg({ connectionString: url, max: maxConexoes, connectionTimeoutMillis: 5_000 });
}

export function criarClientePrisma(
  url: string,
  opcoes: { maxConexoes?: number } = {},
): PrismaClient {
  return new PrismaClient({
    adapter: adaptadorPg(url, opcoes.maxConexoes),
  });
}
