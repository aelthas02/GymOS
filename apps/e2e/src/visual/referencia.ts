import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { RELOGIO_PADRAO } from '../config';
import { fixarRelogioDoNavegador } from '../relogio';

const RAIZ = resolve(__dirname, '../../../..');
const PASTA_DAS_TELAS = join(RAIZ, 'docs/design/telas/html');
const PASTA_DA_INTER = join(RAIZ, 'libs/ui/styles/fonts/inter');
const PESOS_DA_INTER = [400, 500, 600, 700];

/** Origem fictícia (permitida pela rede bloqueada) onde o HTML de referência é servido. */
export const ORIGEM_DA_REFERENCIA = 'http://referencia.gymos.test';
const ORIGEM_DAS_FONTES = 'https://fonts.gstatic.com/gymos-inter';

/** CSS que o HTML de referência pediria ao Google Fonts, apontando para a Inter self-hosted. */
function cssDaInter(): string {
  return PESOS_DA_INTER.map(
    (peso) =>
      `@font-face{font-family:Inter;font-style:normal;font-weight:${peso};font-display:block;` +
      `src:url(${ORIGEM_DAS_FONTES}/inter-latin-${peso}.woff2) format('woff2')}`,
  ).join('\n');
}

/** Abre `docs/design/telas/html/<tela>.html` na página, com a Inter local e o relógio fixo. */
export async function abrirReferencia(
  page: Page,
  tela: string,
  relogio: string = RELOGIO_PADRAO,
): Promise<void> {
  if (!/^[A-Za-z0-9]+$/.test(tela)) {
    throw new Error(`Nome de tela inválido: "${tela}".`);
  }
  const html = await readFile(join(PASTA_DAS_TELAS, `${tela}.html`), 'utf8').catch(() => {
    throw new Error(`Não existe a referência docs/design/telas/html/${tela}.html.`);
  });
  await fixarRelogioDoNavegador(page, relogio);
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'text/css', body: cssDaInter() }),
  );
  await page.route(`${ORIGEM_DAS_FONTES}/*.woff2`, async (route) => {
    const arquivo = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    await route.fulfill({
      contentType: 'font/woff2',
      body: await readFile(join(PASTA_DA_INTER, arquivo)),
    });
  });
  await page.route(`${ORIGEM_DA_REFERENCIA}/**`, (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }),
  );
  await page.goto(`${ORIGEM_DA_REFERENCIA}/${tela}.html`);
  await aguardarFontes(page);
}

export async function aguardarFontes(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(
      ['400', '500', '600', '700'].map((peso) => document.fonts.load(`${peso} 16px Inter`)),
    );
    await document.fonts.ready;
  });
}
