import { createProjectGraphAsync, workspaceRoot, type ProjectGraph } from '@nx/devkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHARED_PACKAGE_ROOT = /^libs\/shared\/([^/]+)$/;

function tsconfigPaths(): Record<string, string[]> {
  const tsconfig = JSON.parse(readFileSync(join(workspaceRoot, 'tsconfig.base.json'), 'utf8')) as {
    compilerOptions: { paths?: Record<string, string[]> };
  };
  return tsconfig.compilerOptions.paths ?? {};
}

describe('pacotes compartilhados em libs/shared', () => {
  let graph: ProjectGraph;

  beforeAll(async () => {
    graph = await createProjectGraphAsync({ exitOnError: false });
  });

  function projectsUnderShared() {
    return Object.values(graph.nodes).filter(
      (node) => node.data.root === 'libs/shared' || node.data.root.startsWith('libs/shared/'),
    );
  }

  it('libs/shared é só pasta de agrupamento, sem projeto na raiz', () => {
    const roots = projectsUnderShared().map((node) => node.data.root);

    expect(roots).not.toContain('libs/shared');
  });

  it('cada pacote fica direto em libs/shared/<pacote>, com nome, alias e tags da convenção', () => {
    const paths = tsconfigPaths();

    for (const node of projectsUnderShared()) {
      const pacote = SHARED_PACKAGE_ROOT.exec(node.data.root)?.[1];
      expect(pacote, `${node.data.root} deve ficar direto em libs/shared/`).toBeDefined();

      const tags = node.data.tags ?? [];
      expect(node.name).toBe(`shared-${pacote}`);
      expect(Object.keys(paths)).toContain(`@gymos/shared-${pacote}`);
      expect(tags).toContain('scope:shared');
      expect(tags.filter((tag) => tag === 'type:util' || tag === 'type:domain')).toHaveLength(1);
    }
  });
});
