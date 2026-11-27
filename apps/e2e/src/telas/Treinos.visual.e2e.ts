import type { Page } from '@playwright/test';
import {
  TAMANHOS_DO_TECLADO,
  abrirTeclado,
  expectVisivelNaAreaVisivel,
  fecharTeclado,
  instalarTeclado,
  type ModoDeTeclado,
} from '@gymos/shared-testing';
import ficha, {
  ID_DO_ALUNO,
} from '../../../staff-web/src/app/features/treinos/testing/AlunosFicha.fixture';
import biblioteca, {
  exercicioDoPainel,
} from '../../../staff-web/src/app/features/treinos/testing/TreinosBiblioteca.fixture';
import fichas from '../../../staff-web/src/app/features/treinos/testing/TreinosFichas.fixture';
import modelos from '../../../staff-web/src/app/features/treinos/testing/TreinosModelos.fixture';
import { servirFixture, type FixtureDeTela } from '../fixture-de-tela';
import { expect, test } from '../teste';

// Painel: desktop (1280) contra o HTML de referência; tablet (820) com snapshot aprovado no PR.
// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, info) => {
  test.skip(!/^(desktop|tablet)-/.test(info.project.name));
});

/**
 * Limiar de 1% (o padrão é 0,5%) nas telas com seletor: o `ui-select` tem seta e raio de 12 px, e o
 * protótipo mostra uma caixa sem seta. Fica registrado em docs/design/inconsistencias.md.
 */
const LIMIAR_COM_SELECT = 0.01;

const larguraDoProjeto = (nome: string): number => (nome.startsWith('tablet') ? 820 : 1280);

/** O shell tem o item "Sair" (T14), que o protótipo não tem: some só aqui, para a barra caber na referência. */
async function esconderSair(page: Page): Promise<void> {
  await page.addStyleTag({ content: 'nav a[href="/sair"]{display:none!important}' });
}

async function tirarFoco(page: Page): Promise<void> {
  await esconderSair(page);
  // Sem foco nos campos: o anel de foco não existe na referência.
  await page.locator('body').click({ position: { x: 1, y: 1 } });
}

/** As telas de referência têm 950 px (Fichas), 907 (Modelos), 1033 (Biblioteca) e 1268 (Ficha) de altura. */
async function ajustarAltura(page: Page, largura: number, altura: number): Promise<void> {
  if (largura === 1280) {
    await page.setViewportSize({ width: 1280, height: altura });
  }
}

/**
 * O protótipo termina com "Tela ilustrativa, dados fictícios.", que não existe no produto: o teste a
 * acrescenta ao fim da página, para a altura e o resto da tela serem comparáveis.
 */
async function acrescentarNotaDoPrototipo(page: Page, seletorDoMain: string): Promise<void> {
  await page.evaluate((seletor) => {
    const nota = document.createElement('p');
    nota.textContent = 'Tela ilustrativa, dados fictícios.';
    nota.style.cssText = 'margin:0;font-size:12px;color:#4A5A6B';
    document.querySelector(seletor)?.append(nota);
  }, seletorDoMain);
}

async function abrir(
  page: Page,
  fixture: FixtureDeTela,
  caminho: string,
  largura: number,
  altura: number,
): Promise<string[]> {
  await ajustarAltura(page, largura, altura);
  const { naoServidas } = await servirFixture(page, fixture);
  await page.goto(caminho);
  await page.locator('main').waitFor();
  await acrescentarNotaDoPrototipo(page, 'main');
  return naoServidas;
}

test('Treinos (fichas) bate com a referência', async ({
  page,
  expectScreenMatchesReference,
}, info) => {
  const largura = larguraDoProjeto(info.project.name);
  const naoServidas = await abrir(page, fichas, '/treinos/fichas', largura, 950);
  await expect(page.getByText('Fichas dos alunos').first()).toBeVisible();
  await expect(page.getByText('Pedro Almeida').first()).toBeVisible();
  await tirarFoco(page);

  await expectScreenMatchesReference('TreinosFichas', { largura });
  expect(naoServidas).toEqual([]);
});

