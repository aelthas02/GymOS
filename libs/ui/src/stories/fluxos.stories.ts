import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { StatusFlow } from '../lib/status-flow/status-flow';
import { Stepper, type StepItem } from '../lib/stepper/stepper';

const meta: Meta = {
  title: 'Compostos/Fluxos',
  decorators: [moduleMetadata({ imports: [Stepper, StatusFlow] })],
};

export default meta;

type Story = StoryObj;

const primeirosPassos: StepItem[] = [
  { label: 'Identidade visual' },
  { label: 'Planos' },
  { label: 'Equipe' },
  { label: 'Catraca' },
  { label: 'Importar alunos' },
];

const importacao: StepItem[] = [
  { label: 'Enviar planilha' },
  { label: 'Conferir colunas' },
  { label: 'Revisar e importar' },
];

/** Primeiros passos (`Passo1.html`): o passo 1 de 5 está ativo. */
export const Vertical: Story = {
  render: () => ({
    props: { passos: primeirosPassos },
    template: `<div style="padding:16px;max-width:260px"><ui-stepper label="Seu progresso" [steps]="passos" [current]="0" /></div>`,
  }),
};

/** Importar alunos (`Importar.html`): enviar a planilha já foi, conferir colunas é o atual. */
export const VerticalComPassoConcluido: Story = {
  name: 'Vertical com passo concluído',
  render: () => ({
    props: { passos: importacao },
    template: `<div style="padding:16px;max-width:250px"><ui-stepper label="Importar alunos" [steps]="passos" [current]="1" /></div>`,
  }),
};

export const Horizontal: Story = {
  render: () => ({
    props: { passos: importacao },
    template: `<div style="padding:16px;max-width:520px"><ui-stepper label="Importar alunos" orientation="horizontal" [steps]="passos" [current]="1" /></div>`,
  }),
};

/** Situações de um contrato; "Tolerância 7 dias" vem da configuração da academia. */
export const FluxoDeSituacoes: Story = {
  name: 'Fluxo de situações',
  render: () => ({
    props: {
      passos: [
        { label: 'Ativo' },
        { label: 'A vencer' },
        { label: 'Tolerância 7 dias' },
        { label: 'Encerrado' },
      ],
    },
    template: `<div style="padding:16px"><ui-status-flow label="Situações do contrato" [steps]="passos" [current]="1" /></div>`,
  }),
};
