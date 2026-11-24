import type { Page, Route } from '@playwright/test';
import { RELOGIO_PADRAO } from './config';
import { fixarRelogioDoNavegador } from './relogio';

/** Uma resposta da API no fixture de uma tela. */
export interface RespostaDeApi {
  /** Padrão do caminho completo com query: texto exato ou regex. */
  caminho: string | RegExp;
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  status?: number;
  /** Corpo JSON. Tipar pelos contratos de `libs/api-contracts`. */
  corpo?: unknown;
}

/**
 * Fixture de uma tela (ADR-019): é o que o dono da tela escreve em
 * `apps/<app>/src/app/features/<feature>/testing/<Tela>.fixture.ts` e exporta como `default`.
 * Reproduz a própria tela (nomes e números exatos), não as regras de negócio.
 */
export interface FixtureDeTela {
  /** Instante do navegador e da API; o padrão é 19/11/2026 09:00 de São Paulo. */
  relogio?: string;
  respostas: readonly RespostaDeApi[];
}

function casa(padrao: string | RegExp, caminho: string): boolean {
  return typeof padrao === 'string' ? padrao === caminho : padrao.test(caminho);
}

/**
 * Serve o fixture no lugar da API (`page.route`) e fixa o relógio do navegador. Chamada da API
 * sem resposta no fixture responde 501 e entra em `naoServidas`, para o teste falhar com o caminho.
 */
export async function servirFixture(
  page: Page,
  fixture: FixtureDeTela,
): Promise<{ naoServidas: string[] }> {
  const naoServidas: string[] = [];
  await fixarRelogioDoNavegador(page, fixture.relogio ?? RELOGIO_PADRAO);
  await page.route('**/api/**', async (route: Route) => {
    const requisicao = route.request();
    const { pathname, search } = new URL(requisicao.url());
    const caminho = `${pathname.replace(/^\/api/, '')}${search}`;
    const resposta = fixture.respostas.find(
      (item) => (item.metodo ?? 'GET') === requisicao.method() && casa(item.caminho, caminho),
    );
    if (!resposta) {
      naoServidas.push(`${requisicao.method()} ${caminho}`);
      await route.fulfill({ status: 501, json: { mensagem: 'Sem resposta no fixture.' } });
      return;
    }
    await route.fulfill({ status: resposta.status ?? 200, json: resposta.corpo ?? {} });
  });
  return { naoServidas };
}
