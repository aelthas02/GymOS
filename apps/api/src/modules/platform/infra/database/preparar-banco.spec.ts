import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Resposta = { rows?: unknown[]; rowCount?: number } | Error;

// Dublê do pg.Client: cada query consome a próxima resposta programada (ou devolve vazio).
const fake = vi.hoisted(() => ({
  consultas: [] as Array<{ sql: string; valores?: unknown[] }>,
  respostas: [] as Array<unknown>,
  encerrados: 0,
}));

vi.mock('pg', () => ({
  Client: class {
    connect = vi.fn().mockResolvedValue(undefined);
    end = vi.fn(() => {
      fake.encerrados++;
      return Promise.resolve();
    });
    escapeIdentifier = (valor: string): string => `"${valor}"`;
    escapeLiteral = (valor: string): string => `'${valor}'`;
    query(sql: string, valores?: unknown[]): Promise<unknown> {
      fake.consultas.push({ sql, valores });
      const resposta = (fake.respostas.shift() ?? { rows: [], rowCount: 0 }) as Resposta;
      return resposta instanceof Error ? Promise.reject(resposta) : Promise.resolve(resposta);
    }
  },
}));

import {
  apagarBanco,
  apagarBancosComPrefixo,
  bancoExiste,
  comCliente,
  concederAcesso,
  credenciaisDaUrl,
  criarBanco,
  garantirPapeis,
  prepararBanco,
  urlComBanco,
} from './preparar-banco';

const erroPg = (code: string): Error => Object.assign(new Error(code), { code });
const URL_ADMIN = 'postgresql://adm:segredo@localhost:5432/postgres';
const migrador = { usuario: 'gymos_migrator', senha: 'm' };
const app = { usuario: 'gymos_app', senha: 'a' };

beforeEach(() => {
  fake.consultas.length = 0;
  fake.respostas.length = 0;
  fake.encerrados = 0;
});
afterEach(() => vi.useRealTimers());

describe('URLs do Postgres', () => {
  it('lê usuário e senha decodificados da URL', () => {
    expect(credenciaisDaUrl('postgresql://us%40er:p%23ss@h:5432/x')).toEqual({
      usuario: 'us@er',
      senha: 'p#ss',
    });
  });

  it('troca só o banco da URL', () => {
    expect(urlComBanco(URL_ADMIN, 'gymos')).toBe('postgresql://adm:segredo@localhost:5432/gymos');
  });
});

describe('comCliente', () => {
  it('encerra a conexão também quando a função falha', async () => {
    await expect(comCliente(URL_ADMIN, () => Promise.reject(new Error('boom')))).rejects.toThrow(
      'boom',
    );
    expect(fake.encerrados).toBe(1);
  });
});

describe('garantirPapeis', () => {
  it('cria o papel que não existe, sem superusuário nem BYPASSRLS', async () => {
    await garantirPapeis(URL_ADMIN, [app]);

    expect(fake.consultas[1]?.sql).toContain(`CREATE ROLE "gymos_app" LOGIN PASSWORD 'a'`);
    expect(fake.consultas[1]?.sql).toContain('NOSUPERUSER');
  });

  it('não recria o papel que já existe', async () => {
    fake.respostas.push({ rows: [{ rolsuper: false, rolbypassrls: false }] });

    await garantirPapeis(URL_ADMIN, [app]);

    expect(fake.consultas).toHaveLength(1);
  });

  it.each([
    { rolsuper: true, rolbypassrls: false },
    { rolsuper: false, rolbypassrls: true },
  ])('recusa papel existente com privilégio demais %j', async (linha) => {
    fake.respostas.push({ rows: [linha] });

    await expect(garantirPapeis(URL_ADMIN, [app])).rejects.toThrow(/superusuário/);
  });

  it('tolera a corrida em que outra execução criou o papel (42710)', async () => {
    fake.respostas.push({ rows: [] }, erroPg('42710'));

    await expect(garantirPapeis(URL_ADMIN, [app])).resolves.toBeUndefined();
  });

  it('propaga outros erros do CREATE ROLE', async () => {
    fake.respostas.push({ rows: [] }, erroPg('42501'));

    await expect(garantirPapeis(URL_ADMIN, [app])).rejects.toThrow('42501');
  });

  it('propaga erro sem código', async () => {
    fake.respostas.push({ rows: [] }, new Error('sem código'));

    await expect(garantirPapeis(URL_ADMIN, [app])).rejects.toThrow('sem código');
  });
});

