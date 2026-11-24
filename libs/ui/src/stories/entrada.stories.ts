import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { ColorPicker } from '../lib/color-picker/color-picker';
import { FileDropzone } from '../lib/file-dropzone/file-dropzone';
import { PermissionMatrix, type PermissionRow } from '../lib/permission-matrix/permission-matrix';
import { SortableList } from '../lib/sortable-list/sortable-list';

const meta: Meta = {
  title: 'Compostos/Entrada de dados',
  decorators: [
    moduleMetadata({ imports: [FileDropzone, ColorPicker, PermissionMatrix, SortableList] }),
  ],
};

export default meta;

type Story = StoryObj;

/** Logotipo em `Passo1.html`. */
export const ArquivoDoLogotipo: Story = {
  name: 'Arquivo do logotipo',
  render: () => ({
    template: `<div style="padding:16px;max-width:520px"><ui-file-dropzone
      title="Arraste o logotipo aqui"
      hint="PNG ou SVG, fundo transparente"
      [accept]="['.png', '.svg']" /></div>`,
  }),
};

/** Planilha em `Importar.html`: aceita .xlsx e .csv, até 5 MB. */
export const PlanilhaDeAlunos: Story = {
  name: 'Planilha de alunos',
  render: () => ({
    template: `<div style="padding:16px;max-width:520px"><ui-file-dropzone
      title="Arraste a planilha aqui"
      hint="Aceita .xlsx e .csv, até 5 MB"
      [accept]="['.xlsx', '.csv']" [maxSize]="5242880" /></div>`,
  }),
};

export const ArquivoComErro: Story = {
  name: 'Arquivo com erro',
  render: () => ({
    template: `<div style="padding:16px;max-width:520px"><ui-file-dropzone
      title="Arraste a planilha aqui"
      hint="Aceita .xlsx e .csv, até 5 MB"
      [accept]="['.xlsx', '.csv']"
      externalError="Formato não aceito. Envie .xlsx ou .csv." /></div>`,
  }),
};

const sugeridas = ['#22C98A', '#3AA6F0', '#FF8A3D', '#A78BFA', '#E0553A'];

/** Primeiros passos: Hex e RGB num campo só. */
export const CorComRgbEmUmCampo: Story = {
  name: 'Cor com RGB em um campo',
  render: () => ({
    props: { sugeridas },
    template: `<div style="padding:16px;max-width:560px"><ui-color-picker [swatches]="sugeridas" /></div>`,
  }),
};

/** Configurações: Hex e R, G, B separados. */
export const CorComCanaisSeparados: Story = {
  name: 'Cor com canais separados',
  render: () => ({
    props: { sugeridas },
    template: `<div style="padding:16px;max-width:300px"><ui-color-picker variant="canais" label="Cores sugeridas" [swatches]="sugeridas" /></div>`,
  }),
};

const modulos: PermissionRow[] = [
  { id: 'inicio', label: 'Início', granted: ['ver'] },
  { id: 'recepcao', label: 'Recepção', granted: ['ver', 'criar'] },
  { id: 'alunos', label: 'Alunos', granted: ['ver', 'criar', 'editar'] },
  { id: 'financeiro', label: 'Financeiro', granted: ['ver'] },
  { id: 'sem-ver', label: 'Treinos', granted: [] },
  {
    id: 'permissoes',
    label: 'Permissões',
    granted: [],
    readOnly: true,
    note: { text: 'Só administrador', variant: 'off' },
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    granted: ['ver', 'editar'],
    note: { text: 'Parcial', variant: 'soon' },
  },
];

/** O que o Gerente pode fazer (`Permissoes.html`). */
export const MatrizDePermissoes: Story = {
  name: 'Matriz de permissões',
  render: () => ({
    props: { modulos },
    template: `<div style="padding:16px;max-width:640px"><ui-permission-matrix label="O que o Gerente pode fazer" [(rows)]="modulos" /></div>`,
  }),
};

const exercicios = ['Supino reto', 'Crucifixo inclinado', 'Tríceps corda', 'Elevação lateral'];

/** Ficha de treino (`AlunosFicha.html`): arraste pela alça ou use Alt+setas. */
export const ListaReordenavel: Story = {
  name: 'Lista reordenável',
  render: () => ({
    props: { exercicios },
    template: `<div style="padding:16px;max-width:420px"><ui-sortable-list
      label="Exercícios do treino B"
      [items]="exercicios"
      (orderChange)="exercicios = $any($event)">
      <ng-template let-item let-i="index"><b>{{ i + 1 }}. {{ item }}</b></ng-template>
    </ui-sortable-list></div>`,
  }),
};
