import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const raiz = join(import.meta.dirname, '..', '..', '..');

type Limites = { lines?: number; branches?: number; functions?: number; statements?: number };
type Cobertura = { thresholds?: Limites & Record<string, number | Limites> };

async function cobertura(arquivo: string): Promise<Cobertura> {
  const modulo = await import(pathToFileURL(join(raiz, arquivo)).href);
  const bruta = modulo.default;
  const config = typeof bruta === 'function' ? bruta({}) : bruta;
  return config.test.coverage ?? {};
}

const CEM = { lines: 100, branches: 100, functions: 100, statements: 100 };

// Pastas com 100% exigido (item 8 do prompt): o projeto inteiro é a pasta.
const PROJETOS_EM_100 = [
  'libs/shared/money/vitest.config.mts',
  'libs/shared/validation/vitest.config.mts',
  'libs/shared/pipes/vite.config.mts',
  'libs/shared/forms/vite.config.mts',
  'libs/shared/templates/vitest.config.mts',
];

// Pastas dentro de projetos maiores: o limite de 100% vale só para o glob.
const PASTAS_EM_100 = [
  ['libs/ui/vite.config.mts', 'styles/contrast.ts'],
  ['apps/api/vitest.config.mts', '**/domain/**'],
  ['apps/turnstile-agent/vitest.config.mts', '**/src/domain/**'],
] as const;

const COM_LIMITE_GERAL = [
  'apps/api/vitest.config.mts',
  'apps/turnstile-agent/vitest.config.mts',
  'libs/ui/vite.config.mts',
  'libs/shared/ambiente/vite.config.mts',
  'libs/shared/events/vitest.config.mts',
  'libs/api-contracts/vitest.config.mts',
];

describe('limites de cobertura (portão do CI)', () => {
  it.each(PROJETOS_EM_100)('%s exige 100% em tudo', async (arquivo) => {
    const { thresholds } = await cobertura(arquivo);
    expect(thresholds).toMatchObject(CEM);
  });

  it.each(PASTAS_EM_100)('%s exige 100% em %s', async (arquivo, glob) => {
    const { thresholds } = await cobertura(arquivo);
    expect(thresholds?.[glob]).toMatchObject(CEM);
  });

  it.each(COM_LIMITE_GERAL)(
    '%s exige 85% de linhas e 80% de branches (ou 100%)',
    async (arquivo) => {
      const { thresholds } = await cobertura(arquivo);
      expect(thresholds?.lines).toBeGreaterThanOrEqual(85);
      expect(thresholds?.branches).toBeGreaterThanOrEqual(80);
    },
  );

  it.each(['apps/staff-web/project.json', 'apps/student-app/project.json'])(
    '%s exige 85% de linhas e 80% de branches',
    async (arquivo) => {
      const projeto = (
        await import(pathToFileURL(join(raiz, arquivo)).href, { with: { type: 'json' } })
      ).default;
      const limites = projeto.targets.test.options.coverageThresholds;
      expect(limites.lines).toBeGreaterThanOrEqual(85);
      expect(limites.branches).toBeGreaterThanOrEqual(80);
    },
  );
});
