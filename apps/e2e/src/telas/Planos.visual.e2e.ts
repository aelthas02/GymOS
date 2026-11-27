import type { Page } from '@playwright/test';
import fixture, {
  planoDoPainel,
} from '../../../staff-web/src/app/features/planos/testing/Planos.fixture';
import { servirFixture } from '../fixture-de-tela';
import { test } from '../teste';

// Painel: desktop (1280) contra Planos.html; tablet (820) com snapshot aprovado no PR.
// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, info) => {
  test.skip(!/^(desktop|tablet)-/.test(info.project.name));
});

/** Abre `/planos` e preenche o painel como `Planos.html` o mostra. */
async function abrirPlanos(page: Page, largura: number): Promise<string[]> {
  // Planos.html é uma página de 980 px de altura mínima; o painel ocupa a janela inteira.
  if (largura === 1280) {
    await page.setViewportSize({ width: 1280, height: 980 });
  }
  const { naoServidas } = await servirFixture(page, fixture);
  await page.goto('/planos');
  await page.getByLabel('Nome do plano').fill(planoDoPainel.nome);
  await page.getByLabel('Valor total (R$)').fill(planoDoPainel.valorTotal);
  await page.getByLabel('Duração (meses)').fill(planoDoPainel.duracaoMeses);
  await page.getByLabel('Parcelas', { exact: true }).fill(planoDoPainel.parcelas);
  for (const modalidade of planoDoPainel.modalidades) {
    await page.getByRole('button', { name: modalidade, exact: true }).click();
  }
  // O valor da parcela vem da API, depois do debounce.
  await test.expect(page.getByLabel('Valor da parcela')).toHaveValue(planoDoPainel.valorDaParcela);
  // Sem foco nos campos: o anel de foco não existe na referência.
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  return naoServidas;
}

test('Planos bate com a referência', async ({ page, expectScreenMatchesReference }, info) => {
  const largura = info.project.name.startsWith('tablet') ? 820 : 1280;
  const naoServidas = await abrirPlanos(page, largura);

  await expectScreenMatchesReference('Planos', { largura });
  test.expect(naoServidas).toEqual([]);
});

// TutPlanos.html não serve de baseline pixel a pixel: o protótipo afasta os blocos (72 px no topo e
// mais espaço entre eles) para as etiquetas caberem, e o TutorialOverlay (T27) desenha por cima da
// tela real, sem deslocá-la. O overlay tem snapshot próprio, aprovado no PR (em CI, gerado no contêiner).
test('Tutorial de Planos mantém o snapshot aprovado', async ({ page }, info) => {
  const naoServidas = await abrirPlanos(page, info.project.name.startsWith('tablet') ? 820 : 1280);
  await page.getByRole('button', { name: 'Ajuda' }).click();
  await test.expect(page.getByText('Crie ou edite um plano aqui')).toBeVisible();
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important}',
  });

  test
    .expect(await page.screenshot({ fullPage: true, animations: 'disabled' }))
    .toMatchSnapshot('Planos-tutorial.png', { maxDiffPixelRatio: 0.005 });
  test.expect(naoServidas).toEqual([]);
});
