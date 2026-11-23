import type { Meta, StoryObj } from '@storybook/angular';
import { TokensPage } from './tokens-page';

const meta: Meta<TokensPage> = {
  title: 'Fundamentos/Tokens',
  component: TokensPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj<TokensPage>;

/** Acento da barra do Storybook (cores sugeridas da tela Identidade visual). */
export const Tokens: Story = {
  render: (_args, { globals }) => ({
    props: { accent: String(globals['accent']) },
    template: '<ui-tokens-page [accent]="accent" />',
  }),
};

/** Qualquer cor, como a academia pode digitar em Hex na Identidade visual. */
export const AcentoPersonalizado: Story = {
  name: 'Acento personalizado',
  args: { accent: '#1E3A8A' },
  argTypes: { accent: { control: 'color' } },
};
