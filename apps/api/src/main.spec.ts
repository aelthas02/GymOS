import { Logger } from '@nestjs/common';
import { workspaceRoot } from '@nx/devkit';
import { parse } from 'dotenv';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function stubEnvExampleWithout(variable: string): void {
  const example = parse(readFileSync(join(workspaceRoot, '.env.example')));
  for (const [name, value] of Object.entries(example)) {
    vi.stubEnv(name, value);
  }
  vi.stubEnv(variable, undefined);
}

describe('main.ts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('encerra com código diferente de zero quando a validação do ambiente falha', async () => {
    stubEnvExampleWithout('DATABASE_URL');
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const logError = vi.spyOn(Logger, 'error').mockImplementation(() => undefined);

    await import('./main');

    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    expect(logError.mock.calls.flat().map(String).join('\n')).toContain('DATABASE_URL');
    // Importar o main carrega a API inteira (~14 s com a máquina carregada).
  }, 60_000);
});
