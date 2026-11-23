import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Tabs, type TabItem } from '../lib/tabs/tabs';
import { roteadorEm } from './router';

const meta: Meta<Tabs> = {
  title: 'Componentes/Tabs',
  component: Tabs,
  decorators: [
    moduleMetadata({ imports: [Tabs] }),
    applicationConfig({ providers: roteadorEm('/alunos') }),
  ],
};

export default meta;

type Story = StoryObj<Tabs>;

const itens: TabItem[] = [
  { label: 'Lista de alunos', link: '/alunos' },
  { label: 'Importar alunos', link: '/alunos/importar' },
];

/** A aba ativa vem da rota: aqui o router em memória está em `/alunos`. */
export const Navegacao: Story = {
  name: 'Navegação por rota',
  render: () => ({
    props: { itens },
    template: `<div style="padding:16px"><ui-tabs label="Alunos" [items]="itens" /></div>`,
  }),
};

export const ComContador: Story = {
  name: 'Com contador',
  render: () => ({
    props: {
      itens: [...itens, { label: 'Acompanhamento', link: '/alunos/acompanhamento', count: 3 }],
    },
    template: `<div style="padding:16px"><ui-tabs label="Alunos" [items]="itens" /></div>`,
  }),
};
