import { workspaceRoot } from '@nx/devkit';
import { ESLint, type Linter } from 'eslint';
import { join } from 'node:path';

const RESTRICTED_SYNTAX = 'no-restricted-syntax';

async function errosDeSintaxe(file: string, code: string): Promise<Linter.LintMessage[]> {
  const eslint = new ESLint({ cwd: workspaceRoot });
  const [result] = await eslint.lintText(code, { filePath: join(workspaceRoot, file) });
  return (result?.messages ?? []).filter(
    (message) => message.ruleId === RESTRICTED_SYNTAX && message.severity === 2,
  );
}

describe('tempo pela porta Relogio na API', () => {
  it.each([
    ['apps/api/src/modules/exemplo/domain/regra.ts', 'export const agora = Date.now();\n'],
    ['apps/api/src/modules/exemplo/domain/regra.ts', 'export const hoje = new Date();\n'],
    [
      'apps/api/src/modules/exemplo/application/caso-de-uso.ts',
      'export const agora = Date.now();\n',
    ],
  ])('%s com "%s" falha no lint', async (file, code) => {
    expect(await errosDeSintaxe(file, code)).not.toHaveLength(0);
  });

  it('new Date com argumento continua permitido no domínio', async () => {
    const code = "export const data = new Date('2026-11-19T12:00:00Z');\n";

    expect(await errosDeSintaxe('apps/api/src/modules/exemplo/domain/regra.ts', code)).toHaveLength(
      0,
    );
  });

  it('now() do SQL em consulta de um módulo da API falha no lint', async () => {
    const code = 'export const consulta = (db: any) => db.$queryRaw`SELECT now()`;\n';

    expect(
      await errosDeSintaxe('apps/api/src/modules/exemplo/infra/repositorio.ts', code),
    ).not.toHaveLength(0);
  });
});
