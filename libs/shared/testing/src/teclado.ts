import type { Locator, Page } from '@playwright/test';

/**
 * Harness do teclado virtual (T10). O Safari ignora `interactive-widget` e o WebKit do Playwright
 * não emula o teclado do iOS; por isso são dois modos, e o teste em aparelho real continua
 * obrigatório (`docs/qa/teclado.md`).
 *
 * - `android`: o layout encolhe (`resizes-content`); o rodapé fica em `bottom: 0`.
 * - `ios`: o layout mantém a altura e o `visualViewport` simulado encolhe; o rodapé sobe a
 *   altura do teclado.
 */
export type ModoDeTeclado = 'android' | 'ios';

export interface TamanhoDeTela {
  nome: string;
  largura: number;
  altura: number;
  /** Altura do teclado nesse tamanho (iPhone em retrato: 344 px). */
  teclado: number;
}

export const TAMANHOS_DO_TECLADO: readonly TamanhoDeTela[] = [
  { nome: 'iphone-retrato', largura: 390, altura: 844, teclado: 344 },
  { nome: 'iphone-paisagem', largura: 844, altura: 390, teclado: 200 },
  { nome: 'tablet-retrato', largura: 820, altura: 1180, teclado: 420 },
  { nome: 'tablet-paisagem', largura: 1180, altura: 820, teclado: 360 },
];

interface ViewportSimulado {
  definir(altura: number): void;
}

/** Substitui `window.visualViewport` por um objeto controlável (modo iOS); vale antes do `goto`. */
async function instalarViewportSimulado(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const alvo = new EventTarget();
    const estado = { width: window.innerWidth, height: window.innerHeight };
    const falso = Object.defineProperties(alvo, {
      width: { get: () => estado.width },
      height: { get: () => estado.height },
      offsetTop: { value: 0 },
      offsetLeft: { value: 0 },
      pageLeft: { value: 0 },
      pageTop: { value: 0 },
      scale: { value: 1 },
    });
    Object.defineProperty(window, 'visualViewport', { value: falso, configurable: true });
    const controle: ViewportSimulado = {
      definir(altura) {
        estado.height = altura;
        alvo.dispatchEvent(new Event('resize'));
      },
    };
    Object.defineProperty(window, '__viewportSimulado', { value: controle });
  });
}

/** Prepara a página para o modo; o `ios` precisa disso antes de abrir a tela. */
export async function instalarTeclado(page: Page, modo: ModoDeTeclado): Promise<void> {
  if (modo === 'ios') {
    await instalarViewportSimulado(page);
  }
}

async function definirAlturaSimulada(page: Page, altura: number): Promise<void> {
  await page.evaluate(
    (valor) =>
      (window as unknown as { __viewportSimulado: ViewportSimulado }).__viewportSimulado.definir(
        valor,
      ),
    altura,
  );
}

/** Abre o teclado: encolhe a janela (Android) ou o `visualViewport` simulado (iOS). */
export async function abrirTeclado(
  page: Page,
  modo: ModoDeTeclado,
  tamanho: TamanhoDeTela,
): Promise<void> {
  const altura = tamanho.altura - tamanho.teclado;
  if (modo === 'android') {
    await page.setViewportSize({ width: tamanho.largura, height: altura });
  } else {
    await definirAlturaSimulada(page, altura);
  }
}

/** Fecha o teclado: o viewport volta à altura cheia. */
export async function fecharTeclado(
  page: Page,
  modo: ModoDeTeclado,
  tamanho: TamanhoDeTela,
): Promise<void> {
  if (modo === 'android') {
    await page.setViewportSize({ width: tamanho.largura, height: tamanho.altura });
  } else {
    await definirAlturaSimulada(page, tamanho.altura);
  }
}

/** Valor computado de `bottom` do rodapé fixo, em px. */
export async function alturaDoRodape(rodape: Locator): Promise<number> {
  return Number.parseFloat(await rodape.evaluate((el) => getComputedStyle(el).bottom));
}

/** Confere se o elemento inteiro está dentro da área que o usuário enxerga (`visualViewport`). */
export async function expectVisivelNaAreaVisivel(elemento: Locator): Promise<void> {
  const caixa = await elemento.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const v = window.visualViewport;
    const topo = v?.offsetTop ?? 0;
    return { topo: r.top, base: r.bottom, visivelTopo: topo, visivelBase: topo + (v?.height ?? 0) };
  });
  if (caixa.topo < caixa.visivelTopo - 0.5 || caixa.base > caixa.visivelBase + 0.5) {
    throw new Error(
      `Elemento fora da área visível: ${caixa.topo}–${caixa.base} fora de ${caixa.visivelTopo}–${caixa.visivelBase}.`,
    );
  }
}
