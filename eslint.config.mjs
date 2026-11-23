import css from '@eslint/css';
import nx from '@nx/eslint-plugin';
import gymos from './tools/lint/no-hardcoded-color.mjs';

const scopeConstraints = [
  { sourceTag: 'scope:staff', onlyDependOnLibsWithTags: ['scope:staff', 'scope:shared'] },
  { sourceTag: 'scope:student', onlyDependOnLibsWithTags: ['scope:student', 'scope:shared'] },
  { sourceTag: 'scope:api', onlyDependOnLibsWithTags: ['scope:api', 'scope:shared'] },
  { sourceTag: 'scope:agent', onlyDependOnLibsWithTags: ['scope:agent', 'scope:shared'] },
  { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
];

const typeConstraints = [
  {
    sourceTag: 'type:app',
    onlyDependOnLibsWithTags: [
      'type:feature',
      'type:ui',
      'type:data-access',
      'type:domain',
      'type:util',
    ],
  },
  {
    sourceTag: 'type:feature',
    onlyDependOnLibsWithTags: [
      'type:feature',
      'type:ui',
      'type:data-access',
      'type:domain',
      'type:util',
    ],
  },
  { sourceTag: 'type:ui', onlyDependOnLibsWithTags: ['type:ui', 'type:util'] },
  {
    sourceTag: 'type:data-access',
    onlyDependOnLibsWithTags: ['type:data-access', 'type:domain', 'type:util'],
  },
  { sourceTag: 'type:domain', onlyDependOnLibsWithTags: ['type:domain', 'type:util'] },
  { sourceTag: 'type:util', onlyDependOnLibsWithTags: ['type:util'] },
];

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/coverage', '**/*.timestamp*', 'docs/**'],
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [...scopeConstraints, ...typeConstraints],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // CSS e SCSS passam pelo ESLint; o modo tolerante aceita a sintaxe do SCSS.
  {
    files: ['**/*.css', '**/*.scss'],
    plugins: { css },
    language: 'css/css',
    languageOptions: { tolerant: true },
  },
  // Cor só por token no front (T04): libs/ui/styles é o único lugar que declara cor. Testes,
  // fixtures e histórias do Storybook usam cores como dado de entrada e ficam de fora.
  // basePath fixa os padrões na raiz, já que cada projeto reexporta esta configuração.
  {
    basePath: import.meta.dirname,
    files: ['{apps/staff-web,apps/student-app,libs}/**/*.{ts,mts,cts,js,mjs,cjs,html,css,scss}'],
    ignores: [
      'libs/ui/styles/**',
      '**/*.{spec,test}.ts',
      '**/*.fixture.ts',
      '**/*.stories.ts',
      '**/.storybook/**',
    ],
    plugins: { gymos },
    rules: {
      'gymos/no-hardcoded-color': 'error',
    },
  },
];
