import nx from '@nx/eslint-plugin';

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
];