// TutTreinos.html não serve de baseline pixel a pixel (o protótipo afasta os blocos para as etiquetas
// caberem): o overlay tem snapshot próprio, aprovado no PR (em CI, gerado no contêiner).
test('Tutorial de Treinos mantém o snapshot aprovado', async ({ page }, info) => {
  const naoServidas = await abrir(
    page,
    fichas,
    '/treinos/fichas',
    larguraDoProjeto(info.project.name),
    950,
  );
  await expect(page.getByText('Pedro Almeida').first()).toBeVisible();
  await tirarFoco(page);
  await page.getByRole('button', { name: 'Ajuda' }).click();
  await expect(page.getByText('Fichas dos alunos: abra, edite ou aprove')).toBeVisible();
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important}',
  });

  expect(await page.screenshot({ fullPage: true, animations: 'disabled' })).toMatchSnapshot(
    'Treinos-tutorial.png',
    { maxDiffPixelRatio: 0.005 },
  );
  expect(naoServidas).toEqual([]);
});

test('Treinos (modelos) bate com a referência', async ({
  page,
  expectScreenMatchesReference,
}, info) => {
  const largura = larguraDoProjeto(info.project.name);
  const naoServidas = await abrir(page, modelos, '/treinos/modelos', largura, 907);
  await expect(page.getByText('Reabilitação ombro')).toBeVisible();
  await tirarFoco(page);

  await expectScreenMatchesReference('TreinosModelos', { largura });
  expect(naoServidas).toEqual([]);
});

test('Treinos (biblioteca) bate com a referência', async ({
  page,
  expectScreenMatchesReference,
}, info) => {
  const largura = larguraDoProjeto(info.project.name);
  const naoServidas = await abrir(page, biblioteca, '/treinos/biblioteca', largura, 1033);
  await expect(page.getByText('Puxada frontal')).toBeVisible();
  await page.getByLabel('Nome', { exact: true }).fill(exercicioDoPainel.nome);
  await page.getByLabel('Link do vídeo (YouTube)').fill(exercicioDoPainel.video);
  await page.getByLabel('Instruções').fill(exercicioDoPainel.instrucoes);
  await tirarFoco(page);

  await expectScreenMatchesReference('TreinosBiblioteca', { largura, limiar: LIMIAR_COM_SELECT });
  expect(naoServidas).toEqual([]);
});

test('Ficha de treino do aluno bate com a referência', async ({
  page,
  expectScreenMatchesReference,
}, info) => {
  const largura = larguraDoProjeto(info.project.name);
  const naoServidas = await abrir(
    page,
    ficha,
    `/alunos/${ID_DO_ALUNO}/ficha-de-treino`,
    largura,
    1268,
  );
  await expect(page.getByText('Rascunho gerado com IA.')).toBeVisible();
  await expect(page.getByLabel('Remover Mergulho')).toBeVisible();
  await tirarFoco(page);

  await expectScreenMatchesReference('AlunosFicha', { largura, limiar: LIMIAR_COM_SELECT });
  expect(naoServidas).toEqual([]);
});

// Harness do teclado virtual (T10): o editor da ficha em tablet, nos dois modos. O último campo do
// formulário ("Observações e restrições") e o botão "Salvar rascunho" ficam visíveis com o teclado aberto.
for (const modo of ['android', 'ios'] as const satisfies readonly ModoDeTeclado[]) {
  for (const tamanho of TAMANHOS_DO_TECLADO.filter((t) => t.nome.startsWith('tablet'))) {
    test(`editor da ficha com teclado · ${modo} · ${tamanho.nome}`, async ({ page }) => {
      await page.setViewportSize({ width: tamanho.largura, height: tamanho.altura });
      await instalarTeclado(page, modo);
      const { naoServidas } = await servirFixture(page, ficha);
      await page.goto(`/alunos/${ID_DO_ALUNO}/ficha-de-treino`);
      const campo = page.getByLabel('Observações e restrições');
      await expect(campo).toBeVisible();

      await campo.focus();
      await abrirTeclado(page, modo, tamanho);
      await page.waitForTimeout(500); // atraso da rolagem (300 ms) + folga

      await expectVisivelNaAreaVisivel(campo);
      await fecharTeclado(page, modo, tamanho);
      expect(naoServidas).toEqual([]);
    });
  }
}
