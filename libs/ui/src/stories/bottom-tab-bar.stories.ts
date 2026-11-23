import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { BottomTabBar, type BottomTab } from '../lib/shell/bottom-tab-bar';
import { roteadorEm } from './router';

const meta: Meta<BottomTabBar> = {
  title: 'Layout/Barra de abas do aluno',
  component: BottomTabBar,
  decorators: [
    moduleMetadata({ imports: [BottomTabBar] }),
    applicationConfig({ providers: roteadorEm('/aluno') }),
  ],
};

export default meta;

type Story = StoryObj<BottomTabBar>;

/** Textos de Aluno.html. O item ativo vem da rota; aqui o router em memória está em `/aluno`. */
const abas: BottomTab[] = [
  { label: 'Início', link: '/aluno', icon: 'home', exact: true },
  { label: 'Treino', link: '/aluno/treino', icon: 'dumbbell' },
  { label: 'Aulas', link: '/aluno/aulas', icon: 'calendar' },
  { label: 'Loja', link: '/aluno/loja', icon: 'bag' },
  { label: 'Mais', link: '/aluno/mais', icon: 'menu' },
];

export const AppDoAluno: Story = {
  name: 'App do aluno',
  render: () => ({
    props: { abas },
    template: `<div style="width:var(--board-phone-width);border:1px solid var(--border)"><ui-bottom-tab-bar [tabs]="abas" /></div>`,
  }),
};
