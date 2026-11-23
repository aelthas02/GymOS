import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Avatar } from '../lib/avatar/avatar';
import { Badge } from '../lib/badge/badge';

const meta: Meta<Badge> = {
  title: 'Componentes/Badge e Avatar',
  component: Badge,
  decorators: [moduleMetadata({ imports: [Badge, Avatar] })],
};

export default meta;

type Story = StoryObj<Badge>;

/** Situação de pagamento, como na lista de Alunos. */
export const Situacoes: Story = {
  name: 'Situações',
  render: () => ({
    template: `<div style="display:flex;gap:8px;padding:16px">
      <ui-badge variant="ok">Em dia</ui-badge>
      <ui-badge variant="soon">A vencer</ui-badge>
      <ui-badge variant="late">Em atraso</ui-badge>
      <ui-badge variant="off">Inativo</ui-badge>
    </div>`,
  }),
};

export const AvatarDeIniciais: Story = {
  name: 'Avatar de iniciais',
  render: () => ({
    template: `<div style="display:flex;gap:12px;align-items:center;padding:16px">
      <ui-avatar name="Rafael Souza" />
      <ui-avatar name="Juliana Prado" tone="late" />
      <ui-avatar name="Camila Duarte" tone="soon" [size]="44" [letters]="2" />
      <ui-avatar name="Tiago Alves" tone="off" [size]="28" />
    </div>`,
  }),
};
