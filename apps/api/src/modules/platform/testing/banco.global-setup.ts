import { workspaceRoot } from '@nx/devkit';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';
import {
  apagarBancosComPrefixo,
  concederAcesso,
  credenciaisDaUrl,
  criarBanco,
  garantirPapeis,
  urlComBanco,
} from '../infra/database/preparar-banco';
import { carregarArquivoEnv, lerAmbienteDeTeste } from './ambiente-de-teste';
import type { ConfiguracaoDoBancoDeTeste } from './banco-de-teste';

export function aplicarMigracoes(urlMigrador: string): void {
  const prisma = join(workspaceRoot, 'node_modules/prisma/build/index.js');
  execFileSync(process.execPath, [prisma, 'migrate', 'deploy'], {
    cwd: join(workspaceRoot, 'apps/api'),
    env: { ...process.env, DATABASE_MIGRATOR_URL: urlMigrador, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    stdio: 'pipe',
  });
}

// Um banco-modelo por execução, com as migrações aplicadas por gymos_migrator. Cada arquivo de teste
// clona o modelo (usarBancoDeTeste) e o apaga no fim; o teardown apaga o que sobrar com o prefixo.
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  carregarArquivoEnv();
  const ambiente = lerAmbienteDeTeste(process.env);
  const urlAdmin = ambiente.TEST_DATABASE_ADMIN_URL;
  const migrador = credenciaisDaUrl(ambiente.DATABASE_MIGRATOR_URL);
  const app = credenciaisDaUrl(ambiente.DATABASE_URL);
  const prefixo = `gymos_test_${randomBytes(4).toString('hex')}`;
  const modelo = `${prefixo}_modelo`;

  await garantirPapeis(urlAdmin, [migrador, app]);
  await criarBanco(urlAdmin, modelo);
  try {
    await concederAcesso(urlAdmin, modelo, { migrador, app });
    aplicarMigracoes(urlComBanco(ambiente.DATABASE_MIGRATOR_URL, modelo));
  } catch (error) {
    await apagarBancosComPrefixo(urlAdmin, prefixo);
    throw error;
  }

  project.provide('bancoDeTeste', {
    urlAdmin,
    urlApp: ambiente.DATABASE_URL,
    urlMigrador: ambiente.DATABASE_MIGRATOR_URL,
    modelo,
    prefixo,
  } satisfies ConfiguracaoDoBancoDeTeste);
  return () => apagarBancosComPrefixo(urlAdmin, prefixo);
}
