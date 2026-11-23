import { workspaceRoot } from '@nx/devkit';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface FileReplacement {
  replace: string;
  with: string;
}

interface AngularProject {
  targets: {
    build: { configurations: Record<string, { fileReplacements?: FileReplacement[] }> };
  };
}

const APPS = ['staff-web', 'student-app'];

const CONFIGURATIONS = [
  {
    configuration: 'development',
    file: 'environment.dev.ts',
    name: 'development',
    production: false,
  },
  { configuration: 'staging', file: 'environment.staging.ts', name: 'staging', production: false },
  {
    configuration: 'production',
    file: 'environment.prod.ts',
    name: 'production',
    production: true,
  },
];

function readProject(app: string): AngularProject {
  return JSON.parse(readFileSync(join(workspaceRoot, 'apps', app, 'project.json'), 'utf8'));
}

describe.each(APPS)('ambientes de %s', (app) => {
  const environments = `apps/${app}/src/environments`;

  it.each(CONFIGURATIONS)(
    'o build $configuration troca environment.ts por $file',
    ({ configuration, file }) => {
      const config = readProject(app).targets.build.configurations[configuration];

      expect(config?.fileReplacements).toEqual([
        { replace: `${environments}/environment.ts`, with: `${environments}/${file}` },
      ]);
    },
  );

  it.each(CONFIGURATIONS)(
    '$file declara name "$name" e production $production',
    ({ file, name, production }) => {
      const path = join(workspaceRoot, environments, file);
      expect(existsSync(path), `${environments}/${file} deve existir`).toBe(true);

      const source = readFileSync(path, 'utf8');
      expect(source).toContain(`name: '${name}'`);
      expect(source).toContain(`production: ${production}`);
    },
  );
});
