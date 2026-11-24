import { expect, type Page, test } from '@playwright/test';
import { LIMIAR_DE_PIXELS, RELOGIO_PADRAO, VIEWPORTS } from '../config';
import { compararPng } from './comparar';
import { abrirReferencia, aguardarFontes } from './referencia';
import { gravarFalha } from './relatorio';

export interface OpcoesDaComparacao {
  /** Largura do viewport; o padrão é a do projeto. 1280 no painel, 390 no app do aluno. */
  largura?: number;
  /** Seletores CSS de regiões dinâmicas (cursor, animações), pintadas de cor sólida nas duas imagens. */
  regioesDinamicas?: readonly string[];
  /** Fração de pixels que pode diferir; o padrão é 0,5% (ADR-019). */
  limiar?: number;
  /** Relógio do HTML de referência; use o mesmo do fixture da tela. */
  relogio?: string;
}

const ESTILO_ESTATICO =
  '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';

async function capturar(page: Page, regioes: readonly string[]): Promise<Buffer> {
  await page.addStyleTag({ content: ESTILO_ESTATICO });
  await aguardarFontes(page);
  return page.screenshot({
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
    mask: regioes.map((seletor) => page.locator(seletor)),
    maskColor: '#ff00ff',
  });
}

/**
 * Compara a página atual (já na tela, com o fixture servido) com `docs/design/telas/html/<tela>.html`
 * renderizado no mesmo navegador e viewport (ADR-019). Em tablet (820 px) não há referência: o
 * snapshot é aprovado na primeira execução (`--update-snapshots=missing`).
 */
export async function expectScreenMatchesReference(
  page: Page,
  tela: string,
  opcoes: OpcoesDaComparacao = {},
): Promise<void> {
  const regioes = opcoes.regioesDinamicas ?? [];
  const atual = page.viewportSize() ?? VIEWPORTS.desktop;
  const largura = opcoes.largura ?? atual.width;
  if (largura !== atual.width) {
    await page.setViewportSize({ width: largura, height: atual.height });
  }

  const imagemAtual = await capturar(page, regioes);
  if (largura === VIEWPORTS.tablet.width) {
    expect(imagemAtual).toMatchSnapshot(`${tela}-tablet.png`, { maxDiffPixelRatio: 0.005 });
    return;
  }

  const pagina = await page.context().newPage();
  try {
    await pagina.setViewportSize({ width: largura, height: atual.height });
    await abrirReferencia(pagina, tela, opcoes.relogio ?? RELOGIO_PADRAO);
    const imagemDeReferencia = await capturar(pagina, regioes);
    const limiar = opcoes.limiar ?? LIMIAR_DE_PIXELS;
    const resultado = compararPng(imagemDeReferencia, imagemAtual);
    if (resultado.fracao > limiar) {
      const projeto = test.info().project.name;
      const relatorio = await gravarFalha(
        {
          id: `${tela}-${projeto}-${largura}`,
          tela,
          projeto,
          fracao: resultado.fracao,
          limiar,
          pixelsDiferentes: resultado.pixelsDiferentes,
          mesmasDimensoes: resultado.mesmasDimensoes,
        },
        { referencia: imagemDeReferencia, atual: imagemAtual, diff: resultado.diff },
      );
      await test.info().attach(`diferencas-${tela}`, { path: relatorio, contentType: 'text/html' });
      expect(
        resultado.fracao,
        `${tela} difere da referência em ${(resultado.fracao * 100).toFixed(3)}% dos pixels ` +
          `(limiar ${(limiar * 100).toFixed(1)}%). Relatório: ${relatorio}`,
      ).toBeLessThanOrEqual(limiar);
    }
  } finally {
    await pagina.close();
  }
}

/** Overlays de tutorial: mesma comparação, contra `Tut<Tela>.html`. */
export function expectTutorialMatchesReference(
  page: Page,
  tela: string,
  opcoes: OpcoesDaComparacao = {},
): Promise<void> {
  return expectScreenMatchesReference(page, `Tut${tela}`, opcoes);
}
