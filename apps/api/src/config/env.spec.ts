import { workspaceRoot } from '@nx/devkit';
import { parse } from 'dotenv';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from './env';

function readEnvExample(): Record<string, string> {
  return parse(readFileSync(join(workspaceRoot, '.env.example')));
}

function invalidVariables(source: Record<string, string>): string[] {
  const result = parseEnv(source);
  return result.ok ? [] : result.issues.map((issue) => issue.variable);
}

describe('schema de variáveis de ambiente da API', () => {
  it('rejeita a configuração quando DATABASE_URL está ausente', () => {
    const withoutDatabase = readEnvExample();
    delete withoutDatabase['DATABASE_URL'];

    expect(parseEnv(withoutDatabase).ok).toBe(false);
    expect(invalidVariables(withoutDatabase)).toContain('DATABASE_URL');
  });

  it('aceita o .env.example preenchido', () => {
    expect(invalidVariables(readEnvExample())).toEqual([]);
  });
});
