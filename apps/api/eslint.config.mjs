import baseConfig from '../../eslint.config.mjs';

const layer = (name) => [`**/${name}`, `**/${name}/**`];

const frameworks = {
  group: ['@nestjs/*', '@prisma/*', 'prisma'],
  message: 'O domínio é TypeScript puro: sem Nest nem Prisma (ARCHITECTURE.md, back-end).',
};

// Tempo só pela porta Relogio (ADR-013): o domínio e os casos de uso não leem o relógio do sistema.
const relogio = [
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: 'Use a porta Relogio (relogio.agora()) em vez de Date.now().',
  },
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'Use a porta Relogio (relogio.agora()) em vez de new Date() sem argumento.',
  },
  {
    selector: "CallExpression[callee.name='Date']",
    message: 'Use a porta Relogio em vez de Date().',
  },
];

// Regra de negócio nunca usa o relógio do banco: o instante vem do Relogio, como parâmetro.
const sqlSemRelogio = {
  selector:
    'TaggedTemplateExpression[tag.property.name=/^\\$(queryRaw|executeRaw)/] TemplateElement[value.raw=/now\\(\\)|current_(date|time|timestamp)|localtimestamp/i]',
  message: 'Não use now()/CURRENT_* do SQL: passe relogio.agora() como parâmetro.',
};

// Módulos hexagonais em src/modules/<dominio>/{domain,application,infra,interface}:
// as dependências apontam para dentro (interface/infra → application → domain).
export default [
  ...baseConfig,
  {
    ignores: ['src/generated/**'],
  },
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
  {
    files: ['src/**/domain/**/*.ts', 'src/**/application/**/*.ts'],
    rules: { 'no-restricted-syntax': ['error', ...relogio] },
  },
  {
    files: ['src/modules/**/infra/**/*.ts', 'src/modules/**/interface/**/*.ts'],
    rules: { 'no-restricted-syntax': ['error', sqlSemRelogio] },
  },
  {
    // Repositórios recebem o cliente transacional do ContextoDoTenant, nunca o cliente global.
    files: ['src/modules/**/infra/**/*.ts', 'src/modules/**/interface/**/*.ts'],
    ignores: ['src/modules/platform/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/platform/infra/prisma/prisma.service', '**/generated/prisma/client'],
              importNames: ['PrismaService', 'PrismaClient'],
              message:
                'Use ContextoDoTenant.cliente(): o cliente global ignora o contexto do tenant.',
            },
          ],
        },
      ],
    },
  },
];
