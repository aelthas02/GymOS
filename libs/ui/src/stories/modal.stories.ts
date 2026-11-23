import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Button } from '../lib/button/button';
import { Modal } from '../lib/modal/modal';

const meta: Meta<Modal> = {
  title: 'Componentes/Modal e Drawer',
  component: Modal,
  parameters: { layout: 'fullscreen' },
  decorators: [moduleMetadata({ imports: [Modal, Button] })],
};

export default meta;

type Story = StoryObj<Modal>;

export const Janela: Story = {
  render: () => ({
    props: { aberto: true },
    template: `<div style="padding:16px">
      <ui-button variant="outline" (click)="aberto = true">Excluir aluno</ui-button>
      <ui-modal [(open)]="aberto" heading="Excluir aluno">
        <p style="margin:0;font-size:14px;color:var(--muted)">Os dados de Rafael Souza saem da lista. Esta ação não pode ser desfeita.</p>
        <ng-container footer>
          <ui-button variant="outline" (click)="aberto = false">Cancelar</ui-button>
          <ui-button variant="danger" (click)="aberto = false">Excluir</ui-button>
        </ng-container>
      </ui-modal>
    </div>`,
  }),
};

export const Gaveta: Story = {
  render: () => ({
    props: { aberto: true },
    template: `<div style="padding:16px">
      <ui-button variant="outline" (click)="aberto = true">Filtros</ui-button>
      <ui-modal [(open)]="aberto" variant="drawer" heading="Filtros">
        <p style="margin:0;font-size:14px;color:var(--muted)">Escolha a situação e o plano dos alunos.</p>
        <ng-container footer>
          <ui-button variant="accent" (click)="aberto = false">Aplicar</ui-button>
        </ng-container>
      </ui-modal>
    </div>`,
  }),
};

export const SemDispensar: Story = {
  name: 'Sem dispensar (exige resposta)',
  render: () => ({
    props: { aberto: true },
    template: `<ui-modal [(open)]="aberto" [dismissable]="false" heading="Sessão expirada">
      <p style="margin:0;font-size:14px;color:var(--muted)">Entre de novo para continuar.</p>
      <ui-button footer variant="primary" (click)="aberto = false">Entrar</ui-button>
    </ui-modal>`,
  }),
};
