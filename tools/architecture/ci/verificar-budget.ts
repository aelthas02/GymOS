import { spawnSync } from 'node:child_process';

// Teste do próprio pipeline: a configuração `verificacao-budget` tem um budget impossível; o build
// precisa falhar por causa dele. Se passar, o portão de budgets do angular.json está quebrado.
const apps = process.argv.slice(2);
let falhou = false;
for (const app of apps) {
  const r = spawnSync(
    'pnpm',
    [
      'nx',
      'build',
      app,
      '--configuration=verificacao-budget',
      '--skip-nx-cache',
      '--output-style=static',
    ],
    {
      encoding: 'utf8',
      shell: true,
    },
  );
  const saida = `${r.stdout}${r.stderr}`;
  if (r.status !== 0 && /budget/i.test(saida)) {
    console.log(`ok: o build de ${app} falhou pelo budget, como esperado`);
  } else {
    console.error(
      `FALHA: o build de ${app} deveria ter falhado pelo budget (status ${r.status})\n${saida}`,
    );
    falhou = true;
  }
}
process.exit(falhou ? 1 : 0);