describe('bancos', () => {
  it('bancoExiste confere pg_database', async () => {
    fake.respostas.push({ rowCount: 1 }, { rowCount: 0 });

    expect(await bancoExiste(URL_ADMIN, 'gymos')).toBe(true);
    expect(await bancoExiste(URL_ADMIN, 'outro')).toBe(false);
  });

  it('criarBanco clona o modelo quando informado', async () => {
    await criarBanco(URL_ADMIN, 'novo', { modelo: 'modelo' });
    await criarBanco(URL_ADMIN, 'puro');

    expect(fake.consultas[0]?.sql).toBe('CREATE DATABASE "novo" TEMPLATE "modelo"');
    expect(fake.consultas[1]?.sql).toBe('CREATE DATABASE "puro"');
  });

  it('criarBanco tenta de novo quando o modelo está em uso (55006)', async () => {
    vi.useFakeTimers();
    fake.respostas.push(erroPg('55006'), erroPg('55006'));

    const pronto = criarBanco(URL_ADMIN, 'novo', { modelo: 'modelo' });
    await vi.runAllTimersAsync();
    await pronto;

    expect(fake.consultas).toHaveLength(3);
  });

  it('criarBanco desiste na décima tentativa', async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 10; i++) fake.respostas.push(erroPg('55006'));

    const pronto = criarBanco(URL_ADMIN, 'novo', { modelo: 'modelo' });
    const resultado = expect(pronto).rejects.toThrow('55006');
    await vi.runAllTimersAsync();
    await resultado;

    expect(fake.consultas).toHaveLength(10);
  });

  it('criarBanco propaga outro erro na hora', async () => {
    fake.respostas.push(erroPg('42P04'));

    await expect(criarBanco(URL_ADMIN, 'novo')).rejects.toThrow('42P04');
    expect(fake.consultas).toHaveLength(1);
  });

  it('concederAcesso dá conexão e schema aos dois papéis', async () => {
    await concederAcesso(URL_ADMIN, 'gymos', { migrador, app });

    expect(fake.consultas.map((c) => c.sql)).toEqual([
      'GRANT CONNECT ON DATABASE "gymos" TO "gymos_migrator", "gymos_app"',
      'REVOKE CREATE ON SCHEMA public FROM PUBLIC',
      'GRANT USAGE, CREATE ON SCHEMA public TO "gymos_migrator"',
      'GRANT USAGE ON SCHEMA public TO "gymos_app"',
    ]);
  });

  it('apagarBanco usa DROP ... WITH (FORCE)', async () => {
    await apagarBanco(URL_ADMIN, 'velho');

    expect(fake.consultas[0]?.sql).toBe('DROP DATABASE IF EXISTS "velho" WITH (FORCE)');
  });

  it('apagarBancosComPrefixo apaga cada banco encontrado', async () => {
    fake.respostas.push({ rows: [{ datname: 'gymos_test_a' }, { datname: 'gymos_test_b' }] });

    await apagarBancosComPrefixo(URL_ADMIN, 'gymos_test_');

    expect(fake.consultas.slice(1).map((c) => c.sql)).toEqual([
      'DROP DATABASE IF EXISTS "gymos_test_a" WITH (FORCE)',
      'DROP DATABASE IF EXISTS "gymos_test_b" WITH (FORCE)',
    ]);
  });
});

describe('prepararBanco', () => {
  const opcoes = { urlAdmin: URL_ADMIN, banco: 'gymos', migrador, app };
  const papeisExistentes = (): void => {
    for (let i = 0; i < 2; i++) {
      fake.respostas.push({ rows: [{ rolsuper: false, rolbypassrls: false }] });
    }
  };

  it('cria o banco quando ele não existe', async () => {
    papeisExistentes();
    fake.respostas.push({ rowCount: 0 });

    expect(await prepararBanco(opcoes)).toEqual({ bancoCriado: true });
    expect(fake.consultas.some((c) => c.sql === 'CREATE DATABASE "gymos"')).toBe(true);
  });

  it('é idempotente quando o banco já existe', async () => {
    papeisExistentes();
    fake.respostas.push({ rowCount: 1 });

    expect(await prepararBanco(opcoes)).toEqual({ bancoCriado: false });
    expect(fake.consultas.some((c) => c.sql.startsWith('CREATE DATABASE'))).toBe(false);
  });
});
