import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Button } from '../lib/button/button';

const meta: Meta<Button> = {
  title: 'Componentes/Button',
  component: Button,
  decorators: [moduleMetadata({ imports: [Button] })],
};

export default meta;

type Story = StoryObj<Button>;

/** Textos de Main.html, Alunos.html e Estados.html. */
export const Variantes: Story = {
  render: () => ({
    template: `<div style="display:flex;gap:8px;flex-wrap:wrap;padding:16px">
      <ui-button variant="primary" size="lg">Novo aluno</ui-button>
      <ui-button variant="accent">Cadastrar aluno</ui-button>
      <ui-button variant="outline">Importar planilha</ui-button>
      <ui-button variant="danger" size="sm">Excluir</ui-button>
    </div>`,
  }),
};

export const Tamanhos: Story = {
  render: () => ({
    template: `<div style="display:flex;gap:8px;align-items:center;padding:16px">
      <ui-button size="sm" variant="outline">Pequeno 36</ui-button>
      <ui-button size="md" variant="outline">Médio 40</ui-button>
      <ui-button size="lg" variant="outline">Grande 44</ui-button>
    </div>`,
  }),
};

export const CarregandoEDesabilitado: Story = {
  name: 'Carregando e desabilitado',
  render: () => ({
    template: `<div style="display:flex;gap:8px;padding:16px">
      <ui-button variant="accent" [loading]="true">Salvando</ui-button>
      <ui-button variant="primary" [disabled]="true">Cadastrar aluno</ui-button>
    </div>`,
  }),
};
