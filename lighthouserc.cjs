// Lighthouse CI do PR (T03). Roda uma vez por app: LHCI_APP=staff-web|student-app.
// O build de produção é servido localmente pelo `serve-static` do Nx.
const app = process.env.LHCI_APP ?? 'staff-web';
const porta = app === 'staff-web' ? 4200 : 4300;

// Páginas públicas (as únicas com SEO ≥ 90). "Entrar" nasce no T07; o job do workflow só roda o Lighthouse quando a rota existir (a casca atual não pinta nada e o Lighthouse acusa NO_FCP).
const PAGINAS_PUBLICAS = ['/entrar'];
// Rotas autenticadas entram quando o seed existir (T35), com um script de login do usuário do seed
// (puppeteerScript do LHCI). Por ora, nenhuma.
const PAGINAS_AUTENTICADAS = [];

const minimos = {
  'categories:performance': ['error', { minScore: 0.9 }],
  'categories:accessibility': ['error', { minScore: 0.95 }],
  'categories:best-practices': ['error', { minScore: 0.95 }],
};

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      startServerCommand: `pnpm nx run ${app}:serve-static --port=${porta}`,
      startServerReadyPattern: 'Listening on',
      startServerReadyTimeout: 300000,
      url: [...PAGINAS_PUBLICAS, ...PAGINAS_AUTENTICADAS].map(
        (p) => `http://localhost:${porta}${p}`,
      ),
      settings: { chromeFlags: '--no-sandbox --headless=new' },
    },
    assert: {
      assertMatrix: [
        ...(PAGINAS_PUBLICAS.length
          ? [
              {
                matchingUrlPattern: `^http://localhost:${porta}(${PAGINAS_PUBLICAS.join('|')})$`,
                assertions: { ...minimos, 'categories:seo': ['error', { minScore: 0.9 }] },
              },
            ]
          : []),
        ...(PAGINAS_AUTENTICADAS.length
          ? [
              {
                matchingUrlPattern: `^http://localhost:${porta}(${PAGINAS_AUTENTICADAS.join('|')})$`,
                assertions: minimos,
              },
            ]
          : []),
      ],
    },
    upload: { target: 'filesystem', outputDir: `dist/reports/lighthouse-${app}` },
  },
};
