import { expect, test as base } from '@playwright/test';
import {
  CABECALHO_DO_RELOGIO,
  CABECALHO_DO_TENANT,
  RELOGIO_PADRAO,
  TENANT_DO_SEED,
} from './config';
import { bloquearRedeExterna } from './rede';
import { fixarRelogioDoNavegador } from './relogio';
import { expectScreenMatchesReference, type OpcoesDaComparacao } from './visual';

interface Fixtures {
  /** Instante do navegador e da API; sobrescreva com `test.use({ relogio: '...' })`. */
  relogio: string;
  /** Falha o teste se a página tentou acessar um domínio externo (a rede externa é bloqueada). */
  redeBloqueada: string[];
  expectScreenMatchesReference: (tela: string, opcoes?: OpcoesDaComparacao) => Promise<void>;
}

/**
 * `test` do E2E: rede externa bloqueada (falha o teste), relógio fixo em 19/11/2026 09:00 de São
 * Paulo no navegador e nas chamadas à API, tenant do seed no cabeçalho `x-tenant` e a comparação
 * visual ligada à página do teste.
 */
export const test = base.extend<Fixtures>({
  relogio: [RELOGIO_PADRAO, { option: true }],
  redeBloqueada: [
    async ({ context }, use) => {
      const tentativas = await bloquearRedeExterna(context);
      await use(tentativas);
      expect(tentativas, 'Requisições para domínios externos (a rede externa é bloqueada)').toEqual(
        [],
      );
    },
    { auto: true },
  ],
  page: async ({ page, context, relogio }, use) => {
    await context.setExtraHTTPHeaders({
      [CABECALHO_DO_TENANT]: TENANT_DO_SEED,
      [CABECALHO_DO_RELOGIO]: new Date(relogio).toISOString(),
    });
    await fixarRelogioDoNavegador(page, relogio);
    await use(page);
  },
  expectScreenMatchesReference: async ({ page }, use) => {
    await use((tela, opcoes) => expectScreenMatchesReference(page, tela, opcoes));
  },
});

export { expect };
