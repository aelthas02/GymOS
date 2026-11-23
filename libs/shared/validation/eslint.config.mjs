import baseConfig from '../../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@angular/*'],
              message: 'Pacote usado também pelo back: sem Angular (ARCHITECTURE.md).',
            },
          ],
        },
      ],
    },
  },
];
