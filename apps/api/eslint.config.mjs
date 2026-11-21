import baseConfig from '../../eslint.config.mjs';

const layer = (name) => [`**/${name}`, `**/${name}/**`];

const frameworks = {
  group: ['@nestjs/*', '@prisma/*', 'prisma'],
  message: 'O domínio é TypeScript puro: sem Nest nem Prisma (ARCHITECTURE.md, back-end).',
};

// Módulos hexagonais em src/modules/<dominio>/{domain,application,infra,interface}:
// as dependências apontam para dentro (interface/infra → application → domain).
export default [
  ...baseConfig,
  {
    files: ['src/**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [...layer('application'), ...layer('infra'), ...layer('interface')],
              message: 'O domínio não importa de application, infra nem interface.',
            },
            frameworks,
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [...layer('infra'), ...layer('interface')],
              message: 'Casos de uso dependem de portas do domínio, não de infra nem interface.',
            },
          ],
        },
      ],
    },
  },
];
