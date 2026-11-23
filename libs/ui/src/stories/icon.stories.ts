import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Icon } from '../lib/icon/icon';
import { IconButton } from '../lib/icon-button/icon-button';
import { iconNames } from '../lib/icon/icons';

const meta: Meta<Icon> = {
  title: 'Componentes/Ícones',
  component: Icon,
  decorators: [moduleMetadata({ imports: [Icon, IconButton] })],
};

export default meta;

type Story = StoryObj<Icon>;

export const Conjunto: Story = {
  render: () => ({
    props: { nomes: iconNames },
    template: `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:12px;padding:16px">
      @for (nome of nomes; track nome) {
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px">
          <ui-icon [name]="nome" [size]="24" />
          {{ nome }}
        </div>
      }
    </div>`,
  }),
};

/** Visual de 36 px, área de toque de 44 px. */
export const BotaoDeIcone: Story = {
  name: 'Botão de ícone',
  render: () => ({
    template: `<div style="display:flex;gap:8px;padding:16px">
      <ui-icon-button icon="edit" label="Editar aluno" />
      <ui-icon-button icon="chat" label="Enviar mensagem" />
      <ui-icon-button icon="trash" label="Excluir aluno" />
      <ui-icon-button icon="bell" label="Avisos" [disabled]="true" />
    </div>`,
  }),
};
