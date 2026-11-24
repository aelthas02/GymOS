import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { reverterMigracao } from '../ci/rollback-migracao.ts';

const raiz = join(import.meta.dirname, '..', '..', '..');
const EXEMPLO = '99999999999999_exemplo_de_rollback';

const urlAdmin = process.env['TEST_DATABASE_ADMIN_URL'];
if (!urlAdmin) {
  throw new Error('TEST_DATABASE_ADMIN_URL ausente: copie .env.example para .env (ver README).');
}

const nomeDoBanco = `gymos_rollback_${randomBytes(4).toString('hex')}`;
const urlDoBanco = (() => {
  const url = new URL(urlAdmin);
  url.pathname = `/${nomeDoBanco}`;
  return url.toString();
})();
const dirTemporario = join(raiz, 'tmp', nomeDoBanco);
const migracoes = join(dirTemporario, 'prisma', 'migrations');

async function sql<T extends object>(consulta: string, url = urlDoBanco): Promise<T[]> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query(consulta)).rows as T[];
  } finally {
    await client.end();
  }
}

function aplicarMigracoes(): void {
  execFileSync(
    process.execPath,
    [join(raiz, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
    {
      cwd: dirTemporario,
      env: { ...process.env, DATABASE_MIGRATOR_URL: urlDoBanco, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
      stdio: 'pipe',
    },
  );
}

const existeTabela = async (): Promise<boolean> =>
  (await sql(`SELECT 1 FROM information_schema.tables WHERE table_name = 'exemplo_rollback'`))
    .length === 1;
const migracoesAplicadas = async (): Promise<string[]> =>
  (
    await sql<{ migration_name: string }>(
      'SELECT migration_name FROM _prisma_migrations ORDER BY 1',
    )
  ).map((linha) => linha.migration_name);

beforeAll(async () => {
  await sql(`CREATE DATABASE ${nomeDoBanco}`, urlAdmin);
  // Cópia do Prisma da API numa pasta temporária (tmp/ é ignorada pelo git) com uma migração de exemplo.
  mkdirSync(dirTemporario, { recursive: true });
  cpSync(join(raiz, 'apps/api/prisma'), join(dirTemporario, 'prisma'), { recursive: true });
  cpSync(join(raiz, 'apps/api/prisma.config.ts'), join(dirTemporario, 'prisma.config.ts'));
  mkdirSync(join(migracoes, EXEMPLO));
  writeFileSync(
    join(migracoes, EXEMPLO, 'migration.sql'),
    'CREATE TABLE "exemplo_rollback" ("id" INTEGER PRIMARY KEY);',
  );
  writeFileSync(join(migracoes, EXEMPLO, 'down.sql'), 'DROP TABLE "exemplo_rollback";');
  aplicarMigracoes();
});

afterAll(async () => {
  rmSync(dirTemporario, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  await sql(`DROP DATABASE IF EXISTS ${nomeDoBanco} WITH (FORCE)`, urlAdmin);
});

describe('rollback de migração (portão do T03)', () => {
  it('a migração de exemplo foi aplicada', async () => {
    expect(await existeTabela()).toBe(true);
    expect((await migracoesAplicadas()).at(-1)).toBe(EXEMPLO);
  });

  it('recusa reverter uma migração que não é a última aplicada', async () => {
    const [primeira] = (await migracoesAplicadas()) as [string];
    writeFileSync(join(migracoes, primeira, 'down.sql'), 'SELECT 1;');

    await expect(
      reverterMigracao({ url: urlDoBanco, diretorio: migracoes, nome: primeira }),
    ).rejects.toThrow(/última/);
    expect(await existeTabela()).toBe(true);
  });

  it('recusa reverter uma migração sem down.sql', async () => {
    mkdirSync(join(migracoes, '99999999999998_sem_down'));
    await expect(
      reverterMigracao({ url: urlDoBanco, diretorio: migracoes, nome: '99999999999998_sem_down' }),
    ).rejects.toThrow(/down\.sql/);
    rmSync(join(migracoes, '99999999999998_sem_down'), { recursive: true });
  });

  it('reverte a última migração e a deixa pendente para novo deploy', async () => {
    await reverterMigracao({ url: urlDoBanco, diretorio: migracoes, nome: EXEMPLO });

    expect(await existeTabela()).toBe(false);
    expect(await migracoesAplicadas()).not.toContain(EXEMPLO);

    aplicarMigracoes();
    expect(await existeTabela()).toBe(true);
  });
});
