import type { BrowserContext } from '@playwright/test';
import { HOSTS_PERMITIDOS } from './config';

export function hostEhPermitido(url: string): boolean {
  if (/^(data|blob|about):/.test(url)) {
    return true;
  }
  const { hostname } = new URL(url);
  return HOSTS_PERMITIDOS.some((padrao) => padrao.test(hostname));
}

/**
 * Bloqueia toda requisição para fora da máquina (só adapters fake: ADR-013) e devolve a lista das
 * tentativas. A fixture `test` falha o teste se a lista não estiver vazia no fim.
 */
export async function bloquearRedeExterna(context: BrowserContext): Promise<string[]> {
  const tentativas: string[] = [];
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (hostEhPermitido(url)) {
      await route.fallback();
      return;
    }
    tentativas.push(`${route.request().method()} ${url}`);
    await route.abort('blockedbyclient');
  });
  return tentativas;
}
