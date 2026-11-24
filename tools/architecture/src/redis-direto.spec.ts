import { workspaceRoot } from '@nx/devkit';
import { ESLint, type Linter } from 'eslint';
import { join } from 'node:path';

async function errosDeImportacao(file: string, code: string): Promise<Linter.LintMessage[]> {
  const eslint = new ESLint({ cwd: workspaceRoot });
  const [result] = await eslint.lintText(code, { filePath: join(workspaceRoot, file) });
  return (result?.messages ?? []).filter(
    (message) => message.ruleId === 'no-restricted-imports' && message.severity === 2,
  );
}

describe('Redis e filas só pela plataforma da API', () => {
  it.each([
    ["import { Redis } from 'ioredis';\nexport const r = Redis;\n"],
    ["import { Queue } from 'bullmq';\nexport const q = Queue;\n"],
  ])('fora de modules/platform, importar o cliente direto falha no lint: %s', async (code) => {
    const erros = await errosDeImportacao('apps/api/src/modules/exemplo/infra/cache.ts', code);

    expect(erros).not.toHaveLength(0);
  });

  it.each([
    ["import { Redis } from 'ioredis';\nexport const r = Redis;\n"],
    ["import { Queue } from 'bullmq';\nexport const q = Queue;\n"],
  ])('dentro de modules/platform, importar o cliente é permitido: %s', async (code) => {
    const erros = await errosDeImportacao('apps/api/src/modules/platform/infra/filas/x.ts', code);

    expect(erros).toHaveLength(0);
  });
});
