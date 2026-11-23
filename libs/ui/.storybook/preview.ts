import { DOCUMENT, Injector } from '@angular/core';
import type { Decorator, Preview } from '@storybook/angular';
import { suggestedAccents, ThemeService, tokens } from '../src';

const theme = Injector.create({
  providers: [ThemeService, { provide: DOCUMENT, useValue: document }],
}).get(ThemeService);

const nomes: Record<string, string> = {
  '#22C98A': 'Verde (padrão)',
  '#3AA6F0': 'Azul',
  '#FF8A3D': 'Laranja',
  '#A78BFA': 'Lilás',
};

// O acento escolhido na barra do Storybook passa pelo ThemeService, como nos apps.
const comAcento: Decorator = (story, context) => {
  theme.setAccent(String(context.globals['accent'] ?? tokens.accent));
  return story();
};

const preview: Preview = {
  globalTypes: {
    accent: {
      description: 'Cor de destaque da academia',
      toolbar: {
        title: 'Acento',
        icon: 'paintbrush',
        dynamicTitle: true,
        items: [
          ...suggestedAccents.map((value) => ({ value, title: `${nomes[value]} ${value}` })),
          { value: '#1E3A8A', title: 'Azul escuro #1E3A8A (texto branco)' },
          { value: '#FFE600', title: 'Amarelo #FFE600 (tom de texto escurecido)' },
        ],
      },
    },
  },
  initialGlobals: { accent: tokens.accent },
  decorators: [comAcento],
};

export default preview;
