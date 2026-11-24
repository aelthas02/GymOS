import { spawnSync } from 'node:child_process';

// Portão de cobertura (T03): roda os testes com os limites ligados (GYMOS_COBERTURA=true).
// Os projetos Vitest leem a variável; os apps Angular usam a configuração `cobertura` do target.
// Uso: node tools/architecture/ci/cobertura.ts   (ou `pnpm cobertura`)
const APPS_ANGULAR = ['staff-web', 'student-app'];

function nx(args: string[]): number {
  const r = spawnSync('pnpm', ['nx', ...args, '--skip-nx-cache'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, GYMOS_COBERTURA: 'true' },
  });
  return r.status ?? 1;
}

const vitest = nx(['run-many', '-t', 'test', `--exclude=${APPS_ANGULAR.join(',')}`]);
const angular = nx(['run-many', '-t', 'test', `-p=${APPS_ANGULAR.join(',')}`, '-c=cobertura']);
process.exit(vitest || angular ? 1 : 0);
