import { createProjectGraphAsync, workspaceRoot } from '@nx/devkit';
import { ESLint, type Linter } from 'eslint';
import { join } from 'node:path';

const BOUNDARIES = '@nx/enforce-module-boundaries';
const RESTRICTED_IMPORTS = 'no-restricted-imports';

async function lintFixture(file: string, code: string): Promise<Linter.LintMessage[]> {
  const eslint = new ESLint({ cwd: workspaceRoot });
  const [result] = await eslint.lintText(code, { filePath: join(workspaceRoot, file) });
  return result?.messages ?? [];
}

function errorsOf(messages: Linter.LintMessage[], ruleId: string): Linter.LintMessage[] {
  return messages.filter((message) => message.ruleId === ruleId && message.severity === 2);
}

describe('fronteiras entre projetos e camadas', () => {
  beforeAll(async () => {
    await createProjectGraphAsync({ exitOnError: false });
  });

  it('libs/ui importando apps/staff-web gera erro de enforce-module-boundaries', async () => {
    const messages = await lintFixture(
      'libs/ui/src/lib/fixture.ts',
      "import { App } from '../../../../apps/staff-web/src/app/app';\n\nexport const app = App;\n",
    );

    expect(errorsOf(messages, BOUNDARIES)).not.toHaveLength(0);
  });

  it('libs/ui (type:ui) não importa uma lib type:data-access', async () => {
    const messages = await lintFixture(
      'libs/ui/src/lib/fixture.ts',
      "export * from '@gymos/api-contracts';\n",
    );

    expect(errorsOf(messages, BOUNDARIES)).not.toHaveLength(0);
  });

  it('libs/shared (type:util) não importa uma lib type:ui', async () => {
    const messages = await lintFixture(
      'libs/shared/src/lib/fixture.ts',
      "export * from '@gymos/ui';\n",
    );

    expect(errorsOf(messages, BOUNDARIES)).not.toHaveLength(0);
  });

  it('libs/ui pode importar uma lib type:util', async () => {
    const messages = await lintFixture(
      'libs/ui/src/lib/fixture.ts',
      "export * from '@gymos/shared';\n",
    );

    expect(errorsOf(messages, BOUNDARIES)).toHaveLength(0);
  });

  it('o domínio de um módulo da API não importa da camada infra', async () => {
    const messages = await lintFixture(
      'apps/api/src/modules/exemplo/domain/regra.ts',
      "import type { Repositorio } from '../infra/repositorio';\n\nexport type Regra = Repositorio;\n",
    );

    expect(errorsOf(messages, RESTRICTED_IMPORTS)).not.toHaveLength(0);
  });

  it('o domínio de um módulo da API não importa Nest nem Prisma', async () => {
    const messages = await lintFixture(
      'apps/api/src/modules/exemplo/domain/regra.ts',
      "export { Injectable } from '@nestjs/common';\nexport { PrismaClient } from '@prisma/client';\n",
    );

    expect(errorsOf(messages, RESTRICTED_IMPORTS)).toHaveLength(2);
  });
});
