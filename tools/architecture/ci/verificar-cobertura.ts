import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Teste do próprio pipeline: planta código sem teste em cada pasta com 100% exigido e confere que o
// `nx test` do projeto falha por cobertura. Em `contrast.ts` o código entra no fim do arquivo.
const FIXTURE =
  'export function codigoSemTeste(x: number): number {\n  return x > 0 ? x : -x;\n}\n';

interface Alvo {
  projeto: string;
  arquivo: string;
  /** true: acrescenta ao arquivo existente em vez de criar um novo. */
  acrescentar?: boolean;
}

const ALVOS: Alvo[] = [
  { projeto: 'shared-money', arquivo: 'libs/shared/money/src/zz-fixture.ts' },
  { projeto: 'shared-validation', arquivo: 'libs/shared/validation/src/zz-fixture.ts' },
  { projeto: 'shared-pipes', arquivo: 'libs/shared/pipes/src/zz-fixture.ts' },
  { projeto: 'shared-forms', arquivo: 'libs/shared/forms/src/zz-fixture.ts' },
  { projeto: 'shared-templates', arquivo: 'libs/shared/templates/src/zz-fixture.ts' },
  { projeto: 'ui', arquivo: 'libs/ui/styles/contrast.ts', acrescentar: true },
  { projeto: 'api', arquivo: 'apps/api/src/modules/platform/domain/zz-fixture.ts' },
  { projeto: 'turnstile-agent', arquivo: 'apps/turnstile-agent/src/domain/zz-fixture.ts' },
];

const filtro = process.argv.slice(2);
let falhou = false;
for (const alvo of ALVOS.filter((a) => !filtro.length || filtro.includes(a.projeto))) {
  const original = alvo.acrescentar ? readFileSync(alvo.arquivo, 'utf8') : undefined;
  const dirCriado = !existsSync(dirname(alvo.arquivo));
  mkdirSync(dirname(alvo.arquivo), { recursive: true });
  writeFileSync(alvo.arquivo, `${original ?? ''}${FIXTURE}`);
  try {
    const r = spawnSync(
      'pnpm',
      ['nx', 'test', alvo.projeto, '--skip-nx-cache', '--output-style=static'],
      {
        encoding: 'utf8',
        shell: true,
      },
    );
    const saida = `${r.stdout}${r.stderr}`;
    if (r.status !== 0 && /does not meet/i.test(saida)) {
      console.log(
        `ok: ${alvo.projeto} falhou por cobertura com código sem teste em ${alvo.arquivo}`,
      );
    } else {
      console.error(
        `FALHA: ${alvo.projeto} deveria falhar por cobertura (status ${r.status})\n${saida.slice(-1500)}`,
      );
      falhou = true;
    }
  } finally {
    if (original === undefined) {
      rmSync(dirCriado ? dirname(alvo.arquivo) : alvo.arquivo, { recursive: true, force: true });
    } else {
      writeFileSync(alvo.arquivo, original);
    }
  }
}
process.exit(falhou ? 1 : 0);
