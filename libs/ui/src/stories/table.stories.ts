import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Avatar } from '../lib/avatar/avatar';
import { Badge } from '../lib/badge/badge';
import { Button } from '../lib/button/button';
import { Table, TableCell, type TableColumn } from '../lib/table/table';

const meta: Meta<Table> = {
  title: 'Componentes/Table',
  component: Table,
  decorators: [moduleMetadata({ imports: [Table, TableCell, Avatar, Badge, Button] })],
};

export default meta;

type Story = StoryObj<Table>;

const colunas: TableColumn[] = [
  { key: 'nome', label: 'Aluno', sortable: true, width: 'minmax(190px, 1.4fr)' },
  { key: 'plano', label: 'Plano', sortable: true, width: 'minmax(110px, .8fr)' },
  { key: 'situacao', label: 'Adimplência', width: 'minmax(140px, 1fr)' },
  { key: 'acoes', label: 'Ações', width: 'minmax(300px, 2fr)' },
];

const nomes = ['Rafael Souza', 'Juliana Prado', 'Camila Duarte', 'Tiago Alves'];
const situacoes: [string, string][] = [
  ['late', 'Em atraso'],
  ['ok', 'Em dia'],
  ['soon', 'A vencer'],
  ['ok', 'Em dia'],
];

const alunos = (quantidade: number) =>
  Array.from({ length: quantidade }, (_, i) => ({
    nome: nomes[i % nomes.length],
    plano: ['Mensal', 'Trimestral'][i % 2],
    situacao: situacoes[i % situacoes.length],
  }));

const celulas = `
  <ng-template uiTableCell="nome" let-row>
    <div style="display:flex;align-items:center;gap:12px;min-width:0">
      <ui-avatar [name]="row.nome" [decorative]="true" />
      <span style="font-size:14px;font-weight:600">{{ row.nome }}</span>
    </div>
  </ng-template>
  <ng-template uiTableCell="situacao" let-row>
    <ui-badge [variant]="row.situacao[0]">{{ row.situacao[1] }}</ui-badge>
  </ng-template>
  <ng-template uiTableCell="acoes">
    <div style="display:flex;gap:8px">
      <ui-button variant="outline" size="sm">Ver ficha</ui-button>
      <ui-button variant="danger" size="sm">Excluir</ui-button>
    </div>
  </ng-template>`;

/** Lista de Alunos.html: cabeçalho em caixa alta, slots de célula, ordenação e rodapé. */
export const ListaDeAlunos: Story = {
  name: 'Lista de alunos',
  render: () => ({
    props: { colunas, linhas: alunos(4), ordem: { column: 'nome', direction: 'asc' } },
    template: `<div style="padding:16px">
      <ui-table label="Lista de alunos" [columns]="colunas" [rows]="linhas" [total]="312" [page]="1" [pageSize]="4" [sort]="ordem">
        ${celulas}
      </ui-table>
    </div>`,
  }),
};

/** Acima de 100 linhas a tabela usa o viewport virtual do CDK. */
export const Virtualizada: Story = {
  render: () => ({
    props: { colunas, linhas: alunos(150) },
    template: `<div style="padding:16px">
      <ui-table label="Todos os alunos" [columns]="colunas" [rows]="linhas" maxHeight="360px">
        ${celulas}
      </ui-table>
    </div>`,
  }),
};
