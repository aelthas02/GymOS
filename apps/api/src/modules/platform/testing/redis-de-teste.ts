import { Redis } from 'ioredis';
import { randomBytes } from 'node:crypto';
import { afterAll } from 'vitest';

export interface RedisDeTeste {
  readonly url: string;
  /** Prefixo próprio do arquivo de teste: chaves, filas e canais ficam sob `<prefixo>:`. */
  readonly prefixo: string;
}

/** Redis do arquivo de teste: o Redis local, isolado por prefixo e limpo no afterAll. */
export function usarRedisDeTeste(): RedisDeTeste {
  const url = process.env['REDIS_URL'] || 'redis://127.0.0.1:6379';
  const prefixo = `gymos_test_${randomBytes(4).toString('hex')}`;

  afterAll(async () => {
    const cliente = new Redis(url, { maxRetriesPerRequest: 1 });
    try {
      let cursor = '0';
      do {
        const [proximo, chaves] = await cliente.scan(cursor, 'MATCH', `${prefixo}:*`, 'COUNT', 500);
        if (chaves.length > 0) {
          await cliente.unlink(...chaves);
        }
        cursor = proximo;
      } while (cursor !== '0');
    } finally {
      cliente.disconnect();
    }
  }, 30_000);

  return { url, prefixo };
}

/** Espera a condição ficar verdadeira, conferindo a cada 50 ms. */
export async function aguardar(
  condicao: () => boolean | Promise<boolean>,
  { timeoutMs = 10_000, descricao = 'a condição' } = {},
): Promise<void> {
  const limite = performance.now() + timeoutMs;
  while (!(await condicao())) {
    if (performance.now() > limite) {
      throw new Error(`Tempo esgotado esperando ${descricao}.`);
    }
    await new Promise((resolver) => setTimeout(resolver, 50));
  }
}
