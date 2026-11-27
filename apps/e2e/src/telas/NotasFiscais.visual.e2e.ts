import fixture from '../../../staff-web/src/app/features/financeiro/testing/FinNotas.fixture';
import emitir, {
  ALUNA_DO_EMITIR,
} from '../../../staff-web/src/app/features/financeiro/testing/FinEmitir.fixture';
import { servirFixture } from '../fixture-de-tela';
import { test } from '../teste';

// Painel: desktop (1280) contra FinNotas.html e FinEmitir.html; tablet (820) com snapshot aprovado no PR.
// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, info) => {
  test.skip(!/^(desktop|tablet)-/.test(info.project.name));
});

const largura = (projeto: string): number => (projeto.startsWith('tablet') ? 820 : 1280);

test('Notas fiscais bate com a referência', async ({
  page,
  expectScreenMatchesReference,
}, info) => {
  const { naoServidas } = await servirFixture(page, fixture);
  await page.goto('/financeiro/notas-fiscais');
  await page.getByRole('heading', { name: 'Notas do mês' }).waitFor();

  await expectScreenMatchesReference('FinNotas', { largura: largura(info.project.name) });
  test.expect(naoServidas).toEqual([]);
});

test('Emitir nota bate com a referência', async ({ page, expectScreenMatchesReference }, info) => {
  const { naoServidas } = await servirFixture(page, emitir);
  await page.goto(`/financeiro/notas-fiscais/emitir?alunoId=${ALUNA_DO_EMITIR}`);
  await test.expect(page.getByLabel('Aluno')).toHaveValue('Juliana Prado');

  await expectScreenMatchesReference('FinEmitir', { largura: largura(info.project.name) });
  test.expect(naoServidas).toEqual([]);
});
