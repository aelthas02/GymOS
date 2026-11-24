import {
  TAMANHOS_DO_TECLADO,
  abrirPaginaDeDemonstracao,
  abrirTeclado,
  alturaDoRodape,
  expectVisivelNaAreaVisivel,
  fecharTeclado,
  instalarTeclado,
  type ModoDeTeclado,
} from '@gymos/shared-testing';
import { expect, test } from './teste';

// Harness do teclado virtual (T10) provado na página de demonstração, nos dois modos. Roda só nos
// projetos de desktop: o tamanho do aparelho vem do próprio teste (`setViewportSize`).
// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, info) => {
  test.skip(!info.project.name.startsWith('desktop'));
});

for (const modo of ['android', 'ios'] as const satisfies readonly ModoDeTeclado[]) {
  test.describe(`teclado · modo ${modo}`, () => {
    for (const tamanho of TAMANHOS_DO_TECLADO) {
      test(`${tamanho.nome}: último campo e "Salvar" ficam visíveis e o rodapé acompanha`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: tamanho.largura, height: tamanho.altura });
        await instalarTeclado(page, modo);
        await abrirPaginaDeDemonstracao(page);
        const rodape = page.locator('#rodape');
        const ultimo = page.locator('#campo-14');
        expect(await alturaDoRodape(rodape)).toBe(0);

        await ultimo.focus();
        await abrirTeclado(page, modo, tamanho);
        await page.waitForTimeout(500); // atraso da rolagem (300 ms) + folga

        await expectVisivelNaAreaVisivel(ultimo);
        await expectVisivelNaAreaVisivel(page.locator('#salvar'));
        // Android: o layout encolheu e o rodapé fica em 0; iOS: sobe a altura do teclado.
        expect(await alturaDoRodape(rodape)).toBe(modo === 'android' ? 0 : tamanho.teclado);

        await fecharTeclado(page, modo, tamanho);
        await expect.poll(() => alturaDoRodape(rodape)).toBe(0);
      });
    }
  });
}
