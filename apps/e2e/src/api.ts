import type { APIRequestContext } from '@playwright/test';
import {
  CABECALHO_DA_CHAVE_DE_OPERACAO,
  CABECALHO_DO_TENANT,
  CHAVE_DE_OPERACAO,
  RELOGIO_PADRAO,
  TENANT_DO_SEED,
  URLS,
} from './config';
import { cabecalhoDoRelogio } from './relogio';

/** Cabeçalhos de toda chamada do E2E à API: tenant do seed e relógio fixo (só dev e teste). */
export function cabecalhosDeApi(relogio: string = RELOGIO_PADRAO): Record<string, string> {
  return { [CABECALHO_DO_TENANT]: TENANT_DO_SEED, ...cabecalhoDoRelogio(relogio) };
}

/**
 * Fábrica via API de teste (`POST /api/teste/fabricas/:nome`, só dev e teste, exige a chave de
 * operação). Cada domínio registra as suas em `FabricasDeTeste`; o E2E recebe o que a fábrica devolve.
 */
export async function criarPelaFabrica<T = unknown>(
  request: APIRequestContext,
  nome: string,
  dados: Record<string, unknown> = {},
  relogio: string = RELOGIO_PADRAO,
): Promise<T> {
  const resposta = await request.post(`${URLS.api}/api/teste/fabricas/${nome}`, {
    headers: { ...cabecalhosDeApi(relogio), [CABECALHO_DA_CHAVE_DE_OPERACAO]: CHAVE_DE_OPERACAO },
    data: dados,
  });
  if (!resposta.ok()) {
    throw new Error(`Fábrica "${nome}" falhou (${resposta.status()}): ${await resposta.text()}`);
  }
  return (await resposta.json()) as T;
}
