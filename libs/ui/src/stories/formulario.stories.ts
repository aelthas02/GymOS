import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Checkbox } from '../lib/checkbox/checkbox';
import { Chips, type ChipOption } from '../lib/chips/chips';
import { Field, FieldControl } from '../lib/field/field';
import { Select, type SelectOption } from '../lib/select/select';
import { Toggle } from '../lib/toggle/toggle';

const meta: Meta = {
  title: 'Componentes/Formulário',
  decorators: [moduleMetadata({ imports: [Field, FieldControl, Select, Toggle, Checkbox, Chips] })],
};

export default meta;

type Story = StoryObj;

const planos: SelectOption[] = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'anual', label: 'Anual' },
];

const situacoes: ChipOption[] = [
  { value: 'todos', label: 'Todos', count: 312 },
  { value: 'em-dia', label: 'Em dia', count: 289 },
  { value: 'a-vencer', label: 'A vencer', count: 11 },
  { value: 'em-atraso', label: 'Em atraso', count: 12 },
];

const quadro = 'display:flex;flex-direction:column;gap:20px;padding:16px;max-width:420px';

export const Campo: Story = {
  render: () => ({
    template: `<div style="${quadro}">
      <ui-field label="Pesquisar aluno" hint="Por nome, CPF ou telefone">
        <input uiFieldControl type="search" style="height:44px;padding:0 14px;border:1px solid var(--border);border-radius:12px;font:14px var(--font)" />
      </ui-field>
      <ui-field label="E-mail" error="Informe um e-mail válido">
        <input uiFieldControl type="email" value="carla@" style="height:44px;padding:0 14px;border:1px solid var(--badge-late-fg);border-radius:12px;font:14px var(--font)" />
      </ui-field>
    </div>`,
  }),
};

export const Seletor: Story = {
  render: () => ({
    props: { planos },
    template: `<div style="${quadro}">
      <ui-field label="Plano" hint="Filtra a lista de alunos">
        <ui-select [options]="planos" placeholder="Plano: todos" />
      </ui-field>
    </div>`,
  }),
};

export const InterruptorECaixa: Story = {
  name: 'Interruptor e caixa de seleção',
  render: () => ({
    template: `<div style="${quadro}">
      <ui-toggle label="Avisar o aluno por mensagem" [checked]="true" />
      <ui-toggle label="Cobrança automática" />
      <ui-toggle label="Indisponível" [disabled]="true" />
      <ui-checkbox [checked]="true">Selecionar Rafael Souza</ui-checkbox>
      <ui-checkbox>Selecionar Juliana Prado</ui-checkbox>
      <ui-checkbox [indeterminate]="true">Selecionar todos</ui-checkbox>
    </div>`,
  }),
};

export const Filtros: Story = {
  render: () => ({
    props: { situacoes },
    template: `<div style="${quadro}">
      <ui-chips label="Situação" [options]="situacoes" [multiple]="false" [values]="['todos']" />
      <ui-chips label="Situação (vários)" [options]="situacoes" [values]="['em-dia', 'em-atraso']" />
    </div>`,
  }),
};
