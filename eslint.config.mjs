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
          // Fixtures de tela (ADR-019): o app as escreve tipadas pelo e2e e o e2e as importa.
          allow: [
            '^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$',
            '^.*/e2e/src/fixture-de-tela$',
            '^.*/testing/[^/]+\\.fixture$',
          ],
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
  {
    // T08: dinheiro em centavos e alíquotas em pontos-base, sempre inteiros, com @gymos/shared-money.
    files: ['**/domain/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...[
          ":matches(BinaryExpression[operator='*'], AssignmentExpression[operator='*=']) > Literal[raw=/^0?\\./]",
          ":matches(BinaryExpression[operator='/'], AssignmentExpression[operator='/=']) > Literal.right[value=100]",
          ":matches(BinaryExpression[operator='/'], AssignmentExpression[operator='/=']) > Literal.right[value=10000]",
        ].map((selector) => ({
          selector,
          message:
            'Dinheiro e alíquota em inteiros: use centavos, pontos-base e aplicarAliquota de @gymos/shared-money.',
        })),
      ],
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
      // O banner de ambiente não depende de libs/ui e precisa de cor própria.
      'libs/shared/ambiente/**',
    ],
    plugins: { gymos },
    rules: {
      'gymos/no-hardcoded-color': 'error',
    },
  },
];
