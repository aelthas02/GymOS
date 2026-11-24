import fixture, {
  credencialDoLogin,
} from '../../../staff-web/src/app/features/entrada/testing/Login.fixture';
import { servirFixture } from '../fixture-de-tela';
import { test } from '../teste';

// Painel: desktop (1280) contra Login.html e tablet (820) com snapshot aprovado no PR.
// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, info) => {
  test.skip(!/^(desktop|tablet)-/.test(info.project.name));
});

test('Entrar bate com a referência', async ({ page, expectScreenMatchesReference }, info) => {
  const { naoServidas } = await servirFixture(page, fixture);
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(credencialDoLogin.email);
  await page.getByLabel('Senha').fill(credencialDoLogin.senha);
  // Sem foco nos campos: o anel de foco não existe na referência.
  await page.locator('body').click({ position: { x: 1, y: 1 } });

  await expectScreenMatchesReference('Login', {
    largura: info.project.name.startsWith('tablet') ? 820 : 1280,
  });
  test.expect(naoServidas).toEqual([]);
});
