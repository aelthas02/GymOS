import {
  TAMANHOS_DO_TECLADO,
  abrirTeclado,
  expectVisivelNaAreaVisivel,
  fecharTeclado,
  instalarTeclado,
  type ModoDeTeclado,
} from '@gymos/shared-testing';
import emitir, {
  ALUNA_DO_EMITIR,
} from '../../../staff-web/src/app/features/financeiro/testing/FinEmitir.fixture';
import { servirFixture } from '../fixture-de-tela';
import { expect, test } from '../teste';

// "Emitir nota" com o teclado virtual (T10) em 390×844 e 820×1180, nos dois modos: o último campo
// (Valor) e o botão de emitir do rodapé continuam visíveis. Roda nos projetos de desktop, que
// redimensionam a janela no próprio teste.
// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, info) => {
  test.skip(!info.project.name.startsWith('desktop'));
});

const TAMANHOS = TAMANHOS_DO_TECLADO.filter((tamanho) =>
  ['iphone-retrato', 'tablet-retrato'].includes(tamanho.nome),
);

for (const modo of ['android', 'ios'] as const satisfies readonly ModoDeTeclado[]) {
  test.describe(`Emitir nota · teclado ${modo}`, () => {
    for (const tamanho of TAMANHOS) {
      test(`${tamanho.nome}: Valor e "Emitir nota" ficam visíveis`, async ({ page }) => {
        await page.setViewportSize({ width: tamanho.largura, height: tamanho.altura });
        await instalarTeclado(page, modo);
        await servirFixture(page, emitir);
        await page.goto(`/financeiro/notas-fiscais/emitir?alunoId=${ALUNA_DO_EMITIR}`);
        const valor = page.getByLabel('Valor');
        await expect(valor).toHaveValue('R$ 119,00');

        await valor.focus();
        await abrirTeclado(page, modo, tamanho);
        await page.waitForTimeout(500); // atraso da rolagem (300 ms) + folga

        await expectVisivelNaAreaVisivel(valor);
        await expectVisivelNaAreaVisivel(
          page.getByTestId('rodape-de-emissao').getByRole('button', { name: 'Emitir nota' }),
        );
        await fecharTeclado(page, modo, tamanho);
      });
    }
  });
}
