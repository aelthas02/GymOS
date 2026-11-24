import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { RELOGIO_PADRAO } from './config';
import { bloquearRedeExterna, hostEhPermitido } from './rede';
import { expect, test } from './teste';
import { compararPng } from './visual/comparar';
import { abrirReferencia } from './visual/referencia';
import { PASTA_DO_RELATORIO } from './visual/relatorio';
import { servirFixture } from './fixture-de-tela';

// Prova do mecanismo da regressão visual, do relógio e da rede bloqueada (T35). Roda só no desktop:
// não depende do build do front nem da API.
// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, info) => {
  test.skip(!info.project.name.startsWith('desktop'));
});

test.describe('regressão visual', () => {
  test('a página igual à referência passa', async ({ page, expectScreenMatchesReference }) => {
    await abrirReferencia(page, 'Login');

    await expectScreenMatchesReference('Login', { largura: 1280 });
  });

  test('o botão 4 px mais alto falha e gera o relatório de diferenças', async ({
    page,
    expectScreenMatchesReference,
  }) => {
    await abrirReferencia(page, 'Login');
    await page.evaluate(() => {
      const botao = [...document.querySelectorAll('button')].find((item) => !item.ariaLabel);
      if (!botao) {
        throw new Error('Botão de entrar não encontrado.');
      }
      botao.style.height = `${botao.getBoundingClientRect().height + 4}px`;
    });

    await expect(expectScreenMatchesReference('Login', { limiar: 0.00001 })).rejects.toThrow(
      /Login difere da referência/,
    );
    const relatorio = await readFile(
      join(PASTA_DO_RELATORIO, `Login-${test.info().project.name}-1280`, 'index.html'),
      'utf8',
    );
    expect(relatorio).toContain('diff.png');
  });

  test('duas comparações da mesma tela dão diferença zero', async ({ page }) => {
    await abrirReferencia(page, 'Login');
    const primeira = await page.screenshot({ fullPage: true });
    await page.reload();
    const segunda = await page.screenshot({ fullPage: true });

    expect(compararPng(primeira, segunda).pixelsDiferentes).toBe(0);
  });
});

test.describe('relógio fixo', () => {
  test('o navegador está em 19/11/2026 09:00 de São Paulo', async ({ page }) => {
    await page.goto('about:blank');

    expect(await page.evaluate(() => new Date().toISOString())).toBe('2026-11-19T12:00:00.000Z');
  });

  // O relógio vale por contexto (cada teste tem o seu): o de 09:50 não vaza para as outras telas.
  test('o fixture que declara 09:50 muda o navegador daquela tela', async ({ page }) => {
    await servirFixture(page, { relogio: '2026-11-19T09:50:00-03:00', respostas: [] });
    await page.goto('about:blank');

    expect(await page.evaluate(() => new Date().toISOString())).toBe('2026-11-19T12:50:00.000Z');
  });
});

test.describe('rede bloqueada', () => {
  test('requisição para domínio externo é abortada e registrada', async () => {
    const navegador = await chromium.launch();
    try {
      const contexto = await navegador.newContext();
      const tentativas = await bloquearRedeExterna(contexto);
      const pagina = await contexto.newPage();

      const resultado = await pagina.goto('https://example.com/').catch(() => 'bloqueada');

      expect(resultado).toBe('bloqueada');
      expect(tentativas).toEqual(['GET https://example.com/']);
    } finally {
      await navegador.close();
    }
  });

  test('só hosts locais são permitidos', () => {
    expect(hostEhPermitido('http://localhost:4200/')).toBe(true);
    expect(hostEhPermitido('http://ritmo.localhost:4200/')).toBe(true);
    expect(hostEhPermitido('https://fonts.googleapis.com/css2')).toBe(false);
    expect(RELOGIO_PADRAO).toBe('2026-11-19T09:00:00-03:00');
  });
});
