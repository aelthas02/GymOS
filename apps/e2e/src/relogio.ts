import type { Page } from '@playwright/test';
import { CABECALHO_DO_RELOGIO, RELOGIO_PADRAO } from './config';

/**
 * Fixa `Date` e `Date.now()` do navegador no instante (os timers seguem correndo). Chame antes de
 * navegar: vale para as páginas seguintes da mesma aba.
 */
export async function fixarRelogioDoNavegador(
  page: Page,
  instante: string = RELOGIO_PADRAO,
): Promise<void> {
  await page.clock.setFixedTime(new Date(instante));
}

/** Cabeçalho que fixa o `Relogio` da API na requisição (a API só aceita em dev e teste). */
export function cabecalhoDoRelogio(instante: string = RELOGIO_PADRAO): Record<string, string> {
  return { [CABECALHO_DO_RELOGIO]: new Date(instante).toISOString() };
}
