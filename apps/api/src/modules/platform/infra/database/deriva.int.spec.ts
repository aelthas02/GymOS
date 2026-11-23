import { workspaceRoot } from '@nx/devkit';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';

// O banco migrado tem de bater com o schema Prisma: é o que garante que o SQL do gerador (e de
// qualquer migração escrita à mão) corresponde ao modelo, sem edição manual.
describe('schema Prisma e migrações', () => {
  const banco = usarBancoDeTeste();

  it('não divergem', () => {
    const prisma = join(workspaceRoot, 'node_modules/prisma/build/index.js');
    const resultado = spawnSync(
      process.execPath,
      [
        prisma,
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        'prisma/schema',
        '--exit-code',
      ],
      {
        cwd: join(workspaceRoot, 'apps/api'),
        env: {
          ...process.env,
          DATABASE_MIGRATOR_URL: banco.urlMigrador,
          PRISMA_HIDE_UPDATE_MESSAGE: '1',
        },
        encoding: 'utf-8',
      },
    );

    expect(resultado.stdout + resultado.stderr).not.toMatch(/\[\+\]|\[-\]|\[\*\]/);
    expect(resultado.status).toBe(0);
  });
});
