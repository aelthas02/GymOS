import { createProjectGraphAsync, workspaceRoot } from '@nx/devkit';
import { ESLint, type Linter } from 'eslint';
import { join } from 'node:path';

const BOUNDARIES = '@nx/enforce-module-boundaries';
const RESTRICTED_IMPORTS = 'no-restricted-imports';
const NO_EXPLICIT_ANY = '@typescript-eslint/no-explicit-any';
const ON_PUSH = '@angular-eslint/prefer-on-push-component-change-detection';

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

    expect(errorsOf(messages, BOUNDARIES).map((error) => error.message)).toContain(
      'Projects cannot be imported by a relative or absolute path, and must begin with a npm scope',
    );
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

  it('any explícito em libs/shared gera erro de no-explicit-any', async () => {
    const messages = await lintFixture(
      'libs/shared/src/lib/fixture.ts',
      'export const valor: any = 1;\n',
    );

    expect(errorsOf(messages, NO_EXPLICIT_ANY)).not.toHaveLength(0);
  });

  it('a camada application da API não importa da camada infra', async () => {
    const messages = await lintFixture(
      'apps/api/src/modules/exemplo/application/caso-de-uso.ts',
      "import type { Repositorio } from '../infra/repositorio';\n\nexport type CasoDeUso = Repositorio;\n",
    );

    expect(errorsOf(messages, RESTRICTED_IMPORTS)).not.toHaveLength(0);
  });

  it('o domínio de um módulo da API não importa da camada application', async () => {
    const messages = await lintFixture(
      'apps/api/src/modules/exemplo/domain/regra.ts',
      "import type { CasoDeUso } from '../application/caso-de-uso';\n\nexport type Regra = CasoDeUso;\n",
    );

    expect(errorsOf(messages, RESTRICTED_IMPORTS)).not.toHaveLength(0);
  });

  it('o domínio pode importar outro arquivo do próprio domínio', async () => {
    const messages = await lintFixture(
      'apps/api/src/modules/exemplo/domain/regra.ts',
      "import type { Entidade } from './entidade';\n\nexport type Regra = Entidade;\n",
    );

    expect(errorsOf(messages, RESTRICTED_IMPORTS)).toHaveLength(0);
  });
});

describe('detecção de mudanças dos componentes Angular', () => {
  const componente = (prefix: string, strategy: string): string =>
    [
      "import { ChangeDetectionStrategy, Component } from '@angular/core';",
      '',
      '@Component({',
      `  selector: '${prefix}-fixture',`,
      "  template: '',",
      `  changeDetection: ChangeDetectionStrategy.${strategy},`,
      '})',
      'export class Fixture {}',
      '',
    ].join('\n');

  it.each([
    ['apps/staff-web/src/app/fixture.ts', 'app'],
    ['libs/ui/src/lib/fixture.ts', 'ui'],
  ])('changeDetection Eager em %s gera erro de prefer-on-push', async (file, prefix) => {
    const messages = await lintFixture(file, componente(prefix, 'Eager'));

    expect(errorsOf(messages, ON_PUSH)).not.toHaveLength(0);
  });

  it('changeDetection OnPush não gera erro de prefer-on-push', async () => {
    const messages = await lintFixture(
      'apps/staff-web/src/app/fixture.ts',
      componente('app', 'OnPush'),
    );

    expect(errorsOf(messages, ON_PUSH)).toHaveLength(0);
  });
});
