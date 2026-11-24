import type { ParteDaChave } from '../../application/eventos';

const PARTE = /^[A-Za-z0-9_.-]+$/;

export class ChaveDeCacheInvalidaError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ChaveDeCacheInvalidaError';
  }
}

/**
 * Chave obrigatória de todo cache: `tenant:<id>:cache:<partes>`. Sem tenant não há chave; partes com
 * `:` ou `*` são recusadas para que uma parte não imite o tenant nem vire padrão de busca.
 */
export function chaveDeCache(
  tenantId: string | null | undefined,
  ...partes: readonly ParteDaChave[]
): string {
  if (!tenantId) {
    throw new ChaveDeCacheInvalidaError('Chave de cache sem tenant.');
  }
  if (partes.length === 0) {
    throw new ChaveDeCacheInvalidaError('Chave de cache sem partes.');
  }
  for (const parte of partes) {
    if (!PARTE.test(String(parte))) {
      throw new ChaveDeCacheInvalidaError(`Parte de chave de cache inválida: "${parte}".`);
    }
  }
  return `tenant:${tenantId}:cache:${partes.join(':')}`;
}
