import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
import { FUSO_PADRAO, PORTAS, URLS, VIEWPORTS } from './src/config';

const RAIZ = resolve(__dirname, '../..');
const emCi = !!process.env['CI'];

// Cada tamanho roda em Chromium e WebKit (ADR-019). O app do aluno usa o projeto `mobile`
// (390×844, fator 2); o painel, `desktop` (1280) e `tablet` (820×1180, snapshot aprovado na primeira
// execução). As telas escolhem o projeto pelo nome (`--project`) ou pelo `test.skip` do spec.
const tamanhos = {
  desktop: { viewport: VIEWPORTS.desktop, deviceScaleFactor: 1 },
  tablet: { viewport: VIEWPORTS.tablet, deviceScaleFactor: 1 },
  mobile: { viewport: VIEWPORTS.mobile, deviceScaleFactor: 2, hasTouch: true },
} as const;
const navegadores = { chromium: 'Desktop Chrome', webkit: 'Desktop Safari' } as const;

const projects = Object.entries(tamanhos).flatMap(([tamanho, opcoes]) =>
  Object.entries(navegadores).map(([navegador, dispositivo]) => ({
    name: `${tamanho}-${navegador}`,
    use: { ...devices[dispositivo], ...opcoes },
  })),
);

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.e2e.ts',
  outputDir: resolve(RAIZ, 'dist/e2e/resultados'),
  snapshotPathTemplate: resolve(RAIZ, 'apps/e2e/snapshots/{projectName}/{arg}{ext}'),
  // No CI um snapshot que falta é erro; em dev, o primeiro é criado e o revisor o aprova no PR.
  updateSnapshots: emCi ? 'none' : 'missing',
  fullyParallel: true,
  forbidOnly: emCi,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: resolve(RAIZ, 'dist/e2e/relatorio'), open: 'never' }],
  ],
  globalTeardown: './src/encerrar.ts',
  use: {
    baseURL: URLS.painel,
    locale: 'pt-BR',
    timezoneId: FUSO_PADRAO,
    trace: 'retain-on-failure',
  },
  projects,
  // O painel e o app do aluno vêm do build estático, com /api repassado para a API do ambiente.
  // Só sobem quando há build e `E2E_SEM_SERVIDORES` não está definida (o mecanismo não precisa deles).
  webServer: process.env['E2E_SEM_SERVIDORES']
    ? undefined
    : [
        {
          command: `node tools/e2e/servidor-estatico.mjs dist/apps/staff-web/browser ${PORTAS.painel}`,
          cwd: RAIZ,
          url: URLS.painel,
          reuseExistingServer: !emCi,
        },
        {
          command: `node tools/e2e/servidor-estatico.mjs dist/apps/student-app/browser ${PORTAS.aluno}`,
          cwd: RAIZ,
          url: URLS.aluno,
          reuseExistingServer: !emCi,
        },
      ],
});
