import { workspaceRoot } from '@nx/devkit';
import { parse } from 'dotenv';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { envSchema, InvalidEnvError, loadEnv, parseEnv } from './env';

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

function withOverrides(overrides: Record<string, string>): Record<string, string> {
  return { ...readEnvExample(), ...overrides };
}

function withoutKeys(...keys: string[]): Record<string, string> {
  const source = readEnvExample();
  for (const key of keys) {
    delete source[key];
  }
  return source;
}

describe('valores aceitos e rejeitados pelo schema', () => {
  it('rejeita DATABASE_URL com protocolo diferente de postgres', () => {
    const source = withOverrides({ DATABASE_URL: 'mysql://gymos:gymos@localhost:3306/gymos' });

    expect(invalidVariables(source)).toEqual(['DATABASE_URL']);
  });

  it('rejeita REDIS_URL com protocolo diferente de redis', () => {
    const source = withOverrides({ REDIS_URL: 'http://localhost:6379' });

    expect(invalidVariables(source)).toEqual(['REDIS_URL']);
  });

  it('usa 3000 quando API_PORT está ausente', () => {
    const result = parseEnv(withoutKeys('API_PORT'));

    expect(result.ok && result.env.API_PORT).toBe(3000);
  });

  it.each(['abc', '70000'])('rejeita API_PORT com o valor "%s"', (value) => {
    expect(invalidVariables(withOverrides({ API_PORT: value }))).toEqual(['API_PORT']);
  });

  it('usa "development" quando NODE_ENV está ausente', () => {
    const result = parseEnv(withoutKeys('NODE_ENV'));

    expect(result.ok && result.env.NODE_ENV).toBe('development');
  });

  it('rejeita NODE_ENV fora do enum', () => {
    expect(invalidVariables(withOverrides({ NODE_ENV: 'staging' }))).toEqual(['NODE_ENV']);
  });
});

describe('mensagens de erro das variáveis', () => {
  it('diz "obrigatória e não definida" quando a variável está ausente', () => {
    const result = parseEnv(withoutKeys('SMTP_HOST'));

    expect(!result.ok && result.issues).toEqual([
      { variable: 'SMTP_HOST', message: 'obrigatória e não definida' },
    ]);
  });

  it('mantém a mensagem do Zod quando o valor está presente e inválido', () => {
    const result = parseEnv(withOverrides({ SMTP_HOST: '   ' }));

    expect(result.ok).toBe(false);
    const [issue] = result.ok ? [] : result.issues;
    expect(issue?.variable).toBe('SMTP_HOST');
    expect(issue?.message).toBeTruthy();
    expect(issue?.message).not.toBe('obrigatória e não definida');
  });
});

describe('loadEnv', () => {
  it('lança InvalidEnvError listando todas as variáveis inválidas na mensagem', () => {
    const source = withOverrides({ API_PORT: 'abc', REDIS_URL: 'http://x' });
    delete source['S3_BUCKET'];

    const act = () => loadEnv(source);

    expect(act).toThrow(InvalidEnvError);
    expect(act).toThrow(/API_PORT[\s\S]*REDIS_URL[\s\S]*S3_BUCKET: obrigatória e não definida/);
  });

  it('expõe as variáveis inválidas em issues', () => {
    try {
      loadEnv({});
      expect.unreachable('loadEnv deveria lançar');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidEnvError);
      const names = (error as InvalidEnvError).issues.map((issue) => issue.variable);
      expect(names).toContain('DATABASE_URL');
      expect(names).not.toContain('API_PORT');
    }
  });

  it('devolve o objeto tipado a partir do .env.example', () => {
    const env = loadEnv(readEnvExample());

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      API_PORT: 3000,
      SMTP_PORT: 1025,
      S3_BUCKET: 'gymos',
    });
    expect(typeof env.API_PORT).toBe('number');
  });
});

describe('documentação das variáveis', () => {
  it('todas as chaves do schema aparecem no .env.example', () => {
    const documented = Object.keys(readEnvExample());

    expect(documented).toEqual(expect.arrayContaining(Object.keys(envSchema.shape)));
  });
});
