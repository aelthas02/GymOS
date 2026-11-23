import type { StorybookConfig } from '@storybook/angular';

// Storybook só como documentação (ADR-013). Estilos globais e zoneless vêm do project.json.
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  addons: [],
  staticDirs: [{ from: '../styles/fonts/inter', to: '/fonts/inter' }],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
};

export default config;
