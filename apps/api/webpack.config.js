const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/api'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      // Comandos de operação e geração do contrato OpenAPI (ADR-005), empacotados com a API.
      additionalEntryPoints: [
        { entryName: 'gymos', entryPath: './src/modules/platform/interface/cli/gymos.main.ts' },
        {
          entryName: 'gerar-openapi',
          entryPath: './src/modules/platform/interface/openapi/gerar-openapi.main.ts',
        },
      ],
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
    }),
  ],
};
