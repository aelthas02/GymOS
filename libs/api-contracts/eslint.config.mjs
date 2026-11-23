import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    // Gerado pelo openapi-typescript (pnpm nx run api:openapi).
    ignores: ['src/generated/**'],
  },
];
