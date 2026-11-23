import { workspaceRoot } from '@nx/devkit';
import { ESLint, type Linter } from 'eslint';
import { join } from 'node:path';

const RESTRICTED_SYNTAX = 'no-restricted-syntax';
const DOMINIO = 'apps/api/src/modules/exemplo/domain/regra.ts';

async function errosDeSintaxe(file: string, code: string): Promise<Linter.LintMessage[]> {
  const eslint = new ESLint({ cwd: workspaceRoot });
  const [result] = await eslint.lintText(code, { filePath: join(workspaceRoot, file) });
  return (result?.messages ?? []).filter(
    (message) => message.ruleId === RESTRICTED_SYNTAX && message.severity === 2,
  );
}

describe('dinheiro e alíquotas em inteiros nos arquivos de domínio (T08)', () => {
  it.each([
    'export const iss = (valor: number) => valor * 0.025;',
    'export const iss = (valor: number) => 0.025 * valor;',
    'export const iss = (valor: number) => valor * .025;',
    'export const reais = (centavos: number) => centavos / 100;',
    'export const fracao = (pontosBase: number) => pontosBase / 10000;',
    'export function f(valor: number) { valor *= 0.5; valor /= 100; return valor; }',
  ])('proíbe %s', async (code) => {
    expect(await errosDeSintaxe(DOMINIO, code)).not.toHaveLength(0);
  });

  it('permite conta inteira no domínio', async () => {
    const code = 'export const dobro = (valor: number) => valor * 2 + valor / 3;\n';

    expect(await errosDeSintaxe(DOMINIO, code)).toHaveLength(0);
  });

  it('não vale fora do domínio', async () => {
    const code = 'export const reais = (centavos: number) => centavos / 100;\n';

    expect(await errosDeSintaxe('libs/ui/src/lib/fixture.ts', code)).toHaveLength(0);
  });
});
